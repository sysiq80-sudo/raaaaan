/**
 * ران — Haversine Routing Adapter
 * fallback بسيط عند فشل جميع الـ routing providers
 * يستخدم صيغة Haversine لحساب المسافة بين نقطتين
 */

import type { IRoutingAdapter, RouteResult, Coordinate } from './types';
import { FEATURE_FLAGS } from './config';

export class HaversineRoutingAdapter implements IRoutingAdapter {
  private readonly EARTH_RADIUS_METERS = 6371000; // Earth radius in meters
  private readonly AVERAGE_SPEED_KMPH = 50; // Assume 50 km/h average

  /**
   * تحميل — لا يوجد شيء للتحميل
   */
  async load(): Promise<void> {
    return;
  }

  /**
   * حساب المسار (fallback بسيط)
   */
  async getRoute(
    origin: Coordinate,
    destination: Coordinate,
    waypoints?: Coordinate[]
  ): Promise<RouteResult> {
    try {
      // حساب المسافة بين النقطتين
      const distance = this.haversine(origin, destination);

      // تقدير المدة (بافتراض سرعة ثابتة)
      const duration = (distance / (this.AVERAGE_SPEED_KMPH / 3.6)); // seconds

      // إنشاء مسار تقريبي بين النقطتين
      const path = this.interpolatePath(origin, destination, 20);

      const result: RouteResult = {
        distance,
        duration,
        path,
        steps: [
          {
            name: 'اتجه نحو الوجهة',
            distance,
            duration,
          },
        ],
      };

      if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
        console.log('⚠️ Using Haversine fallback:', {
          distance: `${(distance / 1000).toFixed(1)}km`,
          duration: `${Math.round(duration / 60)}min`,
        });
      }

      return result;
    } catch (error) {
      console.error('❌ Haversine error:', error);
      throw error;
    }
  }

  /**
   * حساب المسافة فقط
   */
  async getDistance(origin: Coordinate, destination: Coordinate): Promise<number> {
    return this.haversine(origin, destination);
  }

  /**
   * صيغة Haversine — حساب أقصر مسافة بين نقطتين على الكرة الأرضية
   *
   * a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
   * c = 2 × atan2(√a, √(1−a))
   * d = R × c
   */
  private haversine(from: Coordinate, to: Coordinate): number {
    const toRad = (degrees: number): number => (degrees * Math.PI) / 180;

    const lat1 = toRad(from.lat);
    const lat2 = toRad(to.lat);
    const dLat = toRad(to.lat - from.lat);
    const dLng = toRad(to.lng - from.lng);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.asin(Math.sqrt(a));

    return this.EARTH_RADIUS_METERS * c;
  }

  /**
   * إنشاء مسار تقريبي بين نقطتين
   * بـ linear interpolation
   */
  private interpolatePath(from: Coordinate, to: Coordinate, numPoints: number): Coordinate[] {
    const path: Coordinate[] = [from];

    for (let i = 1; i < numPoints - 1; i++) {
      const t = i / (numPoints - 1);
      path.push({
        lat: from.lat + (to.lat - from.lat) * t,
        lng: from.lng + (to.lng - from.lng) * t,
      });
    }

    path.push(to);
    return path;
  }
}

// ============================================================
// DEBUG
// ============================================================

if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
  console.log('📏 HaversineRoutingAdapter module loaded');
}
