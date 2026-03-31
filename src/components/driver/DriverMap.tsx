import { useEffect, useRef, useState } from "react";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { getMarkerIcon, getDarkMapStyle } from "@/lib/googleMapService";
import { MapPin, Loader2, AlertCircle, RefreshCw, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DriverMapProps {
  driverLocation: { lat: number; lng: number } | null;
  isOnline: boolean;
  onLocationUpdate?: () => void;
}

// خريطة بديلة عند فشل Google Maps — تعرض موقع السائق بدون تفاعل
const FallbackMapView = ({ location, isOnline }: { location: { lat: number; lng: number } | null; isOnline: boolean }) => {
  const center = location || { lat: 33.4279, lng: 43.3070 };
  const zoom = 14;
  // استخدام OpenStreetMap tile كخلفية ثابتة
  const tileUrl = `https://tile.openstreetmap.org/${zoom}/${Math.floor((center.lng + 180) / 360 * Math.pow(2, zoom))}/${Math.floor((1 - Math.log(Math.tan(center.lat * Math.PI / 180) + 1 / Math.cos(center.lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))}.png`;

  return (
    <div className="relative h-full bg-gradient-to-b from-gray-900 to-gray-800 flex flex-col items-center justify-center overflow-hidden">
      {/* خلفية OSM tiles */}
      <div className="absolute inset-0 opacity-30">
        <img src={tileUrl} className="w-full h-full object-cover" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </div>
      
      {/* محتوى الموقع */}
      <div className="relative z-10 text-center">
        {/* أيقونة الموقع */}
        <div className={`w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center ${isOnline ? 'bg-emerald-500/20 border-2 border-emerald-500' : 'bg-gray-500/20 border-2 border-gray-500'}`}>
          <Navigation className={`w-8 h-8 ${isOnline ? 'text-emerald-400' : 'text-gray-400'}`} />
        </div>
        
        {location ? (
          <>
            <p className="text-white/80 text-sm font-medium mb-1">
              {isOnline ? '📍 موقعك الحالي' : '📍 آخر موقع معروف'}
            </p>
            <p className="text-white/50 text-xs font-mono">
              {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </p>
          </>
        ) : (
          <p className="text-white/60 text-sm">جاري تحديد الموقع...</p>
        )}
      </div>
      
      {/* شريط التحذير */}
      <div className="absolute bottom-0 left-0 right-0 bg-amber-500/10 border-t border-amber-500/30 px-3 py-2">
        <p className="text-amber-400/80 text-[10px] text-center">
          ⚠️ خريطة Google Maps غير متاحة — تحقق من مفتاح API وإعدادات Google Cloud Console
        </p>
      </div>
    </div>
  );
};

export const DriverMap = ({ driverLocation, isOnline, onLocationUpdate }: DriverMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const driverMarker = useRef<google.maps.Marker | null>(null);
  const hasLoadedTilesOnceRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authFailed, setAuthFailed] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const { apiKey, isLoading: isApiKeyLoading } = useGoogleMapsApiKey();
  const retryCountRef = useRef(0);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || isApiKeyLoading) return;
    // لا يوجد مفتاح API — نعرض الخريطة البديلة مباشرة
    if (!apiKey) {
      console.warn("⚠️ Google Maps API key is empty. Check app_settings table or VITE_GOOGLE_MAPS_API_KEY env var.");
      console.warn("💡 For Capacitor apps, ensure the API key is stored in Supabase app_settings table (key: google_maps_api_key)");
      setAuthFailed(true);
      setLoading(false);
      return;
    }
    // إذا فشل المصادقة سابقاً، لا نعيد المحاولة (نعرض الخريطة البديلة)
    if (authFailed) return;

    // If map already exists, avoid reinitialization churn (e.g., frequent re-renders)
    if (map.current) {
      setLoading(false);
      setIsMapReady(true);
      return;
    }

    let isActive = true;
    let tileTimeout: ReturnType<typeof setTimeout> | null = null;

    const initMap = () => {
      try {
        setLoading(true);
        setError(null);

        // معالجة أخطاء Google Maps مثل RefererNotAllowedMapError
        window.gm_authFailure = () => {
          const currentUrl = window.location.href;
          console.error(`❌ Google Maps auth failure — URL rejected: ${currentUrl}`);
          console.error(`💡 Fix: Go to Google Cloud Console → Credentials → API Key → Add "${window.location.hostname}/*" to allowed HTTP referrers`);
          console.error(`💡 For Capacitor (mobile), also add: https://localhost/* and capacitor://localhost/*`);
          setAuthFailed(true);
          setLoading(false);
        };

        const createMap = () => {
          if (!window.google || !mapContainer.current) return;

          // Default to Ramadi center if no location
          const center = driverLocation || { lat: 33.4279, lng: 43.3070 };

          map.current = new google.maps.Map(mapContainer.current!, {
            center: new google.maps.LatLng(center.lat, center.lng),
            zoom: 14,
            mapTypeControl: false,
            fullscreenControl: false,
            streetViewControl: false,
            styles: getDarkMapStyle(),
            gestureHandling: "greedy",
          });

          // Detect silent tile failure with timeout
          let tilesLoaded = false;
          google.maps.event.addListenerOnce(map.current, 'tilesloaded', () => {
            if (!isActive) return;
            tilesLoaded = true;
            hasLoadedTilesOnceRef.current = true;
            if (tileTimeout) {
              clearTimeout(tileTimeout);
              tileTimeout = null;
            }
            setAuthFailed(false);
            setLoading(false);
            setIsMapReady(true);
            console.log('✅ DriverMap: Tiles loaded successfully');
          });

          // If tiles don't load within 15s, show fallback
          tileTimeout = setTimeout(() => {
            if (!isActive) return;
            if (!tilesLoaded && map.current) {
              const isHidden = typeof document !== 'undefined' && document.hidden;
              const containerVisible = !!mapContainer.current && mapContainer.current.clientWidth > 0 && mapContainer.current.clientHeight > 0;

              // Ignore timeout if app is backgrounded or map container is not visible yet.
              if (isHidden || !containerVisible) {
                setLoading(false);
                return;
              }

              // If tiles loaded successfully before, don't downgrade to fallback on transient network hiccups.
              if (hasLoadedTilesOnceRef.current) {
                console.warn('⚠️ DriverMap: Tiles timeout ignored (map had loaded before)');
                setLoading(false);
                return;
              }

              console.warn('⚠️ DriverMap: Tiles did not load within 15s — showing fallback');
              setAuthFailed(true);
              setLoading(false);
            }
          }, 15000);

          console.log('✅ DriverMap: Map created successfully');

          // تأخير بسيط ثم تفعيل resize لضمان ظهور البلاطات
          setTimeout(() => {
            if (map.current && window.google?.maps?.event) {
              google.maps.event.trigger(map.current, 'resize');
              map.current.setCenter(new google.maps.LatLng(center.lat, center.lng));
            }
          }, 300);

          // Add driver marker
          if (driverLocation) {
            addDriverMarker(driverLocation);
          }
        };

        // تحقق من تحميل Google Maps مسبقاً لتجنب التحميل المتكرر
        if (window.google?.maps?.Map) {
          createMap();
          return;
        }

        // تحميل عبر المحمّل المركزي
        loadGoogleMaps(apiKey).then(() => {
          createMap();
        }).catch((err) => {
          console.error("DriverMap: load error", err);
          setError("عذراً، الخريطة لا تعمل. يرجى التحقق من مفتاح API");
          setLoading(false);
        });

      } catch (err: any) {
        console.error("Map init error:", err);
        setError(err.message || "فشل في تحميل الخريطة");
        setLoading(false);
      }
    };

    initMap();

    return () => {
      isActive = false;
      if (tileTimeout) {
        clearTimeout(tileTimeout);
      }
      if (map.current) {
        map.current = null;
        setIsMapReady(false);
      }
    };
  }, [apiKey, isApiKeyLoading, authFailed]);

  // Update driver marker when location changes — SAFE: checks google.maps exists
  useEffect(() => {
    if (!isMapReady || !map.current || !driverLocation) return;
    if (!window.google?.maps) return;

    try {
      if (driverMarker.current) {
        driverMarker.current.setPosition(new google.maps.LatLng(driverLocation.lat, driverLocation.lng));
      } else {
        addDriverMarker(driverLocation);
      }

      // Center map on driver
      map.current.panTo(new google.maps.LatLng(driverLocation.lat, driverLocation.lng));
    } catch (err) {
      console.error("DriverMap: marker update error", err);
    }
  }, [driverLocation, isMapReady]);

  const addDriverMarker = (location: { lat: number; lng: number }) => {
    if (!map.current || !window.google?.maps) return;

    try {
      driverMarker.current = new google.maps.Marker({
        position: new google.maps.LatLng(location.lat, location.lng),
        map: map.current,
        title: "السائق",
        icon: getMarkerIcon("driver"),
      });
    } catch (err) {
      console.error("DriverMap: addDriverMarker error", err);
    }
  };

  const handleCenterOnDriver = () => {
    if (!isMapReady || !map.current || !driverLocation || !window.google?.maps) return;
    
    try {
      map.current.panTo(new google.maps.LatLng(driverLocation.lat, driverLocation.lng));
      map.current.setZoom(15);
    } catch (err) {
      console.error("DriverMap: centerOnDriver error", err);
    }
  };


  // عند فشل مصادقة Google Maps — عرض خريطة بديلة تعمل بشكل كامل
  if (authFailed) {
    console.warn('⚠️ DriverMap: Showing fallback — authFailed=true');
    return (
      <div className="relative h-full">
        <FallbackMapView location={driverLocation} isOnline={isOnline} />
        <div className="absolute top-3 left-3 z-10">
          <Button
            size="sm"
            variant="secondary"
            className="shadow-lg"
            onClick={() => {
              setAuthFailed(false);
              setLoading(true);
              setIsMapReady(false);
              map.current = null;
            }}
          >
            <RefreshCw className="w-4 h-4 ml-1" />
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative h-full bg-secondary/50 flex items-center justify-center">
        <div className="text-center p-4">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={() => {
              setError(null);
              setLoading(true);
              retryCountRef.current++;
              window.location.reload();
            }}
          >
            <RefreshCw className="w-4 h-4 ml-1" />
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden">
      {loading && (
        <div className="absolute inset-0 z-10 bg-secondary/80 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}
      
      <div ref={mapContainer} className="absolute inset-0 bg-gray-100 dark:bg-gray-800" />
      
      {/* Controls */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
        <Button
          size="sm"
          variant="secondary"
          className="shadow-lg"
          onClick={handleCenterOnDriver}
          disabled={!driverLocation}
        >
          <MapPin className="w-4 h-4 ml-1" />
          موقعي
        </Button>
        
        {driverLocation && (
          <div className="bg-card/90 backdrop-blur px-3 py-1.5 rounded-lg shadow text-xs">
            <span className="text-muted-foreground">
              {driverLocation.lat.toFixed(4)}, {driverLocation.lng.toFixed(4)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverMap;
