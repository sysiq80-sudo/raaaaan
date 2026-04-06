import { useEffect, useRef, useState } from "react";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { getMarkerIcon, getDarkMapStyle } from "@/lib/googleMapService";
import { MapPin, Loader2, AlertCircle, RefreshCw, Navigation, Zap, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// متغير على مستوى الوحدة — يبقى حتى بعد unmount/remount للمكون
let googleMapsAuthFailedGlobal = false;

interface DriverMapProps {
  driverLocation: { lat: number; lng: number } | null;
  isOnline: boolean;
  onLocationUpdate?: () => void;
  hasActiveRide?: boolean;
}

// خريطة بديلة تفاعلية باستخدام Leaflet + OpenStreetMap — بدون API key
const FallbackMapView = ({ location, isOnline, onCenterRequest }: { location: { lat: number; lng: number } | null; isOnline: boolean; onCenterRequest?: (fn: () => void) => void }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const pulseCircleRef = useRef<L.Circle | null>(null);
  const pulseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const center = location || { lat: 33.4279, lng: 43.3070 };

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    // إنشاء خريطة Leaflet تفاعلية مع ستايل داكن
    const map = L.map(mapRef.current, {
      center: [center.lat, center.lng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    });

    // طبقة خرائط داكنة (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    // زر التقريب في أسفل اليسار
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    // إضافة علامة موقع السائق
    if (location) {
      const driverIcon = L.divIcon({
        className: 'driver-leaflet-marker',
        html: `<div style="
          width: 18px; height: 18px; border-radius: 50%;
          background: #5bdda6;
          border: 3px solid #0b1326;
          box-shadow: 0 0 12px rgba(91,221,166,0.6);
        "></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      markerRef.current = L.marker([location.lat, location.lng], { icon: driverIcon, zIndexOffset: 1000 }).addTo(map);

      // دائرة داخلية ثابتة حول موقع السائق
      circleRef.current = L.circle([location.lat, location.lng], {
        radius: 60,
        color: '#5bdda6',
        fillColor: '#5bdda6',
        fillOpacity: 0.18,
        weight: 1,
        opacity: 0.4,
      }).addTo(map);

      // دائرة خارجية نابضة (تتمدد وتتلاشى مثل sonar)
      pulseCircleRef.current = L.circle([location.lat, location.lng], {
        radius: 60,
        color: '#5bdda6',
        fillColor: '#5bdda6',
        fillOpacity: 0.12,
        weight: 1,
        opacity: 0.3,
      }).addTo(map);

      const minRadius = 60;
      const maxRadius = 600;
      const step = 6;
      pulseIntervalRef.current = setInterval(() => {
        if (!pulseCircleRef.current) return;
        let r = pulseCircleRef.current.getRadius();
        r += step;
        if (r >= maxRadius) r = minRadius;
        const opacity = 0.15 * (1 - (r - minRadius) / (maxRadius - minRadius));
        pulseCircleRef.current.setRadius(r);
        pulseCircleRef.current.setStyle({ fillOpacity: Math.max(opacity, 0), opacity: Math.max(opacity * 2, 0) });
      }, 40);
    }

    leafletMap.current = map;

    // تصحيح حجم الخريطة بعد التحميل
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      if (pulseIntervalRef.current) clearInterval(pulseIntervalRef.current);
      map.remove();
      leafletMap.current = null;
      markerRef.current = null;
      circleRef.current = null;
      pulseCircleRef.current = null;
    };
  }, []);

  // تسجيل دالة التوسيط للاستخدام الخارجي
  useEffect(() => {
    if (onCenterRequest) {
      onCenterRequest(() => {
        if (leafletMap.current && location) {
          leafletMap.current.setView([location.lat, location.lng], 15, { animate: true });
        }
      });
    }
  }, [onCenterRequest, location]);

  // تحديث موقع السائق عند تغيره
  useEffect(() => {
    if (!leafletMap.current || !location) return;
    
    const latlng: L.LatLngExpression = [location.lat, location.lng];
    leafletMap.current.setView(latlng, leafletMap.current.getZoom(), { animate: true });

    if (markerRef.current) {
      markerRef.current.setLatLng(latlng);
    }
    if (circleRef.current) {
      circleRef.current.setLatLng(latlng);
    }
    if (pulseCircleRef.current) {
      pulseCircleRef.current.setLatLng(latlng);
    }
  }, [location?.lat, location?.lng]);

  return (
    <div className="relative h-full">
      <div ref={mapRef} className="absolute inset-0" />
    </div>
  );
};

export const DriverMap = ({ driverLocation, isOnline, onLocationUpdate, hasActiveRide }: DriverMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const driverMarker = useRef<google.maps.Marker | null>(null);
  const pulseCircles = useRef<google.maps.Circle[]>([]);
  const hasLoadedTilesOnceRef = useRef(false);
  const fallbackCenterFnRef = useRef<(() => void) | null>(null);
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
    // لا يوجد مفتاح API — نعرض الخريطة البديلة مباشرة
    if (!apiKey) {
      console.warn("⚠️ Google Maps API key is empty. Check app_settings table or VITE_GOOGLE_MAPS_API_KEY env var.");
      console.warn("💡 For Capacitor apps, ensure the API key is stored in Supabase app_settings table (key: google_maps_api_key)");
      googleMapsAuthFailedGlobal = true;
      setAuthFailed(true);
      setLoading(false);
      return;
    }

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
          if (googleMapsAuthFailedGlobal) return; // منع التكرار
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
            if (!isActive || googleMapsAuthFailedGlobal) return; // لا نعيد التعيين بعد فشل المصادقة
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
  }, [apiKey, isApiKeyLoading]);

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


  // عند فشل مصادقة Google Maps — عرض خريطة Leaflet تفاعلية بديلة مع كل أزرار التحكم
  if (authFailed) {
    return (
      <div className="absolute inset-0 overflow-hidden">
        <FallbackMapView location={driverLocation} isOnline={isOnline} onCenterRequest={(fn) => { fallbackCenterFnRef.current = fn; }} />

        {/* Safety Shield - Top Right */}
        <div className="absolute top-24 right-4 z-[9999]">
          <button
            className="w-12 h-12 flex items-center justify-center rounded-full border-none outline-none ring-0 shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:shadow-[0_0_25px_rgba(239,68,68,0.5)] transition-all bg-red-500 hover:bg-red-600 backdrop-blur group"
            title="الطوارئ والدعم"
            onClick={() => toast.error("تنبيه طوارئ: تم إشعار فريق الدعم الأمني", { description: "سنقوم بالتواصل معك فوراً" })}
          >
            <ShieldAlert className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          </button>
        </div>

        {/* Right Edge Contextual Actions */}
        {!hasActiveRide && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 z-[9999] flex flex-col gap-3 pointer-events-none">
            {/* Auto-Accept Toggle */}
            <Button
              size="sm"
              variant="secondary"
              className={`pointer-events-auto shadow-[0_4px_20px_-4px_rgba(0,0,0,0.8)] rounded-none rounded-l-2xl border-y border-l border-r-0 h-12 sm:h-14 px-3 sm:px-4 transition-colors group relative ${
                autoAccept 
                  ? 'bg-[#5bdda6] text-black border-[#5bdda6] hover:bg-[#4acc95]' 
                  : 'bg-black/95 border-border/50 text-white hover:bg-black'
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
              className="pointer-events-auto shadow-[0_4px_20px_-4px_rgba(0,0,0,0.8)] rounded-none rounded-l-2xl border-y border-l border-r-0 border-border/50 bg-black/90 hover:bg-black text-white h-12 sm:h-14 px-3 sm:px-4 transition-colors"
              onClick={() => fallbackCenterFnRef.current?.()}
              disabled={!driverLocation}
              title="موقعي"
            >
              <MapPin className="w-5 h-5 ml-1.5 text-primary" />
              <span className="font-bold text-sm">موقعي</span>
            </Button>


          </div>
        )}
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
      
      {/* Safety Shield - Top Right */}
      <div className="absolute top-24 right-4 z-[9999]">
        <button
          className="w-12 h-12 flex items-center justify-center rounded-full border-none outline-none ring-0 shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:shadow-[0_0_25px_rgba(239,68,68,0.5)] transition-all bg-red-500 hover:bg-red-600 backdrop-blur group"
          title="الطوارئ والدعم"
          onClick={() => toast.error("تنبيه طوارئ: تم إشعار فريق الدعم الأمني", { description: "سنقوم بالتواصل معك فوراً" })}
        >
          <ShieldAlert className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* Right Edge Contextual Actions */}
      {!hasActiveRide && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 z-[9999] flex flex-col gap-3 pointer-events-none">
          {/* Auto-Accept Toggle */}
          <Button
            size="sm"
            variant="secondary"
            className={`pointer-events-auto shadow-[0_4px_20px_-4px_rgba(0,0,0,0.8)] rounded-none rounded-l-2xl border-y border-l border-r-0 h-12 sm:h-14 px-3 sm:px-4 transition-colors group relative ${
              autoAccept 
                ? 'bg-[#5bdda6] text-black border-[#5bdda6] hover:bg-[#4acc95]' 
                : 'bg-black/95 border-border/50 text-white hover:bg-black'
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
            className="pointer-events-auto shadow-[0_4px_20px_-4px_rgba(0,0,0,0.8)] rounded-none rounded-l-2xl border-y border-l border-r-0 border-border/50 bg-black/90 hover:bg-black text-white h-12 sm:h-14 px-3 sm:px-4 transition-colors"
            onClick={handleCenterOnDriver}
            disabled={!driverLocation}
            title="موقعي"
          >
            <MapPin className="w-5 h-5 ml-1.5 text-primary" />
            <span className="font-bold text-sm">موقعي</span>
          </Button>


        </div>
      )}
    </div>
  );
};

export default DriverMap;
