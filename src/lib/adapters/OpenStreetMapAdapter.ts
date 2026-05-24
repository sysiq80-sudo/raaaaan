/**
 * ران — OpenStreetMap Adapter
 * تطبيق Leaflet + OpenStreetMap tiles
 * المزايا: مجاني، بدون API keys، بدون rate limits
 */

import type { IMapAdapter, Coordinate, MapOptions, MarkerOptions, PolylineOptions } from './types';
import type L from 'leaflet';

export class OpenStreetMapAdapter implements IMapAdapter {
  private map: any = null; // L.Map
  private markers: Map<string, any> = new Map(); // id -> L.Marker
  private polylines: Map<string, any> = new Map(); // id -> L.Polyline
  private leafletPromise: Promise<any> | null = null;

  /**
   * تحميل مكتبة Leaflet (إذا لم تكن محملة)
   */
  async load(): Promise<void> {
    if (this.leafletPromise) {
      return this.leafletPromise;
    }

    this.leafletPromise = (async () => {
      // Check if Leaflet is already available
      if (typeof window !== 'undefined' && (window as any).L) {
        console.log('✅ Leaflet already loaded');
        return;
      }

      // Dynamically import Leaflet
      try {
        const L = await import('leaflet');
        console.log('✅ Leaflet imported dynamically');

        // Import CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        return L.default;
      } catch (error) {
        console.error('❌ Failed to load Leaflet:', error);
        throw new Error('Leaflet not available');
      }
    })();

    return this.leafletPromise;
  }

  /**
   * إنشاء خريطة Leaflet
   */
  async createMap(container: HTMLElement, options: MapOptions): Promise<any> {
    if (!container) {
      throw new Error('Container element required');
    }

    const L = (window as any).L;
    if (!L) {
      throw new Error('Leaflet not loaded');
    }

    try {
      // تراجع الـ container
      container.innerHTML = '';

      // إنشاء الخريطة
      this.map = L.map(container).setView(
        [options.center.lat, options.center.lng],
        options.zoom || 15
      );

      // إضافة OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        minZoom: 3,
        className: 'osm-tiles',
      }).addTo(this.map);

      console.log(`✅ OpenStreetMap created at [${options.center.lat}, ${options.center.lng}]`);

      return this.map;
    } catch (error) {
      console.error('❌ Failed to create OpenStreetMap:', error);
      throw error;
    }
  }

  /**
   * إضافة marker على الخريطة
   */
  addMarker(coord: Coordinate, options?: MarkerOptions): void {
    if (!this.map) {
      console.warn('⚠️ Map not initialized');
      return;
    }

    const L = (window as any).L;

    try {
      const id = options?.id || `marker-${Date.now()}`;

      // إذا كان الـ marker موجود، أزله أولاً
      if (this.markers.has(id)) {
        this.map.removeLayer(this.markers.get(id));
      }

      // إنشاء marker جديد
      const marker = L.marker([coord.lat, coord.lng], {
        opacity: options?.opacity || 1,
        zIndexOffset: options?.zIndex || 0,
        title: options?.title,
        draggable: options?.draggable || false,
      });

      // إضافة icon إذا كان معرّف
      if (options?.icon) {
        marker.setIcon(options.icon);
      }

      marker.addTo(this.map);
      this.markers.set(id, marker);

      if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
        console.log(`📍 Marker added: ${id} at [${coord.lat}, ${coord.lng}]`);
      }
    } catch (error) {
      console.error('❌ Failed to add marker:', error);
    }
  }

  /**
   * رسم polyline (خط) على الخريطة
   */
  drawPolyline(path: Coordinate[], options?: PolylineOptions): void {
    if (!this.map || !path || path.length === 0) {
      console.warn('⚠️ Cannot draw polyline - no map or empty path');
      return;
    }

    const L = (window as any).L;

    try {
      const id = options?.id || `polyline-${Date.now()}`;

      // إذا كان الـ polyline موجود، أزله أولاً
      if (this.polylines.has(id)) {
        this.map.removeLayer(this.polylines.get(id));
      }

      // تحويل الإحداثيات لـ Leaflet format
      const latlngs = path.map(p => [p.lat, p.lng]);

      // رسم polyline
      const polyline = L.polyline(latlngs, {
        color: options?.strokeColor || '#00d9a5',
        weight: options?.strokeWeight || 4,
        opacity: options?.strokeOpacity || 0.8,
        className: 'route-polyline',
        smoothFactor: 1.0, // performance
        dashArray: options?.strokeColor?.includes('dashed') ? '5, 5' : undefined,
      }).addTo(this.map);

      this.polylines.set(id, polyline);

      if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
        console.log(`🎨 Polyline drawn: ${id} with ${path.length} points`);
      }
    } catch (error) {
      console.error('❌ Failed to draw polyline:', error);
    }
  }

  /**
   * ضبط الخريطة لعرض نطاق معين
   */
  fitBounds(bounds: any): void {
    if (!this.map) {
      console.warn('⚠️ Map not initialized');
      return;
    }

    const L = (window as any).L;

    try {
      const latLngBounds = L.latLngBounds(
        [bounds.south || bounds.lat, bounds.west || bounds.lng],
        [bounds.north || bounds.lat, bounds.east || bounds.lng]
      );

      this.map.fitBounds(latLngBounds, {
        padding: [50, 50],
        maxZoom: 16,
      });

      if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
        console.log('📐 Map bounds fitted');
      }
    } catch (error) {
      console.error('❌ Failed to fit bounds:', error);
    }
  }

  /**
   * تنظيف الـ resources
   */
  destroy(): void {
    try {
      // إزالة جميع الـ markers
      this.markers.forEach(marker => {
        if (this.map) {
          this.map.removeLayer(marker);
        }
      });
      this.markers.clear();

      // إزالة جميع الـ polylines
      this.polylines.forEach(polyline => {
        if (this.map) {
          this.map.removeLayer(polyline);
        }
      });
      this.polylines.clear();

      // إزالة الخريطة
      if (this.map) {
        this.map.remove();
        this.map = null;
      }

      console.log('✅ OpenStreetMap adapter destroyed');
    } catch (error) {
      console.error('❌ Failed to destroy adapter:', error);
    }
  }

  /**
   * الحصول على الخريطة الحالية (للـ debugging/customization)
   */
  getMap(): any {
    return this.map;
  }

  /**
   * الحصول على جميع الـ markers
   */
  getMarkers(): Map<string, any> {
    return new Map(this.markers);
  }

  /**
   * إزالة marker محدد
   */
  removeMarker(id: string): void {
    const marker = this.markers.get(id);
    if (marker && this.map) {
      this.map.removeLayer(marker);
      this.markers.delete(id);
    }
  }

  /**
   * إزالة جميع الـ markers
   */
  clearMarkers(): void {
    this.markers.forEach(marker => {
      if (this.map) {
        this.map.removeLayer(marker);
      }
    });
    this.markers.clear();
  }

  /**
   * إزالة polyline محدد
   */
  removePolyline(id: string): void {
    const polyline = this.polylines.get(id);
    if (polyline && this.map) {
      this.map.removeLayer(polyline);
      this.polylines.delete(id);
    }
  }
}

// ============================================================
// HELPER: Create custom icon for Leaflet
// ============================================================

export const createLeafletIcon = (options: any) => {
  const L = (window as any).L;

  if (!L) {
    console.error('Leaflet not available');
    return undefined;
  }

  return L.icon({
    iconUrl: options.iconUrl || 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconSize: options.iconSize || [25, 41],
    iconAnchor: options.iconAnchor || [12, 41],
    popupAnchor: options.popupAnchor || [1, -34],
    shadowUrl: options.shadowUrl || 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    shadowSize: options.shadowSize || [41, 41],
    shadowAnchor: options.shadowAnchor || [12, 41],
    className: options.className || 'marker-icon',
  });
};

// ============================================================
// DEBUG
// ============================================================

import { FEATURE_FLAGS } from './config';

if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
  console.log('🗺️ OpenStreetMapAdapter module loaded');
}
