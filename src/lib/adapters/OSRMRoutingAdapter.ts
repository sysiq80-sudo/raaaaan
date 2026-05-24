/**
 * ران — OSRM Routing Adapter
 * تطبيق Open Source Routing Machine (OSRM)
 * المزايا: مجاني، سريع جداً، بدون API keys، مصدر-مفتوح
 * 
 * OSRM API: http://project-osrm.org/docs/v5.5.1/api/
 */

import type { IRoutingAdapter, RouteResult, Coordinate } from './types';
import { SERVICE_URLS, PERFORMANCE_CONFIG, FEATURE_FLAGS } from './config';

export class OSRMRoutingAdapter implements IRoutingAdapter {
  private readonly OSRM_URL = SERVICE_URLS.OSRM || 'https://router.project-osrm.org/route/v1';
  private readonly MAX_WAYPOINTS = 25; // OSRM limitation
  private readonly TIMEOUT = 8000; // milliseconds

  /**
   * تحميل — لا يوجد شيء للتحميل
   */
  async load(): Promise<void> {
    // OSRM is a simple HTTP API, no async loading needed
    return;
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
      // جمع كل الإحداثيات
      const coords: Coordinate[] = [origin, ...(waypoints || []), destination];

      if (coords.length > this.MAX_WAYPOINTS) {
        console.warn(
          `⚠️ Too many waypoints (${coords.length}), using first ${this.MAX_WAYPOINTS}`
        );
        coords.splice(this.MAX_WAYPOINTS);
      }

      // تحويل لـ OSRM format: lng,lat;lng,lat;...
      const coordString = coords.map(c => `${c.lng.toFixed(6)},${c.lat.toFixed(6)}`).join(';');

      // بناء الـ request URL
      const url = new URL(`${this.OSRM_URL}/driving/${coordString}`);
      url.searchParams.append('overview', 'full');
      url.searchParams.append('steps', 'true');
      url.searchParams.append('geometries', 'geojson');
      url.searchParams.append('annotations', 'distance,duration');
      // ملاحظة: OSRM العام لا يدعم language — لا نضيفها

      if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
        console.log('📍 OSRM Request:', url.toString());
      }

      // Fetch with timeout
      const response = await Promise.race([
        fetch(url.toString()),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('OSRM timeout')), this.TIMEOUT)
        ),
      ]);

      if (!response.ok) {
        throw new Error(`OSRM API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.code !== 'Ok') {
        throw new Error(`OSRM error: ${data.code} - ${data.message || 'Unknown'}`);
      }

      if (!data.routes || data.routes.length === 0) {
        throw new Error('OSRM: No routes found');
      }

      // استخراج البيانات من الـ response
      const route = data.routes[0];

      // الإحداثيات من GeoJSON format
      const path = route.geometry?.coordinates?.map(([lng, lat]: [number, number]) => ({
        lat,
        lng,
      })) || [];

      // استخراج الخطوات (أسماء الشوارع)
      const steps = this.extractSteps(route.legs);

      const result: RouteResult = {
        distance: route.distance,
        duration: route.duration,
        path,
        steps,
      };

      if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
        console.log('✅ OSRM route:', {
          distance: `${(route.distance / 1000).toFixed(1)}km`,
          duration: `${Math.round(route.duration / 60)}min`,
          points: path.length,
          steps: steps.length,
        });
      }

      return result;
    } catch (error) {
      console.error('❌ OSRM error:', error);
      throw error;
    }
  }

  /**
   * استخراج الخطوات من الـ legs
   */
  private extractSteps(legs: any[]): any[] {
    const steps: any[] = [];

    legs?.forEach(leg => {
      leg.steps?.forEach((step: any) => {
        if (step.name && step.distance > 0) {
          steps.push({
            name: step.name,
            distance: step.distance,
            duration: step.duration,
            instruction: step.maneuver?.instruction,
          });
        }
      });
    });

    // return only first 5 steps
    return steps.slice(0, 5);
  }

  /**
   * حساب المسافة فقط
   */
  async getDistance(origin: Coordinate, destination: Coordinate): Promise<number> {
    const result = await this.getRoute(origin, destination);
    return result.distance;
  }
}

// ============================================================
// DEBUG
// ============================================================

if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
  console.log('🛣️ OSRMRoutingAdapter module loaded');
}
