import { useEffect, useRef, useState } from "react";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";
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
    <div className="relative h-full min-h-[12rem] bg-gradient-to-b from-gray-900 to-gray-800 flex flex-col items-center justify-center overflow-hidden">
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
          ⚠️ الخريطة التفاعلية غير متاحة حالياً — الموقع والرحلات تعمل بشكل طبيعي
        </p>
      </div>
    </div>
  );
};

export const DriverMap = ({ driverLocation, isOnline, onLocationUpdate }: DriverMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const driverMarker = useRef<google.maps.Marker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authFailed, setAuthFailed] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const { apiKey, isLoading: isApiKeyLoading } = useGoogleMapsApiKey();
  const retryCountRef = useRef(0);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !apiKey || isApiKeyLoading) return;
    // إذا فشل المصادقة سابقاً، لا نعيد المحاولة (نعرض الخريطة البديلة)
    if (authFailed) return;

    const initMap = () => {
      try {
        setLoading(true);
        setError(null);

        // معالجة أخطاء Google Maps مثل RefererNotAllowedMapError
        window.gm_authFailure = () => {
          const currentUrl = window.location.href;
          console.error(`❌ Google Maps auth failure — URL rejected: ${currentUrl}`);
          console.error(`💡 Fix: Go to Google Cloud Console → Credentials → API Key → Add "${window.location.hostname}/*" to allowed HTTP referrers`);
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

          setLoading(false);
          setIsMapReady(true);

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

        // تحقق من وجود سكربت محمل مسبقاً
        const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
        if (existingScript) {
          // السكربت محمل لكن Google Maps لم يجهز بعد - انتظر
          const waitForGoogle = setInterval(() => {
            if (window.google?.maps?.Map) {
              clearInterval(waitForGoogle);
              createMap();
            }
          }, 100);
          // مهلة 10 ثواني
          setTimeout(() => {
            clearInterval(waitForGoogle);
            if (!map.current) {
              setError("انتهت المهلة في تحميل الخريطة");
              setLoading(false);
            }
          }, 10000);
          return;
        }

        // تحميل السكربت لأول مرة
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          // انتظر حتى يكون Google Maps جاهزاً بالكامل
          if (window.google?.maps?.Map) {
            createMap();
          } else {
            const waitForMaps = setInterval(() => {
              if (window.google?.maps?.Map) {
                clearInterval(waitForMaps);
                createMap();
              }
            }, 100);
            setTimeout(() => {
              clearInterval(waitForMaps);
              if (!map.current) {
                setError("انتهت المهلة في تحميل الخريطة");
                setLoading(false);
              }
            }, 10000);
          }
        };

        script.onerror = () => {
          setError("عذراً، الخريطة لا تعمل. يرجى التحقق من مفتاح API");
          setLoading(false);
        };

        document.head.appendChild(script);

      } catch (err: any) {
        console.error("Map init error:", err);
        setError(err.message || "فشل في تحميل الخريطة");
        setLoading(false);
      }
    };

    initMap();

    return () => {
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
    return <FallbackMapView location={driverLocation} isOnline={isOnline} />;
  }

  if (error) {
    return (
      <div className="relative h-full min-h-[12rem] bg-secondary/50 flex items-center justify-center">
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
    <div className="relative h-full w-full overflow-hidden">
      {loading && (
        <div className="absolute inset-0 z-10 bg-secondary/80 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}
      
      <div ref={mapContainer} className="absolute inset-0" />
      
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
