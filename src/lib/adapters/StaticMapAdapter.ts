/**
 * ران — Static Map Adapter
 * fallback بسيط عند فشل جميع الـ providers الأخرى
 * يعرض صورة static من Mapbox Static API
 */

import type { IMapAdapter, Coordinate, MapOptions, MarkerOptions, PolylineOptions } from './types';

export class StaticMapAdapter implements IMapAdapter {
  private container: HTMLElement | null = null;
  private mapboxToken = ((import.meta as ImportMeta).env as Record<string, string | undefined>).VITE_MAPBOX_TOKEN ||
    ((import.meta as ImportMeta).env as Record<string, string | undefined>).REACT_APP_MAPBOX_TOKEN ||
    'pk.public.static';

  /**
   * تحميل — لا يوجد شيء للتحميل
   */
  async load(): Promise<void> {
    // Static images don't require async loading
    return;
  }

  /**
   * إنشاء خريطة static
   */
  async createMap(container: HTMLElement, options: MapOptions): Promise<null> {
    if (!container) {
      throw new Error('Container element required');
    }

    this.container = container;

    try {
      const { lat, lng } = options.center;
      const zoom = options.zoom || 15;
      const width = container.clientWidth || 400;
      const height = container.clientHeight || 400;

      // بناء Mapbox Static API URL
      const staticUrl = this.buildMapboxStaticUrl(lng, lat, zoom, width, height);

      // إنشاء HTML بسيط
      container.innerHTML = `
        <div style="position: relative; width: 100%; height: 100%; background: #f0f0f0; overflow: hidden;">
          <img 
            src="${staticUrl}" 
            alt="Static Map" 
            style="width: 100%; height: 100%; object-fit: cover; display: block;"
            onerror="this.src = 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22400%22><rect fill=%22%23f0f0f0%22 width=%22400%22 height=%22400%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2216%22 fill=%22%23999%22>Map Unavailable</text></svg>'"
          />
          <div style="
            position: absolute;
            bottom: 8px;
            left: 8px;
            background: rgba(255, 255, 255, 0.9);
            padding: 4px 8px;
            border-radius: 2px;
            font-size: 12px;
            font-weight: 500;
            color: #666;
            z-index: 100;
          ">
            📍 Static Map (APIs Offline)
          </div>
        </div>
      `;

      console.log(`✅ Static map created at [${lat}, ${lng}] (${width}x${height})`);
      return null;
    } catch (error) {
      console.error('❌ Failed to create static map:', error);
      throw error;
    }
  }

  /**
   * بناء Mapbox Static API URL
   */
  private buildMapboxStaticUrl(
    lng: number,
    lat: number,
    zoom: number,
    width: number,
    height: number
  ): string {
    // Mapbox Static API format:
    // https://api.mapbox.com/styles/v1/{username}/{id}/static/{lon},{lat},{zoom},{bearing},{pitch}/{width}x{height}{@2x}

    const style = 'mapbox/streets-v11';
    const bearing = 0;
    const pitch = 0;
    const retina = '@2x'; // High DPI

    // Clamp dimensions
    const clampedWidth = Math.min(Math.max(width, 100), 1280);
    const clampedHeight = Math.min(Math.max(height, 100), 1280);

    return (
      `https://api.mapbox.com/styles/v1/${style}/static/` +
      `${lng},${lat},${zoom},${bearing},${pitch}/` +
      `${clampedWidth}x${clampedHeight}${retina}` +
      `?access_token=${this.mapboxToken}`
    );
  }

  /**
   * إضافة marker — لا-op لأن الصورة static
   */
  addMarker(coord: Coordinate, options?: MarkerOptions): void {
    if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
      console.warn('⚠️ Static map: markers not supported');
    }
  }

  /**
   * رسم polyline — لا-op
   */
  drawPolyline(path: Coordinate[], options?: PolylineOptions): void {
    if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
      console.warn('⚠️ Static map: polylines not supported');
    }
  }

  /**
   * ضبط الخريطة — لا-op
   */
  fitBounds(bounds: any): void {
    if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
      console.warn('⚠️ Static map: fitBounds not supported');
    }
  }

  /**
   * تنظيف الـ resources
   */
  destroy(): void {
    try {
      if (this.container) {
        this.container.innerHTML = '';
        this.container = null;
      }
      console.log('✅ Static map adapter destroyed');
    } catch (error) {
      console.error('❌ Failed to destroy static map:', error);
    }
  }
}

// ============================================================
// DEBUG
// ============================================================

import { FEATURE_FLAGS } from './config';

if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
  console.log('🖼️ StaticMapAdapter module loaded');
}
