/**
 * ران — Photon Geocoding Adapter
 * تطبيق Komoot Photon (Nominatim speedup)
 * المزايا: أسرع من Nominatim للـ search، مجاني، بدون API keys
 * 
 * Photon API: https://photon.komoot.io
 */

import type { IGeocodingAdapter, Coordinate, PlacePrediction } from './types';
import { SERVICE_URLS, SERVICE_BOUNDS, FEATURE_FLAGS } from './config';

export class PhotonGeocodingAdapter implements IGeocodingAdapter {
  private readonly PHOTON_URL = SERVICE_URLS.PHOTON || 'https://photon.komoot.io/api';
  private readonly TIMEOUT = 3000; // Photon is usually faster
  private readonly BOUNDS = SERVICE_BOUNDS;

  /**
   * تحميل — لا يوجد شيء للتحميل
   */
  async load(): Promise<void> {
    return;
  }

  /**
   * تحويل عنوان → إحداثيات
   */
  async geocode(address: string, bounds?: any): Promise<Coordinate | null> {
    try {
      const url = new URL(this.PHOTON_URL);
      url.searchParams.append('q', address);
      url.searchParams.append('limit', '1');
      url.searchParams.append('lang', 'ar');

      // Add bias to center of service area
      url.searchParams.append('lon', '43.3');
      url.searchParams.append('lat', '33.42');

      const response = await Promise.race([
        fetch(url.toString()),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Photon timeout')), this.TIMEOUT)
        ),
      ]);

      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const coords = data.features[0].geometry.coordinates;
        return { lat: coords[1], lng: coords[0] };
      }

      return null;
    } catch (error) {
      console.error('❌ Photon geocoding error:', error);
      throw error;
    }
  }

  /**
   * تحويل إحداثيات → عنوان
   * ملاحظة: Photon لا يدعم reverse geocoding، استخدم Nominatim بدلاً منه
   */
  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    // Photon doesn't support reverse geocoding
    throw new Error('Photon does not support reverse geocoding. Use Nominatim instead.');
  }

  /**
   * البحث عن الأماكن (Autocomplete)
   */
  async searchPlaces(
    query: string,
    center?: Coordinate,
    bounds?: any
  ): Promise<PlacePrediction[]> {
    try {
      const url = new URL(this.PHOTON_URL);
      url.searchParams.append('q', query);
      url.searchParams.append('limit', '10');
      url.searchParams.append('lang', 'ar');

      // Add center bias
      if (center) {
        url.searchParams.append('lon', center.lng.toString());
        url.searchParams.append('lat', center.lat.toString());
      } else {
        // Default to Ramadi center
        url.searchParams.append('lon', '43.3');
        url.searchParams.append('lat', '33.42');
      }

      const response = await Promise.race([
        fetch(url.toString()),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Photon timeout')), this.TIMEOUT)
        ),
      ]);

      const data = await response.json();

      return (data.features || []).map((feature: any) => {
        const props = feature.properties;
        const coords = feature.geometry.coordinates;

        return {
          place_id: props.osm_id?.toString() || `photon-${Date.now()}`,
          main_text: props.name || 'مكان',
          secondary_text: props.type || 'تفاصيل',
          description: props.street ? `${props.name}, ${props.street}` : props.name,
          lat: coords[1],
          lng: coords[0],
          type: props.type,
          distance_meters: center ? this.haversine(center, { lat: coords[1], lng: coords[0] }) : undefined,
        };
      });
    } catch (error) {
      console.error('❌ Photon search error:', error);
      throw error;
    }
  }

  /**
   * Haversine formula
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
  console.log('⚡ PhotonGeocodingAdapter module loaded');
}
