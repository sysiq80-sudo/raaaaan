import { useEffect, useRef, useState } from "react";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";
import { getMarkerIcon, getDarkMapStyle } from "@/lib/googleMapService";
import { MapPin, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DriverMapProps {
  driverLocation: { lat: number; lng: number } | null;
  isOnline: boolean;
  onLocationUpdate?: () => void;
}

export const DriverMap = ({ driverLocation, isOnline, onLocationUpdate }: DriverMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const driverMarker = useRef<google.maps.Marker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { apiKey, isLoading: isApiKeyLoading } = useGoogleMapsApiKey();

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !apiKey || isApiKeyLoading) return;

    const initMap = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load Google Maps script
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          if (!window.google) return;

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

          // Add driver marker
          if (driverLocation) {
            addDriverMarker(driverLocation);
          }
        };

        script.onerror = () => {
          setError("عذراً، الخريطة لا تعمل. يرجى التحقق من مفتاح API");
          setLoading(false);
        };

        // معالجة أخطاء Google Maps مثل RefererNotAllowedMapError
        window.gm_authFailure = () => {
          console.error("❌ Google Maps authentication failure (RefererNotAllowed)");
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
      }
    };
  }, [apiKey, isApiKeyLoading]);

  // Update driver marker when location changes
  useEffect(() => {
    if (!map.current || !driverLocation) return;

    if (driverMarker.current) {
      driverMarker.current.setPosition(new google.maps.LatLng(driverLocation.lat, driverLocation.lng));
    } else {
      addDriverMarker(driverLocation);
    }

    // Center map on driver
    map.current.panTo(new google.maps.LatLng(driverLocation.lat, driverLocation.lng));
  }, [driverLocation]);

  const addDriverMarker = (location: { lat: number; lng: number }) => {
    if (!map.current) return;

    driverMarker.current = new google.maps.Marker({
      position: new google.maps.LatLng(location.lat, location.lng),
      map: map.current,
      title: "السائق",
      icon: getMarkerIcon("driver"),
    });
  };

  const handleCenterOnDriver = () => {
    if (!map.current || !driverLocation) return;
    
    map.current.panTo(new google.maps.LatLng(driverLocation.lat, driverLocation.lng));
    map.current.setZoom(15);
  };


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
            onClick={() => window.location.reload()}
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
