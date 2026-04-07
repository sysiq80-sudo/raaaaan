import { useEffect, useRef, useState } from "react";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { getMarkerIcon, getDarkMapStyle } from "@/lib/googleMapService";
import { MapPin, Loader2, AlertCircle, RefreshCw, Zap, ShieldAlert, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// متغير على مستوى الوحدة — يبقى حتى بعد unmount/remount للمكون
let googleMapsAuthFailedGlobal = false;

interface DriverMapProps {
  driverLocation: { lat: number; lng: number } | null;
  isOnline: boolean;
  onLocationUpdate?: () => void;
  hasActiveRide?: boolean;
}

export const DriverMap = ({ driverLocation, isOnline, onLocationUpdate, hasActiveRide }: DriverMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const driverMarker = useRef<google.maps.Marker | null>(null);
  const pulseCircles = useRef<google.maps.Circle[]>([]);
  const hasLoadedTilesOnceRef = useRef(false);
  const [loading, setLoading] = useState(!googleMapsAuthFailedGlobal);
  const [error, setError] = useState<string | null>(null);
  const [authFailed, setAuthFailed] = useState(googleMapsAuthFailedGlobal);
  const [isMapReady, setIsMapReady] = useState(false);
  const [autoAccept, setAutoAccept] = useState(false);
  const { apiKey, isLoading: isApiKeyLoading } = useGoogleMapsApiKey();
  const retryCountRef = useRef(0);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || isApiKeyLoading) return;
    // إذا فشل سابقاً (متغير عالمي) — لا نحاول مجدداً
    if (googleMapsAuthFailedGlobal) {
      setAuthFailed(true);
      setLoading(false);
      return;
    }
    // لا يوجد مفتاح API — نعرض شاشة خطأ
    if (!apiKey) {
      console.warn("⚠️ Google Maps API key is empty. Check app_settings table or VITE_GOOGLE_MAPS_API_KEY env var.");
      googleMapsAuthFailedGlobal = true;
      setAuthFailed(true);
      setLoading(false);
      return;
    }

    // If map already exists, avoid reinitialization churn
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
          if (googleMapsAuthFailedGlobal) return;
          const currentUrl = window.location.href;
          console.error(`❌ Google Maps auth failure — URL rejected: ${currentUrl}`);
          googleMapsAuthFailedGlobal = true;
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
            if (!isActive || googleMapsAuthFailedGlobal) return;
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

          // If tiles don't load within 15s, show error
          tileTimeout = setTimeout(() => {
            if (!isActive) return;
            if (!tilesLoaded && map.current) {
              const isHidden = typeof document !== 'undefined' && document.hidden;
              const containerVisible = !!mapContainer.current && mapContainer.current.clientWidth > 0 && mapContainer.current.clientHeight > 0;

              if (isHidden || !containerVisible) {
                setLoading(false);
                return;
              }

              if (hasLoadedTilesOnceRef.current) {
                console.warn('⚠️ DriverMap: Tiles timeout ignored (map had loaded before)');
                setLoading(false);
                return;
              }

              console.warn('⚠️ DriverMap: Tiles did not load within 15s');
              googleMapsAuthFailedGlobal = true;
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

        // تحقق من تحميل Google Maps مسبقاً
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

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "فشل في تحميل الخريطة";
        console.error("Map init error:", err);
        setError(message);
        setLoading(false);
      }
    };

    initMap();

    return () => {
      isActive = false;
      if (tileTimeout) {
        clearTimeout(tileTimeout);
      }
      removePulseCircles();
      if (map.current) {
        map.current = null;
        setIsMapReady(false);
      }
    };
  }, [apiKey, isApiKeyLoading]);

  // Update driver marker when location changes
  useEffect(() => {
    if (!isMapReady || !map.current || !driverLocation) return;
    if (!window.google?.maps) return;

    try {
      if (driverMarker.current) {
        driverMarker.current.setPosition(new google.maps.LatLng(driverLocation.lat, driverLocation.lng));
        updatePulseCirclesPosition(driverLocation);
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
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#5bdda6",
          fillOpacity: 1,
          strokeColor: "#0b1326",
          strokeWeight: 3,
          scale: 7,
        },
        zIndex: 10,
      });

      addPulseCircles(location);
    } catch (err) {
      console.error("DriverMap: addDriverMarker error", err);
    }
  };

  const addPulseCircles = (location: { lat: number; lng: number }) => {
    if (!map.current || !window.google?.maps) return;
    removePulseCircles();

    const center = new google.maps.LatLng(location.lat, location.lng);
    const innerCircle = new google.maps.Circle({
      center,
      radius: 60,
      map: map.current,
      fillColor: "#5bdda6",
      fillOpacity: 0.18,
      strokeColor: "#5bdda6",
      strokeOpacity: 0.4,
      strokeWeight: 1,
      clickable: false,
      zIndex: 5,
    });
    const outerCircle = new google.maps.Circle({
      center,
      radius: 60,
      map: map.current,
      fillColor: "#5bdda6",
      fillOpacity: 0.12,
      strokeColor: "#5bdda6",
      strokeOpacity: 0.3,
      strokeWeight: 1,
      clickable: false,
      zIndex: 4,
    });
    pulseCircles.current = [innerCircle, outerCircle];

    const minRadius = 60;
    const maxRadius = 600;
    const step = 6;
    const animInterval = setInterval(() => {
      if (!outerCircle.getMap()) { clearInterval(animInterval); return; }
      let r = outerCircle.getRadius();
      r += step;
      if (r >= maxRadius) r = minRadius;
      const opacity = 0.15 * (1 - (r - minRadius) / (maxRadius - minRadius));
      outerCircle.setRadius(r);
      outerCircle.setOptions({ fillOpacity: Math.max(opacity, 0), strokeOpacity: Math.max(opacity * 2, 0) });
    }, 40);

    // تخزين interval للتنظيف
    (outerCircle as unknown as { _pulseInterval: ReturnType<typeof setInterval> })._pulseInterval = animInterval;
  };

  const removePulseCircles = () => {
    pulseCircles.current.forEach(c => {
      const circ = c as unknown as { _pulseInterval?: ReturnType<typeof setInterval> };
      if (circ._pulseInterval) clearInterval(circ._pulseInterval);
      c.setMap(null);
    });
    pulseCircles.current = [];
  };

  const updatePulseCirclesPosition = (location: { lat: number; lng: number }) => {
    const center = new google.maps.LatLng(location.lat, location.lng);
    pulseCircles.current.forEach(c => c.setCenter(center));
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


  // عند فشل مصادقة Google Maps — شاشة خطأ أنيقة مع زر إعادة المحاولة
  if (authFailed) {
    return (
      <div className="absolute inset-0 bg-[#0b1326] flex items-center justify-center">
        <div className="text-center p-6 max-w-sm">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-800/60 border border-slate-700/50 flex items-center justify-center">
            <WifiOff className="w-9 h-9 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">الخريطة غير متاحة</h3>
          <p className="text-sm text-slate-400 mb-5 leading-relaxed">
            تعذر تحميل خرائط Google. تحقق من اتصالك بالإنترنت أو أعد المحاولة.
          </p>
          <Button
            variant="outline"
            className="bg-[#5bdda6]/10 border-[#5bdda6]/30 text-[#5bdda6] hover:bg-[#5bdda6]/20 font-bold px-6"
            onClick={() => {
              googleMapsAuthFailedGlobal = false;
              setAuthFailed(false);
              setLoading(true);
              retryCountRef.current++;
              window.location.reload();
            }}
          >
            <RefreshCw className="w-4 h-4 ml-2" />
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
      
      <div ref={mapContainer} className={`absolute inset-0 bg-gray-100 dark:bg-gray-800 ${isMapReady ? 'visible' : 'invisible'}`} />
      
      {/* Right Controls — Emergency + Auto-Accept + My Location */}
      <div className="absolute top-20 right-4 z-[9999] flex flex-col items-end gap-3">
        {/* Safety Shield */}
        <button
          className="w-12 h-12 flex items-center justify-center rounded-full border-none outline-none ring-0 shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:shadow-[0_0_25px_rgba(239,68,68,0.5)] transition-all bg-red-500 hover:bg-red-600 backdrop-blur group"
          title="الطوارئ والدعم"
          onClick={() => toast.error("تنبيه طوارئ: تم إشعار فريق الدعم الأمني", { description: "سنقوم بالتواصل معك فوراً" })}
        >
          <ShieldAlert className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
        </button>

        {/* Auto-Accept Toggle */}
        {!hasActiveRide && (
          <button
            className={`w-12 h-12 flex items-center justify-center rounded-full border-none outline-none ring-0 transition-all backdrop-blur group ${
              autoAccept
                ? 'bg-[#5bdda6] shadow-[0_0_15px_rgba(91,221,166,0.4)] hover:shadow-[0_0_25px_rgba(91,221,166,0.6)]'
                : 'bg-black/80 shadow-[0_0_15px_rgba(0,0,0,0.3)] hover:bg-black/90'
            }`}
            title="القبول التلقائي"
            onClick={() => {
              setAutoAccept(!autoAccept);
              if (!autoAccept) {
                toast.success("تم تفعيل القبول التلقائي للطلبات");
              } else {
                toast.info("تم إيقاف القبول التلقائي");
              }
            }}
          >
            <Zap className={`w-6 h-6 group-hover:scale-110 transition-transform ${autoAccept ? 'text-black' : 'text-slate-300'}`} />
          </button>
        )}

        {/* My Location */}
        <button
          className="w-12 h-12 flex items-center justify-center rounded-full border-none outline-none ring-0 shadow-[0_0_15px_rgba(0,0,0,0.3)] transition-all bg-black/80 hover:bg-black/90 backdrop-blur group disabled:opacity-40"
          onClick={handleCenterOnDriver}
          disabled={!driverLocation}
          title="موقعي"
        >
          <MapPin className="w-6 h-6 text-[#5bdda6] group-hover:scale-110 transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default DriverMap;
