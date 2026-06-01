/**
 * ران — LeafletMap Component
 * مكوّن React عام يغلّف Leaflet لجميع خرائط التطبيق
 * يدعم: center, zoom, onMove, onDragStart, onDragEnd, onIdle, markers, polylines
 * يستخدم CartoDB Voyager tiles (أجمل من OSM الافتراضي)
 */

import { useEffect, useRef, useCallback, memo } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SERVICE_URLS, RAMADI_CENTER } from '@/lib/adapters/config';

// ============================================================
// Types
// ============================================================

export interface LeafletMapProps {
  /** مركز الخريطة */
  center?: { lat: number; lng: number };
  /** مستوى التقريب */
  zoom?: number;
  /** هل الخريطة تتفاعل */
  interactive?: boolean;
  /** CSS class للحاوية */
  className?: string;
  /** style للحاوية */
  style?: React.CSSProperties;

  // أحداث
  onMapReady?: (map: L.Map) => void;
  onMoveStart?: () => void;
  onMoveEnd?: (center: { lat: number; lng: number }) => void;
  onDragStart?: () => void;
  onDragEnd?: (center: { lat: number; lng: number }) => void;
  onIdle?: (center: { lat: number; lng: number }) => void;
  onZoomEnd?: (zoom: number) => void;

  /** أطفال (overlays, markers, etc.) */
  children?: React.ReactNode;

  /** معرّف فريد للخريطة (لمنع التكرار) */
  mapId?: string;

  /** dark mode */
  darkMode?: boolean;

  /** عرض attribution */
  showAttribution?: boolean;

  /** عرض أزرار التقريب */
  showZoomControl?: boolean;

  /** الحد الأقصى للتقريب */
  maxZoom?: number;

  /** الحد الأدنى للتقريب */
  minZoom?: number;
}

// ============================================================
// Component
// ============================================================

const LeafletMapInner = ({
  center,
  zoom = 15,
  interactive = true,
  className = '',
  style,
  onMapReady,
  onMoveStart,
  onMoveEnd,
  onDragStart,
  onDragEnd,
  onIdle,
  onZoomEnd,
  children,
  mapId,
  darkMode = false,
  showAttribution = false,
  showZoomControl = false,
  maxZoom = 19,
  minZoom = 3,
}: LeafletMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const isUserDragging = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Callbacks refs (لتجنب re-renders)
  const onMapReadyRef = useRef(onMapReady);
  const onMoveStartRef = useRef(onMoveStart);
  const onMoveEndRef = useRef(onMoveEnd);
  const onDragStartRef = useRef(onDragStart);
  const onDragEndRef = useRef(onDragEnd);
  const onIdleRef = useRef(onIdle);
  const onZoomEndRef = useRef(onZoomEnd);

  // تحديث refs
  useEffect(() => { onMapReadyRef.current = onMapReady; }, [onMapReady]);
  useEffect(() => { onMoveStartRef.current = onMoveStart; }, [onMoveStart]);
  useEffect(() => { onMoveEndRef.current = onMoveEnd; }, [onMoveEnd]);
  useEffect(() => { onDragStartRef.current = onDragStart; }, [onDragStart]);
  useEffect(() => { onDragEndRef.current = onDragEnd; }, [onDragEnd]);
  useEffect(() => { onIdleRef.current = onIdle; }, [onIdle]);
  useEffect(() => { onZoomEndRef.current = onZoomEnd; }, [onZoomEnd]);

  // ── إنشاء الخريطة ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const mapCenter = center || RAMADI_CENTER;

    const map = L.map(containerRef.current, {
      center: [mapCenter.lat, mapCenter.lng],
      zoom,
      zoomControl: showZoomControl,
      attributionControl: showAttribution,
      dragging: interactive,
      touchZoom: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      tap: interactive,
    } as L.MapOptions);

    // Tile layer — CartoDB Voyager (light) أو Dark Matter (dark)
    const tileUrl = darkMode 
      ? SERVICE_URLS.CARTODB_DARK 
      : SERVICE_URLS.CARTODB_VOYAGER;

    const tileLayer = L.tileLayer(tileUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom,
      minZoom,
      subdomains: 'abcd',
    }).addTo(map);

    tileLayerRef.current = tileLayer;
    mapRef.current = map;

    // ── أحداث الخريطة ──
    map.on('movestart', () => {
      onMoveStartRef.current?.();
    });

    map.on('moveend', () => {
      const c = map.getCenter();
      onMoveEndRef.current?.({ lat: c.lat, lng: c.lng });

      // Idle simulation (Leaflet ليس عنده idle event مثل Google)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        const center = map.getCenter();
        onIdleRef.current?.({ lat: center.lat, lng: center.lng });
      }, 200);
    });

    map.on('dragstart', () => {
      isUserDragging.current = true;
      onDragStartRef.current?.();
    });

    map.on('dragend', () => {
      isUserDragging.current = false;
      const c = map.getCenter();
      onDragEndRef.current?.({ lat: c.lat, lng: c.lng });
    });

    map.on('zoomend', () => {
      onZoomEndRef.current?.(map.getZoom());
    });

    // إخبار المكوّن الأب
    onMapReadyRef.current?.(map);

    // Fix: Leaflet يحتاج invalidateSize بعد render
    requestAnimationFrame(() => {
      map.invalidateSize();
    });

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
    };
  }, []); // مرة واحدة فقط

  // ── تحديث المركز من الأب ──
  useEffect(() => {
    if (!mapRef.current || !center) return;
    const currentCenter = mapRef.current.getCenter();
    const dist = Math.abs(currentCenter.lat - center.lat) + Math.abs(currentCenter.lng - center.lng);
    // تجاهل التغييرات الصغيرة جداً (أقل من ~10 متر)
    if (dist > 0.0001 && !isUserDragging.current) {
      mapRef.current.setView([center.lat, center.lng], mapRef.current.getZoom(), {
        animate: true,
        duration: 0.3,
      });
    }
  }, [center?.lat, center?.lng]);

  // ── تحديث الزوم ──
  useEffect(() => {
    if (!mapRef.current) return;
    if (mapRef.current.getZoom() !== zoom) {
      mapRef.current.setZoom(zoom);
    }
  }, [zoom]);

  // ── تبديل dark/light tiles ──
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    const tileUrl = darkMode 
      ? SERVICE_URLS.CARTODB_DARK 
      : SERVICE_URLS.CARTODB_VOYAGER;
    tileLayerRef.current.setUrl(tileUrl);
  }, [darkMode]);

  return (
    <div
      ref={containerRef}
      id={mapId}
      className={`leaflet-map-container ${className}`}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        ...style,
      }}
    />
  );
};

export const LeafletMap = memo(LeafletMapInner);

// ============================================================
// Utility: الحصول على map instance من ref
// ============================================================

export const useLeafletMap = () => {
  const mapRef = useRef<L.Map | null>(null);

  const setMap = useCallback((map: L.Map) => {
    mapRef.current = map;
  }, []);

  return { mapRef, setMap };
};

export default LeafletMap;
