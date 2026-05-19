/**
 * ران — Google Maps Adapter
 * تطبيق Google Maps API (الفالقة/الـ backup)
 * يستخدم نفس الـ API الموجود من googleMapService.ts
 * لكن بـ IMapAdapter interface الموحد
 */

import type { IMapAdapter, Coordinate, MapOptions, MarkerOptions, PolylineOptions } from './types';
import { loadGoogleMaps } from '@/lib/googleMapsLoader';
import { FEATURE_FLAGS } from './config';

export class GoogleMapsAdapter implements IMapAdapter {
  private map: google.maps.Map | null = null;
  private apiKey: string | null = null;
  private markers: Map<string, google.maps.Marker> = new Map();
  private polylines: Map<string, google.maps.Polyline> = new Map();

  /**
   * الحصول على API key من البيئة
   */
  private getApiKey(): string {
    if (this.apiKey) return this.apiKey;

    const env = (import.meta as ImportMeta).env as Record<string, string | undefined>;
    const key = env.VITE_GOOGLE_MAPS_API_KEY || env.REACT_APP_GOOGLE_MAPS_API_KEY;
    if (!key) {
      throw new Error('VITE_GOOGLE_MAPS_API_KEY not configured');
    }

    this.apiKey = key;
    return key;
  }

  /**
   * تحميل Google Maps API
   */
  async load(): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).google?.maps) {
      console.log('✅ Google Maps already loaded');
      return;
    }

    try {
      const apiKey = this.getApiKey();
      await loadGoogleMaps(apiKey);
      console.log('✅ Google Maps loaded');
    } catch (error) {
      console.error('❌ Failed to load Google Maps:', error);
      throw new Error('Google Maps API not available');
    }
  }

  /**
   * إنشاء Google Map instance
   */
  async createMap(container: HTMLElement, options: MapOptions): Promise<google.maps.Map> {
    if (!container) {
      throw new Error('Container element required');
    }

    if (!window.google?.maps) {
      throw new Error('Google Maps not loaded');
    }

    try {
      // تراجع الـ container
      container.innerHTML = '';

      // إنشاء الخريطة
      this.map = new google.maps.Map(container, {
        center: {
          lat: options.center.lat,
          lng: options.center.lng,
        },
        zoom: options.zoom || 15,
        maxZoom: options.maxZoom,
        minZoom: options.minZoom,
        mapTypeId: 'roadmap',
        fullscreenControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        zoomControl: true,
        styles: this.getMapStyle(options.style),
      });

      // استمع لـ idle event (انتظر حتى الخريطة جاهزة)
      this.map.addListener('idle', () => {
        if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
          console.log('🗺️ Google Map is idle and ready');
        }
      });

      console.log(`✅ Google Map created at [${options.center.lat}, ${options.center.lng}]`);

      return this.map;
    } catch (error) {
      console.error('❌ Failed to create Google Map:', error);
      throw error;
    }
  }

  /**
   * الحصول على style الخريطة بناءً على الـ theme
   */
  private getMapStyle(style?: 'light' | 'dark' | 'satellite'): any {
    const styles: Record<string, any[]> = {
      light: [],
      dark: [
        { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
      ],
      satellite: [],
    };

    return styles[style || 'light'];
  }

  /**
   * إضافة marker
   */
  addMarker(coord: Coordinate, options?: MarkerOptions): void {
    if (!this.map) {
      console.warn('⚠️ Map not initialized');
      return;
    }

    try {
      const id = options?.id || `marker-${Date.now()}`;

      // إذا كان الـ marker موجود، أزله أولاً
      if (this.markers.has(id)) {
        this.markers.get(id)?.setMap(null);
      }

      // إنشاء marker جديد
      const marker = new google.maps.Marker({
        position: { lat: coord.lat, lng: coord.lng },
        map: this.map,
        title: options?.title,
        opacity: options?.opacity ?? 1,
        zIndex: options?.zIndex,
        draggable: options?.draggable || false,
        icon: options?.icon,
        animation: options?.animation,
      });

      this.markers.set(id, marker);

      if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
        console.log(`📍 Marker added: ${id} at [${coord.lat}, ${coord.lng}]`);
      }
    } catch (error) {
      console.error('❌ Failed to add marker:', error);
    }
  }

  /**
   * رسم polyline
   */
  drawPolyline(path: Coordinate[], options?: PolylineOptions): void {
    if (!this.map || !path || path.length === 0) {
      console.warn('⚠️ Cannot draw polyline - no map or empty path');
      return;
    }

    try {
      const id = options?.id || `polyline-${Date.now()}`;

      // إذا كان الـ polyline موجود، أزله أولاً
      if (this.polylines.has(id)) {
        this.polylines.get(id)?.setMap(null);
      }

      // تحويل الإحداثيات
      const path_objects = path.map(p => ({
        lat: p.lat,
        lng: p.lng,
      }));

      // رسم polyline
      const polyline = new google.maps.Polyline({
        path: path_objects,
        map: this.map,
        strokeColor: options?.strokeColor || '#00d9a5',
        strokeWeight: options?.strokeWeight || 4,
        strokeOpacity: options?.strokeOpacity || 0.8,
        clickable: options?.clickable || false,
        geodesic: options?.geodesic !== false,
      });

      this.polylines.set(id, polyline);

      if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
        console.log(`🎨 Polyline drawn: ${id} with ${path.length} points`);
      }
    } catch (error) {
      console.error('❌ Failed to draw polyline:', error);
    }
  }

  /**
   * ضبط الخريطة على bounds معين
   */
  fitBounds(bounds: any): void {
    if (!this.map) {
      console.warn('⚠️ Map not initialized');
      return;
    }

    try {
      const googleBounds = new google.maps.LatLngBounds(
        { lat: bounds.south || bounds.lat, lng: bounds.west || bounds.lng },
        { lat: bounds.north || bounds.lat, lng: bounds.east || bounds.lng }
      );

      this.map.fitBounds(googleBounds, 50);

      if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
        console.log('📐 Map bounds fitted');
      }
    } catch (error) {
      console.error('❌ Failed to fit bounds:', error);
    }
  }

  /**
   * تنظيف Resources
   */
  destroy(): void {
    try {
      // إزالة جميع الـ markers
      this.markers.forEach(marker => marker.setMap(null));
      this.markers.clear();

      // إزالة جميع الـ polylines
      this.polylines.forEach(polyline => polyline.setMap(null));
      this.polylines.clear();

      // إزالة الخريطة
      if (this.map) {
        // Google Maps doesn't have an explicit destroy method
        // Just null out the reference
        this.map = null;
      }

      console.log('✅ Google Maps adapter destroyed');
    } catch (error) {
      console.error('❌ Failed to destroy adapter:', error);
    }
  }

  /**
   * الحصول على الخريطة الحالية
   */
  getMap(): google.maps.Map | null {
    return this.map;
  }

  /**
   * الحصول على جميع الـ markers
   */
  getMarkers(): Map<string, google.maps.Marker> {
    return new Map(this.markers);
  }

  /**
   * إزالة marker محدد
   */
  removeMarker(id: string): void {
    const marker = this.markers.get(id);
    if (marker) {
      marker.setMap(null);
      this.markers.delete(id);
    }
  }

  /**
   * إزالة جميع الـ markers
   */
  clearMarkers(): void {
    this.markers.forEach(marker => marker.setMap(null));
    this.markers.clear();
  }

  /**
   * إزالة polyline محدد
   */
  removePolyline(id: string): void {
    const polyline = this.polylines.get(id);
    if (polyline) {
      polyline.setMap(null);
      this.polylines.delete(id);
    }
  }
}

// ============================================================
// DEBUG
// ============================================================

if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
  console.log('🗺️ GoogleMapsAdapter module loaded');
}
