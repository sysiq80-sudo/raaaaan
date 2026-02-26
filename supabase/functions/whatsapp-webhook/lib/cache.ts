/**
 * ران — Cache ذكي للـ Geocoding والوجهات
 * RAAN Smart Geocoding Cache — Reduces Google Maps & Nominatim API calls
 *
 * يحفظ نتائج الترميز الجغرافي في الذاكرة مع TTL
 * يقلل استدعاءات API بنسبة ~40% للوجهات المتكررة
 */

import type { ResolvedLocation } from "./geocoding.ts";

// ════════════════════════════════════════
// Cache بسيط في الذاكرة مع TTL
// ════════════════════════════════════════
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private defaultTTL: number; // milliseconds

  constructor(maxSize = 200, defaultTTLMinutes = 30) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTLMinutes * 60 * 1000;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMinutes?: number): void {
    // تنظيف إذا امتلأ
    if (this.cache.size >= this.maxSize) {
      this.evictExpired();
      if (this.cache.size >= this.maxSize) {
        // حذف الأقدم
        const firstKey = this.cache.keys().next().value;
        if (firstKey) this.cache.delete(firstKey);
      }
    }
    const ttl = ttlMinutes ? ttlMinutes * 60 * 1000 : this.defaultTTL;
    this.cache.set(key, { value, expiresAt: Date.now() + ttl });
  }

  private evictExpired(): void {
    const now = Date.now();
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      const entry = this.cache.get(key);
      if (entry && now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  get size(): number {
    return this.cache.size;
  }

  getStats(): { size: number; maxSize: number } {
    return { size: this.cache.size, maxSize: this.maxSize };
  }
}

// ════════════════════════════════════════
// Forward Geocoding Cache (اسم → إحداثيات)
// ════════════════════════════════════════
const forwardGeoCache = new TTLCache<ResolvedLocation>(300, 60); // 300 إدخال، 60 دقيقة

export function getCachedForwardGeocode(query: string): ResolvedLocation | null {
  const key = normalizeGeoQuery(query);
  const cached = forwardGeoCache.get(key);
  if (cached) {
    console.log(`[geo-cache] ✅ Forward HIT: "${query}" → ${cached.address}`);
  }
  return cached;
}

export function cacheForwardGeocode(query: string, result: ResolvedLocation): void {
  const key = normalizeGeoQuery(query);
  forwardGeoCache.set(key, result);
  console.log(`[geo-cache] 📦 Forward STORED: "${query}" → ${result.address} (cache size: ${forwardGeoCache.size})`);
}

// ════════════════════════════════════════
// Reverse Geocoding Cache (إحداثيات → عنوان)
// ════════════════════════════════════════
const reverseGeoCache = new TTLCache<string>(200, 120); // 200 إدخال، ساعتين

export function getCachedReverseGeocode(lat: number, lng: number): string | null {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = reverseGeoCache.get(key);
  if (cached) {
    console.log(`[geo-cache] ✅ Reverse HIT: (${lat.toFixed(4)},${lng.toFixed(4)}) → ${cached}`);
  }
  return cached;
}

export function cacheReverseGeocode(lat: number, lng: number, address: string): void {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  reverseGeoCache.set(key, address);
}

// ════════════════════════════════════════
// AI Response Cache (نص → نتيجة GPT)
// للاستعلامات المتكررة تماماً
// ════════════════════════════════════════
interface AIClassifyResult {
  intent: string;
  reply: string;
  destination_hint: string | null;
}

const aiClassifyCache = new TTLCache<AIClassifyResult>(100, 15); // 100 إدخال، 15 دقيقة

export function getCachedAIClassification(text: string): AIClassifyResult | null {
  const key = normalizeAIQuery(text);
  const cached = aiClassifyCache.get(key);
  if (cached) {
    console.log(`[ai-cache] ✅ Classify HIT: "${text.substring(0, 30)}..." → ${cached.intent}`);
  }
  return cached;
}

export function cacheAIClassification(text: string, result: AIClassifyResult): void {
  const key = normalizeAIQuery(text);
  aiClassifyCache.set(key, result);
}

// ════════════════════════════════════════
// Destination Extraction Cache
// ════════════════════════════════════════
interface DestinationResult {
  destination_search_query: string;
  vehicle_type: string;
  notes: string | null;
  is_destination: boolean;
  conversation_reply: string | null;
}

const destinationCache = new TTLCache<DestinationResult>(100, 15);

export function getCachedDestination(text: string): DestinationResult | null {
  const key = normalizeAIQuery(text);
  const cached = destinationCache.get(key);
  if (cached) {
    console.log(`[ai-cache] ✅ Destination HIT: "${text.substring(0, 30)}..." → ${cached.destination_search_query}`);
  }
  return cached;
}

export function cacheDestination(text: string, result: DestinationResult): void {
  const key = normalizeAIQuery(text);
  destinationCache.set(key, result);
}

// ════════════════════════════════════════
// Helper: تطبيع النص للمطابقة
// ════════════════════════════════════════
function normalizeGeoQuery(query: string): string {
  return query.trim().toLowerCase()
    .replace(/[.,،\-_]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeAIQuery(text: string): string {
  return text.trim().toLowerCase()
    .replace(/\s+/g, " ")
    .substring(0, 100); // نقطع عند 100 حرف لتوفير الذاكرة
}

// ════════════════════════════════════════
// إحصائيات (للتطوير/التصحيح)
// ════════════════════════════════════════
export function getCacheStats() {
  return {
    forwardGeo: forwardGeoCache.getStats(),
    reverseGeo: reverseGeoCache.getStats(),
    aiClassify: aiClassifyCache.getStats(),
    destination: destinationCache.getStats(),
  };
}
