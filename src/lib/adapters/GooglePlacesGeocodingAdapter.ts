/**
 * ران — Google Places Geocoding Adapter
 * تطبيق Google Places API + Geocoding API
 *
 * الوظائف:
 * - geocode: عنوان → إحداثيات (Geocoding API)
 * - reverseGeocode: إحداثيات → عنوان (Geocoding API)
 * - searchPlaces: بحث أماكن (Places API — Text Search)
 *
 * المتطلبات:
 * - API Key مع تفعيل: Places API, Geocoding API
 * - التكلفة: ~$17/1000 طلب (Text Search) — مشمول بـ $200 credit المجاني
 *
 * @see https://developers.google.com/maps/documentation/places/web-service
 * @see https://developers.google.com/maps/documentation/geocoding
 */

import type { IGeocodingAdapter, Coordinate, PlacePrediction, BoundsLike } from './types';
import { SERVICE_BOUNDS, FEATURE_FLAGS } from './config';

export class GooglePlacesGeocodingAdapter implements IGeocodingAdapter {
  private apiKey: string;
  private readonly TIMEOUT = 6000;
  private readonly BOUNDS = SERVICE_BOUNDS;

  // Google API endpoints
  private readonly GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
  private readonly PLACES_TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || '';
  }

  /**
   * تعيين المفتاح (يمكن تأخير التعيين)
   */
  setApiKey(key: string): void {
    this.apiKey = key;
  }

  /**
   * تحميل — التحقق من وجود المفتاح
   */
  async load(): Promise<void> {
    if (!this.apiKey) {
      // Try to get from env
      const envKey = (import.meta as ImportMeta).env?.VITE_GOOGLE_MAPS_API_KEY;
      if (envKey && typeof envKey === 'string' && envKey.length > 10) {
        this.apiKey = envKey;
      }
    }

    if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
      console.log(`🔍 GooglePlacesGeocodingAdapter loaded (key: ${this.apiKey ? '✅' : '❌ missing'})`);
    }
  }

  /**
   * التحقق من صلاحية المفتاح
   */
  private ensureApiKey(): void {
    if (!this.apiKey) {
      throw new Error('Google Places API key not configured');
    }
  }

  /**
   * طلب HTTP مع timeout
   */
  private async fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
    return Promise.race([
      fetch(url, options),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Google API timeout')), this.TIMEOUT)
      ),
    ]);
  }

  // ════════════════════════════════════════════════════════════
  // Geocoding (عنوان → إحداثيات)
  // ════════════════════════════════════════════════════════════

  async geocode(address: string, bounds?: BoundsLike): Promise<Coordinate | null> {
    this.ensureApiKey();

    try {
      const viewbox = bounds || this.BOUNDS;
      const url = new URL(this.GEOCODING_URL);
      url.searchParams.append('address', address);
      url.searchParams.append('key', this.apiKey);
      url.searchParams.append('language', 'ar');
      url.searchParams.append('region', 'iq');

      // Bias to service area
      if (viewbox && 'south' in viewbox && 'north' in viewbox) {
        url.searchParams.append(
          'bounds',
          `${viewbox.south},${viewbox.west}|${viewbox.north},${viewbox.east}`
        );
      }

      const response = await this.fetchWithTimeout(url.toString());
      const data = await response.json();

      if (data.status === 'OK' && data.results?.length > 0) {
        const loc = data.results[0].geometry.location;
        return { lat: loc.lat, lng: loc.lng };
      }

      if (data.status === 'REQUEST_DENIED') {
        throw new Error(`Google API denied: ${data.error_message || 'Check API key'}`);
      }

      return null;
    } catch (error) {
      console.error('❌ Google geocoding error:', error);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════
  // Reverse Geocoding (إحداثيات → عنوان)
  // ════════════════════════════════════════════════════════════

  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    this.ensureApiKey();

    try {
      const url = new URL(this.GEOCODING_URL);
      url.searchParams.append('latlng', `${lat},${lng}`);
      url.searchParams.append('key', this.apiKey);
      url.searchParams.append('language', 'ar');
      url.searchParams.append('result_type', 'street_address|route|neighborhood|sublocality|locality');

      const response = await this.fetchWithTimeout(url.toString());
      const data = await response.json();

      if (data.status === 'OK' && data.results?.length > 0) {
        return data.results[0].formatted_address || null;
      }

      if (data.status === 'REQUEST_DENIED') {
        throw new Error(`Google API denied: ${data.error_message || 'Check API key'}`);
      }

      return null;
    } catch (error) {
      console.error('❌ Google reverse geocoding error:', error);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════
  // Place Search (بحث أماكن — Places API Legacy Text Search)
  // ════════════════════════════════════════════════════════════

  async searchPlaces(
    query: string,
    center?: Coordinate,
    bounds?: BoundsLike
  ): Promise<PlacePrediction[]> {
    this.ensureApiKey();

    try {
      // Use legacy Places API — Text Search
      const centerCoord = center || { lat: 33.4233, lng: 43.2974 }; // الرمادي default

      const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
      url.searchParams.append('query', query);
      url.searchParams.append('key', this.apiKey);
      url.searchParams.append('language', 'ar');
      url.searchParams.append('region', 'iq');
      url.searchParams.append('location', `${centerCoord.lat},${centerCoord.lng}`);
      url.searchParams.append('radius', '50000'); // 50km

      const response = await this.fetchWithTimeout(url.toString());
      const data = await response.json();

      if (data.status === 'REQUEST_DENIED') {
        throw new Error(`Google Places denied: ${data.error_message || 'Check API key & Places API enabled'}`);
      }

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places error: ${data.status} — ${data.error_message || ''}`);
      }

      const results = data.results || [];

      return results.slice(0, 10).map((place: any) => {
        const lat = place.geometry?.location?.lat || 0;
        const lng = place.geometry?.location?.lng || 0;

        return {
          place_id: place.place_id || '',
          main_text: place.name || '',
          secondary_text: place.types?.[0]?.replace(/_/g, ' ') || 'مكان',
          description: place.formatted_address || '',
          lat,
          lng,
          distance_meters: center ? this.haversine(center, { lat, lng }) : undefined,
          type: place.types?.[0] || 'place',
        } as PlacePrediction;
      });
    } catch (error) {
      console.error('❌ Google Places search error:', error);
      throw error;
    }
  }

  /**
   * Haversine formula لحساب المسافة
   */
  private haversine(c1: Coordinate, c2: Coordinate): number {
    const R = 6371000;
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
  console.log('🔍 GooglePlacesGeocodingAdapter module loaded');
}
