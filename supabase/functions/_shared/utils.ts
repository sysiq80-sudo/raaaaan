/**
 * ران — أدوات مشتركة للـ Edge Functions
 * Shared Utilities for Supabase Edge Functions
 *
 * تُستورد من:
 *   import { haversineDistance, calculateETA, IRAQ_BOUNDS, isWithinIraq, corsHeaders } from "../_shared/utils.ts";
 */

// ════════════════════════════════════════════════════════════
// CORS Headers — مشتركة بين جميع الدوال
// يمكن تقييد النطاقات عبر متغير بيئة ALLOWED_ORIGINS
// القيمة الافتراضية: "*" (مطلوب لتطبيقات Capacitor WebView + webhooks)
// مثال: ALLOWED_ORIGINS=https://raan.app,https://admin.raan.app
// ════════════════════════════════════════════════════════════

function getAllowedOrigin(requestOrigin?: string | null): string {
  if (
    requestOrigin &&
    (
      requestOrigin === "capacitor://localhost" ||
      requestOrigin === "ionic://localhost" ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin)
    )
  ) {
    return requestOrigin;
  }

  const envOrigins = Deno.env.get("ALLOWED_ORIGINS");
  if (!envOrigins) return "*";
  const allowed = envOrigins.split(",").map((o) => o.trim());
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;
  return allowed[0];
}

export function getCorsHeaders(request?: Request): Record<string, string> {
  const origin = request?.headers?.get("origin") ?? null;
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(origin),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

// الحفاظ على التوافق مع الكود الحالي (fallback لـ *)
export const corsHeaders = {
  "Access-Control-Allow-Origin": getAllowedOrigin(),
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ════════════════════════════════════════════════════════════
// حدود العراق الجغرافية
// ════════════════════════════════════════════════════════════

export const IRAQ_BOUNDS = {
  minLat: 29.0,
  maxLat: 37.5,
  minLng: 38.0,
  maxLng: 49.0,
};

/**
 * التحقق من أن الإحداثيات داخل العراق
 */
export function isWithinIraq(lat: number, lng: number): boolean {
  return (
    lat >= IRAQ_BOUNDS.minLat &&
    lat <= IRAQ_BOUNDS.maxLat &&
    lng >= IRAQ_BOUNDS.minLng &&
    lng <= IRAQ_BOUNDS.maxLng
  );
}

// ════════════════════════════════════════════════════════════
// Haversine Formula — المسافة بين نقطتين (كيلومتر)
// ════════════════════════════════════════════════════════════

const DEG_TO_RAD = 0.017453292519943295; // Math.PI / 180

/**
 * حساب المسافة بين نقطتين على سطح الأرض بالكيلومتر
 * Uses the Haversine formula for accuracy
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // نصف قطر الأرض بالكيلومتر
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;

  const a =
    Math.sin(dLat * 0.5) * Math.sin(dLat * 0.5) +
    Math.cos(lat1 * DEG_TO_RAD) *
      Math.cos(lat2 * DEG_TO_RAD) *
      Math.sin(dLng * 0.5) *
      Math.sin(dLng * 0.5);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ════════════════════════════════════════════════════════════
// ETA — حساب وقت الوصول المتوقع (بالدقائق)
// ════════════════════════════════════════════════════════════

/**
 * حساب وقت الوصول المتوقع مع مراعاة ساعات الذروة
 * Rush hours: 7-9 AM and 4-7 PM (slower speed 25 km/h vs 40 km/h)
 */
export function calculateETA(distanceKm: number): number {
  const hour = new Date().getHours();
  const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19);
  const avgSpeedKmh = isRushHour ? 25 : 40;
  return Math.round((distanceKm / avgSpeedKmh) * 60);
}

// ════════════════════════════════════════════════════════════
// Point-in-Polygon — Ray casting algorithm
// ════════════════════════════════════════════════════════════

/**
 * التحقق من أن نقطة داخل مضلّع جغرافي
 * Useful for region-based pricing
 */
export function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: { lat: number; lng: number }[],
): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lng,
      yi = polygon[i].lat;
    const xj = polygon[j].lng,
      yj = polygon[j].lat;

    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

// ════════════════════════════════════════════════════════════
// Auth Helper — التحقق من JWT في الدوال المحمية
// ════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * استخراج المستخدم من Authorization header
 * Returns null if invalid/missing token
 */
export async function getAuthUser(req: Request): Promise<{ id: string; email?: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error } = await anonClient.auth.getUser();
    if (error || !user) return null;

    return { id: user.id, email: user.email };
  } catch {
    return null;
  }
}

// ════════════════════════════════════════════════════════════
// Response Helpers — مساعدات إنشاء الاستجابات
// ════════════════════════════════════════════════════════════

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(error: string, status = 400): Response {
  return jsonResponse({ error }, status);
}

export function corsPreflightResponse(): Response {
  return new Response(null, { headers: corsHeaders });
}
