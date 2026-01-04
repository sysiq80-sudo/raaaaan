import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { AlertCircle } from 'lucide-react';

interface NearbyDriversMiniMapProps {
  drivers: Array<{ id: string; lat: number; lng: number }>;
  userLocation: { lat: number; lng: number };
  pickupLocation?: { lat: number; lng: number };
  dropoffLocation?: { lat: number; lng: number };
  height?: string;
}

export const NearbyDriversMiniMap: React.FC<NearbyDriversMiniMapProps> = ({
  drivers,
  userLocation,
  pickupLocation,
  dropoffLocation,
  height = 'h-40'
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!mapContainer.current) return;

    try {
      // التحقق من وجود مفتاح Mapbox
      if (!mapboxgl.accessToken) {
        console.warn('Mapbox token not configured');
        return;
      }

      // إنشاء الخريطة
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [userLocation.lng, userLocation.lat],
        zoom: 15,
        interactive: false,
        attributionControl: false
      });

      // إضافة علامات بعد تحميل الخريطة
      map.current.on('load', () => {
        updateMarkers();
      });

      return () => {
        if (map.current) {
          map.current.remove();
          map.current = null;
        }
      };
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }, [userLocation]);

  const updateMarkers = () => {
    if (!map.current) return;

    // حذف العلامات القديمة
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // إضافة علامة المستخدم
    const userMarker = new mapboxgl.Marker({ color: '#3b82f6' })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map.current);
    markersRef.current.push(userMarker);

    // إضافة علامات السائقين
    drivers.forEach(driver => {
      const driverMarker = new mapboxgl.Marker({
        color: '#10b981',
        scale: 0.8
      })
        .setLngLat([driver.lng, driver.lat])
        .addTo(map.current!);
      markersRef.current.push(driverMarker);
    });

    // إضافة علامة نقطة الالتقاط إذا كانت موجودة
    if (pickupLocation) {
      const pickupMarker = new mapboxgl.Marker({ color: '#f59e0b' })
        .setLngLat([pickupLocation.lng, pickupLocation.lat])
        .addTo(map.current);
      markersRef.current.push(pickupMarker);
    }

    // إضافة علامة الوجهة إذا كانت موجودة
    if (dropoffLocation) {
      const dropoffMarker = new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat([dropoffLocation.lng, dropoffLocation.lat])
        .addTo(map.current);
      markersRef.current.push(dropoffMarker);
    }

    // ضبط حدود الخريطة لتظهير جميع العلامات
    if (markersRef.current.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([userLocation.lng, userLocation.lat]);
      
      drivers.forEach(driver => {
        bounds.extend([driver.lng, driver.lat]);
      });
      
      if (pickupLocation) {
        bounds.extend([pickupLocation.lng, pickupLocation.lat]);
      }
      
      if (dropoffLocation) {
        bounds.extend([dropoffLocation.lng, dropoffLocation.lat]);
      }

      map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
    }
  };

  useEffect(() => {
    updateMarkers();
  }, [drivers, pickupLocation, dropoffLocation]);

  return (
    <div className={`relative ${height} rounded-lg overflow-hidden border border-border shadow-md`}>
      <div ref={mapContainer} className="w-full h-full bg-muted" />
      
      {/* وسيلة الإيضاح */}
      <div className="absolute top-2 right-2 bg-background/95 backdrop-blur-sm rounded-lg shadow-md p-2 text-xs space-y-1 z-10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>أنت</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>السائقون ({drivers.length})</span>
        </div>
        {pickupLocation && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span>الالتقاط</span>
          </div>
        )}
        {dropoffLocation && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>الوجهة</span>
          </div>
        )}
      </div>

      {/* رسالة تحذير إذا لم تكن هناك سائقين */}
      {drivers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">لا توجد سائقون قريبون</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NearbyDriversMiniMap;
