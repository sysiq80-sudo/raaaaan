import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ArrowRight, Navigation, Loader2, MapPin, Target, AlertTriangle, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ServiceAreaCheck {
  in_service: boolean;
  region: { id: string; name_ar: string; name_en: string | null } | null;
  nearest_region: { id: string; name_ar: string; distance_km: number } | null;
}

interface MapLocationPickerProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'pickup' | 'dropoff';
  onConfirm: (location: { lat: number; lng: number; address: string; inService?: boolean }) => void;
  initialLocation?: { lat: number; lng: number } | null;
  userLocation?: { lat: number; lng: number } | null;
}

const MapLocationPicker: React.FC<MapLocationPickerProps> = ({
  isOpen,
  onClose,
  type,
  onConfirm,
  initialLocation,
  userLocation
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapToken, setMapToken] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [centerAddress, setCenterAddress] = useState<string>('');
  const [serviceAreaStatus, setServiceAreaStatus] = useState<ServiceAreaCheck | null>(null);
  const [isCheckingService, setIsCheckingService] = useState(false);
  const [isMapMoving, setIsMapMoving] = useState(false);
  const moveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef(false);

  const ramadiCenter: [number, number] = [43.2954, 33.4262];

  // Fetch Mapbox token
  useEffect(() => {
    if (!isOpen) return;
    
    const fetchToken = async () => {
      try {
        const response = await fetch(
          'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=token',
          { headers: { 'Content-Type': 'application/json' } }
        );
        const data = await response.json();
        if (data.token) setMapToken(data.token);
      } catch (error) {
        console.error('Error fetching token:', error);
      }
    };
    fetchToken();
  }, [isOpen]);

  // Check service area
  const checkServiceArea = useCallback(async (lat: number, lng: number) => {
    try {
      setIsCheckingService(true);
      const response = await fetch(
        `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/check-service-area?lat=${lat}&lng=${lng}`
      );
      const data = await response.json();
      setServiceAreaStatus(data);
      return data;
    } catch {
      return null;
    } finally {
      setIsCheckingService(false);
    }
  }, []);

  // Reverse geocode
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=reverse-geocode&lat=${lat}&lng=${lng}`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      const data = await response.json();

      if (data.features?.[0]?.place_name) {
        setCenterAddress(data.features[0].place_name);
      } else {
        // Fallback when Mapbox has no address for these coordinates
        setCenterAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }

      checkServiceArea(lat, lng);
    } catch {
      setCenterAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  }, [checkServiceArea]);

  // Initialize map
  useEffect(() => {
    if (!isOpen || !mapContainer.current || !mapToken) return;

    mapboxgl.accessToken = mapToken;

    const initialCenter = initialLocation 
      ? [initialLocation.lng, initialLocation.lat] as [number, number]
      : userLocation 
        ? [userLocation.lng, userLocation.lat] as [number, number]
        : ramadiCenter;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: initialCenter,
      zoom: 16,
      pitch: 0,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-left');

    map.current.on('load', () => {
      setIsLoading(false);
      const center = map.current?.getCenter();
      if (center) reverseGeocode(center.lat, center.lng);

      // Add user location marker if available
      if (userLocation) {
        const el = document.createElement('div');
        el.innerHTML = `
          <div class="relative">
            <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-30"></div>
            <div class="relative w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg"></div>
          </div>
        `;
        new mapboxgl.Marker(el)
          .setLngLat([userLocation.lng, userLocation.lat])
          .addTo(map.current!);
      }
    });

    map.current.on('dragstart', () => {
      setIsDragging(true);
      setIsMapMoving(true);
      isDraggingRef.current = true;
    });
    map.current.on('dragend', () => {
      setIsDragging(false);
      isDraggingRef.current = false;
      // Keep moving true until moveend
    });

    // Update address during movement with debounce
    map.current.on('move', () => {
      setIsMapMoving(true);
      if (isDraggingRef.current) {
        if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current);
        moveTimeoutRef.current = setTimeout(() => {
          const center = map.current?.getCenter();
          if (center) reverseGeocode(center.lat, center.lng);
        }, 300); // Debounce for 300ms
      }
    });

    map.current.on('moveend', () => {
      setIsMapMoving(false);
      // Clear timeout on moveend
      if (moveTimeoutRef.current) {
        clearTimeout(moveTimeoutRef.current);
        moveTimeoutRef.current = null;
      }
      // Final address update
      const center = map.current?.getCenter();
      if (center) reverseGeocode(center.lat, center.lng);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [isOpen, mapToken, initialLocation, userLocation, reverseGeocode]);

  const centerOnUser = () => {
    if (userLocation && map.current) {
      map.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 16,
        duration: 1000
      });
    }
  };

  const handleConfirm = async () => {
    if (!map.current) return;
    const center = map.current.getCenter();
    const serviceCheck = await checkServiceArea(center.lat, center.lng);
    onConfirm({
      lat: center.lat,
      lng: center.lng,
      address: centerAddress,
      inService: serviceCheck?.in_service
    });
  };

  if (!isOpen) return null;

  const isPickup = type === 'pickup';
  
  // Always use glowing blue for dropoff (destination)
  const pinColor = isPickup ? 'from-primary to-primary/80' : 'from-blue-500 to-blue-400';
  const glowColor = isPickup 
    ? '0 0 40px rgba(0, 217, 165, 0.6)' 
    : '0 0 50px rgba(59, 130, 246, 0.8), 0 0 100px rgba(59, 130, 246, 0.4)';
  const gradientColor = isPickup 
    ? 'linear-gradient(to bottom, hsl(var(--primary)), transparent)' 
    : 'linear-gradient(to bottom, #3b82f6, transparent)';
  const bgOpacity = isPickup ? 'bg-primary/30' : 'bg-blue-500/40';

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center justify-between p-4">
          <button 
            onClick={onClose}
            className="p-2.5 rounded-xl hover:bg-secondary transition-all duration-200 active:scale-95"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold flex items-center gap-2">
            {isPickup ? (
              <>
                <Target className="w-5 h-5 text-primary" />
                تحديد موقع الانطلاق
              </>
            ) : (
              <>
                <MapPin className="w-5 h-5 text-blue-500" />
                تحديد الوجهة
              </>
            )}
          </h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Top-floating confirm button */}
      <div className="absolute left-0 right-0 top-16 z-30 px-4">
        <Button
          onClick={handleConfirm}
          disabled={isCheckingService || !centerAddress || isMapMoving}
          className="w-full h-12 text-sm font-bold rounded-xl transition-all duration-300 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 disabled:from-gray-400 disabled:to-gray-500"
        >
          {isCheckingService ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isMapMoving ? (
            <span className="text-xs">انتظر حتى يتوقف الخريطة...</span>
          ) : (
            <>
              <Check className="w-5 h-5 ml-2" />
              {isPickup ? 'تأكيد موقع الانطلاق' : 'تأكيد موقع الوصول'}
            </>
          )}
        </Button>
      </div>

      {/* Map */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Center pin - with beautiful glowing effect */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
        <div className={`flex flex-col items-center transition-all duration-300 ${isDragging ? 'scale-125 -translate-y-6' : ''}`}>
          
          {/* Address label above pin */}
          <div 
            className={`mb-3 px-4 py-2.5 rounded-2xl backdrop-blur-md shadow-xl border max-w-[280px] transition-all duration-300 ${
              isDragging ? 'opacity-0 scale-90' : 'opacity-100 scale-100'
            } ${
              isPickup 
                ? 'bg-card/95 border-primary/30' 
                : 'bg-card/95 border-blue-500/30'
            }`}
            style={{
              boxShadow: isPickup 
                ? '0 4px 20px rgba(0, 217, 165, 0.15)' 
                : '0 4px 20px rgba(59, 130, 246, 0.15)'
            }}
          >
            <p className="text-xs text-muted-foreground mb-1 text-center font-medium">
              {isPickup ? 'موقع الانطلاق' : 'الوجهة'}
            </p>
            <p className="text-sm font-bold text-foreground text-center line-clamp-2 leading-relaxed">
              {centerAddress || 'جاري تحديد العنوان...'}
            </p>
          </div>
          
          {/* Outer glow ring */}
          <div 
            className={`absolute w-20 h-20 rounded-full animate-pulse ${isPickup ? 'bg-primary/20' : 'bg-blue-500/20'}`}
            style={{
              boxShadow: glowColor,
              filter: 'blur(8px)',
              top: '50%',
              transform: 'translateY(-50%)'
            }}
          />
          
          {/* Main pin circle */}
          <div 
            className={`relative w-16 h-16 rounded-full flex items-center justify-center shadow-2xl bg-gradient-to-br ${pinColor}`}
            style={{ boxShadow: glowColor }}
          >
            {/* Inner sparkle effect */}
            <div className="absolute inset-2 rounded-full bg-white/10 backdrop-blur-sm" />
            
            {isPickup ? (
              <Target className="w-8 h-8 text-white relative z-10" />
            ) : (
              <MapPin className="w-8 h-8 text-white relative z-10" />
            )}
            
            {/* Sparkle icon for destination */}
            {!isPickup && (
              <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-yellow-300 animate-pulse" />
            )}
          </div>
          
          {/* Pin stem */}
          <div 
            className="w-1.5 h-12"
            style={{ background: gradientColor }} 
          />
          
          {/* Ground shadow */}
          <div className={`w-6 h-6 rounded-full ${bgOpacity} blur-sm`} />
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-card/90 backdrop-blur-md flex items-center justify-center z-30">
          <div className="text-center">
            <div 
              className="w-14 h-14 rounded-full mx-auto mb-4"
              style={{
                background: 'conic-gradient(from 0deg, transparent, #3b82f6)',
                animation: 'spin 1s linear infinite',
                WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))'
              }}
            />
            <p className="text-muted-foreground font-medium">جاري تحميل الخريطة...</p>
          </div>
        </div>
      )}

      {/* Center on user button */}
      {userLocation && (
        <button
          onClick={centerOnUser}
          className="absolute bottom-52 left-4 w-14 h-14 bg-card/95 backdrop-blur-md rounded-2xl border border-border/50 shadow-xl flex items-center justify-center hover:bg-accent transition-all duration-200 active:scale-95 z-40 group"
        >
          <Navigation className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Top panel - Enhanced design */}
      <div className="absolute top-20 left-0 right-0 z-40 p-4">
        <div className="bg-card/95 backdrop-blur-md rounded-3xl p-5 border border-border/50 shadow-2xl">
          {/* Service area status */}
          {serviceAreaStatus && !serviceAreaStatus.in_service && (
            <div className="flex items-center gap-3 p-4 mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-amber-600">هذا الموقع خارج منطقة الخدمة</p>
                {serviceAreaStatus.nearest_region && (
                  <p className="text-amber-500/80 text-xs mt-0.5">
                    أقرب منطقة: {serviceAreaStatus.nearest_region.name_ar} ({serviceAreaStatus.nearest_region.distance_km} كم)
                  </p>
                )}
              </div>
            </div>
          )}

          {serviceAreaStatus?.in_service && serviceAreaStatus.region && (
            <div className="flex items-center gap-3 p-4 mb-4 rounded-2xl bg-primary/10 border border-primary/30">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm text-primary font-semibold">
                داخل منطقة الخدمة: {serviceAreaStatus.region.name_ar}
              </p>
            </div>
          )}

          {/* Address display */}
          <div className="flex items-start gap-4 mb-5">
            <div 
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                isPickup ? 'bg-primary/20' : 'bg-blue-500/20'
              }`}
              style={{
                boxShadow: isPickup 
                  ? '0 0 20px rgba(0, 217, 165, 0.2)' 
                  : '0 0 20px rgba(59, 130, 246, 0.2)'
              }}
            >
              {isPickup ? (
                <Target className="w-7 h-7 text-primary" />
              ) : (
                <MapPin className="w-7 h-7 text-blue-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                {isPickup ? 'موقع الانطلاق' : 'الوجهة'}
              </p>
              <p className="font-semibold text-foreground line-clamp-2 leading-relaxed">
                {centerAddress || 'جاري تحديد العنوان...'}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* All controls live in the header to avoid stacking overlays */}
    </div>
  );
};

export default MapLocationPicker;