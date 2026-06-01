/**
 * ران — Nominatim Geocoding Adapter
 * تطبيق OpenStreetMap Nominatim Geocoding Service
 * المزايا: مجاني، عربي، local search، بدون API keys
 * 
 * Nominatim API: https://nominatim.org/release-docs/latest/api/
 */

import type { IGeocodingAdapter, Coordinate, PlacePrediction } from './types';
import { SERVICE_URLS, SERVICE_BOUNDS, FEATURE_FLAGS } from './config';

export class NominatimGeocodingAdapter implements IGeocodingAdapter {
  private readonly NOMINATIM_URL = SERVICE_URLS.NOMINATIM || 'https://nominatim.openstreetmap.org';
  private readonly TIMEOUT = 5000;
  private readonly BOUNDS = SERVICE_BOUNDS;
  // ☕ Circuit breaker: بعد الفشل، انتظر 60 ثانية قبل المحاولة مرة أخرى
  private _lastFailureAt: number | null = null;
  private readonly CIRCUIT_BREAK_MS = 60_000; // 60 ثانية
  private _circuitWarnedOnce = false; // منع spam في Console

  private _isCircuitOpen(): boolean {
    if (this._lastFailureAt === null) return false;
    const isOpen = Date.now() - this._lastFailureAt < this.CIRCUIT_BREAK_MS;
    if (!isOpen) this._circuitWarnedOnce = false; // إعادة تعيين عند إغلاق الدائرة
    return isOpen;
  }

  /**
   * تحميل — لا يوجد شيء للتحميل
   */
  async load(): Promise<void> {
    return;
  }

  /**
   * تحويل عنوان → إحداثيات (Geocoding)
   */
  async geocode(address: string, bounds?: any): Promise<Coordinate | null> {
    if (this._isCircuitOpen()) return null; // دائرة مفتوحة
    try {
      const viewbox = bounds || this.BOUNDS;

      const url = new URL(`${this.NOMINATIM_URL}/search`);
      url.searchParams.append('q', address);
      url.searchParams.append('countrycodes', 'IQ');
      url.searchParams.append('format', 'json');
      url.searchParams.append('limit', '1');
      url.searchParams.append('viewbox', `${viewbox.west},${viewbox.north},${viewbox.east},${viewbox.south}`);
      url.searchParams.append('bounded', '0');
      url.searchParams.append('addressdetails', '1');

      const response = await Promise.race([
        fetch(url.toString()),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Nominatim timeout')), this.TIMEOUT)
        ),
      ]);

      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        const result = data[0];
        return {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
        };
      }

      return null;
    } catch (error) {
      this._lastFailureAt = Date.now();
      if (!this._circuitWarnedOnce) {
        this._circuitWarnedOnce = true;
        console.warn('⚠️ Nominatim geocoding unavailable (circuit open for 60s):', (error as Error).message);
      }
      throw error;
    }
  }

  /**
   * تحويل إحداثيات → عنوان (Reverse Geocoding)
   */
  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    if (this._isCircuitOpen()) return null; // دائرة مفتوحة — تجاوز Nominatim
    try {
      const url = new URL(`${this.NOMINATIM_URL}/reverse`);
      url.searchParams.append('lat', lat.toString());
      url.searchParams.append('lon', lng.toString());
      url.searchParams.append('format', 'json');
      url.searchParams.append('language', 'ar');
      url.searchParams.append('zoom', '18');
      url.searchParams.append('addressdetails', '1');

      const response = await Promise.race([
        fetch(url.toString()),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Nominatim timeout')), this.TIMEOUT)
        ),
      ]);

      const data = await response.json();
      if (!data.display_name) return null;

      // استخدام buildHumanAddress() المركزية للأولوية الصحيحة
      const { buildHumanAddress, extractNominatimComponents } = await import('@/utils/buildHumanAddress');
      const addr = data.address || {};
      const comps = extractNominatimComponents(data.name || null, addr);

      const result = buildHumanAddress({
        poiName:      comps.poiName,
        neighborhood: comps.neighborhood,
        street:       comps.street,
        city:         comps.city,
        lat,
        lng,
        formattedAddress: data.display_name,
      });

      return result || null;
    } catch (error) {
      this._lastFailureAt = Date.now();
      if (!this._circuitWarnedOnce) {
        this._circuitWarnedOnce = true;
        console.warn('⚠️ Nominatim reverse geocoding unavailable (circuit open for 60s):', (error as Error).message);
      }
      throw error;
    }
  }


  /**
   * البحث عن الأماكن (Autocomplete Search)
   */
  async searchPlaces(
    query: string,
    center?: Coordinate,
    bounds?: any
  ): Promise<PlacePrediction[]> {
    try {
      // استخدام مربع إحاطة (Viewbox) ديناميكي بمدى ~20 كم حول إحداثيات المستخدم الفعلي إن وجدت
      let viewbox = bounds || this.BOUNDS;
      let useBounded = false;
      if (center && center.lat && center.lng) {
        const offset = 0.2; // حوالي 20 كم — نتائج قريبة فقط
        viewbox = {
          north: center.lat + offset,
          south: center.lat - offset,
          east: center.lng + offset,
          west: center.lng - offset,
        };
        useBounded = true;
      }

      const url = new URL(`${this.NOMINATIM_URL}/search`);
      url.searchParams.append('q', query);
      url.searchParams.append('countrycodes', 'IQ');
      url.searchParams.append('format', 'json');
      url.searchParams.append('limit', '10');
      url.searchParams.append('viewbox', `${viewbox.west},${viewbox.north},${viewbox.east},${viewbox.south}`);
      url.searchParams.append('bounded', useBounded ? '1' : '0');
      url.searchParams.append('addressdetails', '1');

      const response = await Promise.race([
        fetch(url.toString()),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Nominatim timeout')), this.TIMEOUT)
        ),
      ]);

      const data = await response.json();

      const results = (Array.isArray(data) ? data : []).map(item => ({
        place_id: item.place_id.toString(),
        main_text: item.display_name.split(',')[0].trim(),
        secondary_text: item.type || 'مكان',
        description: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        distance_meters: center ? this.haversine(center, { lat: parseFloat(item.lat), lng: parseFloat(item.lon) }) : undefined,
        type: item.type,
      }));

      // ترتيب من الأقرب إلى الأبعد حسب موقع المستخدم الحالي
      if (center) {
        results.sort((a, b) => (a.distance_meters ?? Infinity) - (b.distance_meters ?? Infinity));
      }

      return results;
    } catch (error) {
      console.error('❌ Nominatim search error:', error);
      throw error;
    }
  }

  /**
   * Haversine formula لحساب المسافة
   */
  private haversine(c1: Coordinate, c2: Coordinate): number {
    const R = 6371000; // meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(c2.lat - c1.lat);
    const dLng = toRad(c2.lng - c1.lng);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(c1.lat)) * Math.cos(toRad(c2.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.asin(Math.sqrt(a));
    return R * c;
  }
}

// ============================================================
// DEBUG
// ============================================================

if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
  console.log('🔍 NominatimGeocodingAdapter module loaded');
}
