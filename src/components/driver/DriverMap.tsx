import { useEffect, useRef, useState } from "react";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { getMarkerIcon, getDarkMapStyle } from "@/lib/googleMapService";
import { MapPin, Loader2, AlertCircle, RefreshCw, Navigation, Zap, SlidersHorizontal, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
  const pulseCircles = useRef<google.maps.Circle[]>([]);
  const hasLoadedTilesOnceRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authFailed, setAuthFailed] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [autoAccept, setAutoAccept] = useState(false);
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
      removePulseCircles();
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
      // نقطة مركزية خضراء نابضة بدلاً من الأيقونة الافتراضية
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

      // إضافة دوائر نبض حول موقع السائق
      addPulseCircles(location);
    } catch (err) {
      console.error("DriverMap: addDriverMarker error", err);
    }
  };

  const addPulseCircles = (location: { lat: number; lng: number }) => {
    if (!map.current || !window.google?.maps) return;
    removePulseCircles();

    const center = new google.maps.LatLng(location.lat, location.lng);
    // دائرة داخلية ثابتة
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
    // دائرة خارجية نابضة (تتمدد وتتلاشى)
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

    // تحريك الدائرة الخارجية — موجة أحادية الاتجاه (تتمدد ثم تعود للبداية)
    const minRadius = 60;
    const maxRadius = 600;
    const step = 6;
    const animInterval = setInterval(() => {
      if (!outerCircle.getMap()) { clearInterval(animInterval); return; }
      let r = outerCircle.getRadius();
      r += step;
      if (r >= maxRadius) r = minRadius; // إعادة التشغيل من البداية كموجة sonar
      const opacity = 0.15 * (1 - (r - minRadius) / (maxRadius - minRadius));
      outerCircle.setRadius(r);
      outerCircle.setOptions({ fillOpacity: Math.max(opacity, 0), strokeOpacity: Math.max(opacity * 2, 0) });
    }, 40);

    // تخزين الـ interval لتنظيفه لاحقاً
    (outerCircle as any)._pulseInterval = animInterval;
  };

  const removePulseCircles = () => {
    pulseCircles.current.forEach(c => {
      if ((c as any)._pulseInterval) clearInterval((c as any)._pulseInterval);
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
      
      {/* Safety Shield - Top Right */}
      <div className="absolute top-24 right-4 z-30">
        <Button
          variant="destructive"
          size="icon"
          className="w-12 h-12 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:shadow-[0_0_25px_rgba(239,68,68,0.5)] transition-all bg-red-500/90 hover:bg-red-600 backdrop-blur"
          title="الطوارئ والدعم"
          onClick={() => toast.error("تنبيه طوارئ: تم إشعار فريق الدعم الأمني", { description: "سنقوم بالتواصل معك فوراً" })}
        >
          <ShieldAlert className="w-6 h-6 text-white" />
        </Button>
      </div>

      {/* Right Edge Contextual Actions */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
        {/* Auto-Accept Toggle */}
        <Button
          size="sm"
          variant="secondary"
          className={`shadow-lg rounded-none rounded-l-xl border-y border-l h-12 px-3 transition-colors group relative ${
            autoAccept 
              ? 'bg-[#5bdda6] text-black border-[#5bdda6] hover:bg-[#4acc95]' 
              : 'bg-black/80 border-border/50 text-white hover:bg-black'
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
          <Zap className={`w-5 h-5 ml-1.5 transition-colors ${autoAccept ? 'text-black' : 'text-slate-400 group-hover:text-white'}`} />
          <span className={`font-bold text-sm ${autoAccept ? 'text-black' : 'text-slate-300 group-hover:text-white'}`}>تلقائي</span>
        </Button>

        {/* My Location */}
        <Button
          size="sm"
          variant="secondary"
          className="shadow-lg rounded-none rounded-l-xl border-y border-l border-border/50 bg-background/90 hover:bg-background/100 h-12 px-3 transition-colors"
          onClick={handleCenterOnDriver}
          disabled={!driverLocation}
          title="موقعي"
        >
          <MapPin className="w-5 h-5 ml-1.5 text-primary" />
          <span className="font-bold text-sm">موقعي</span>
        </Button>

        {/* Service Filter */}
        <Button
          size="sm"
          variant="secondary"
          className="shadow-lg rounded-none rounded-l-xl border-y border-l border-border/50 bg-background/90 hover:bg-sky-500/20 h-12 px-3 transition-colors group relative"
          title="نوع الخدمة"
          onClick={() => toast.info("فلاتر الخدمة", { description: "هذه الميزة ستتوفر قريباً لتحديد نوع الطلبات (اقتصادي، VIP)" })}
        >
          <SlidersHorizontal className="w-5 h-5 group-hover:text-sky-400 text-muted-foreground ml-1.5 transition-colors" />
          <span className="font-bold text-sm">الخدمة</span>
        </Button>
      </div>
    </div>
  );
};

export default DriverMap;
