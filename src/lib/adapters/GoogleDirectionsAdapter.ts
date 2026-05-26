/**
 * ران — Google Directions Routing Adapter
 * تطبيق Google Directions API باستخدام Google Maps Web SDK
 * المزايا: دقيق جداً، متطابق مع الواقع، ملاحة حقيقية
 */

import type { IRoutingAdapter, RouteResult, Coordinate } from './types';
import { getDirections } from '@/lib/googleMapService';
import { loadGoogleMaps } from '@/lib/googleMapsLoader';
import { getGoogleMapsApiKey } from '@/hooks/useGoogleMapsApiKey';
import { FEATURE_FLAGS } from './config';

export class GoogleDirectionsAdapter implements IRoutingAdapter {
  private apiKey: string = '';

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
   * تحميل المكتبة والتحقق من المفتاح
   */
  async load(): Promise<void> {
    if (!this.apiKey) {
      this.apiKey = getGoogleMapsApiKey();
    }

    if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
      console.log(`🛣️ GoogleDirectionsAdapter loaded (key: ${this.apiKey ? '✅' : '❌ missing'})`);
    }

    if (this.apiKey && typeof window !== 'undefined' && !window.google) {
      try {
        await loadGoogleMaps(this.apiKey);
      } catch (err) {
        console.error('❌ Failed to load Google Maps SDK for GoogleDirectionsAdapter:', err);
      }
    }
  }

  /**
   * حساب المسار بين نقطتين
   */
  async getRoute(
    origin: Coordinate,
    destination: Coordinate,
    waypoints?: Coordinate[]
  ): Promise<RouteResult> {
    try {
      if (!window.google) {
        await this.load();
      }

      if (!window.google) {
        throw new Error('Google Maps SDK not loaded');
      }

      const result = await getDirections(origin, destination, waypoints);

      if (!result) {
        throw new Error('No route found from Google Directions API');
      }

      const routeResult: RouteResult = {
        distance: result.distanceMeters,
        duration: result.durationSeconds,
        path: result.route,
        steps: [
          {
            name: 'اتجه نحو الوجهة',
            distance: result.distanceMeters,
            duration: result.durationSeconds,
          }
        ]
      };

      if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
        console.log('✅ Google Directions route:', {
          distance: `${(result.distanceMeters / 1000).toFixed(1)}km`,
          duration: `${Math.round(result.durationSeconds / 60)}min`,
          points: result.route.length,
        });
      }

      return routeResult;
    } catch (error) {
      console.error('❌ GoogleDirectionsAdapter error:', error);
      throw error;
    }
  }

  /**
   * حساب المسافة فقط
   */
  async getDistance(origin: Coordinate, destination: Coordinate): Promise<number> {
    const result = await this.getRoute(origin, destination);
    return result.distance;
  }
}
