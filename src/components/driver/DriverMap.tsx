import { useEffect, useRef, useState } from "react";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DriverMapProps {
  driverLocation: { lat: number; lng: number } | null;
  isOnline: boolean;
  onLocationUpdate?: () => void;
}

export const DriverMap = ({ driverLocation, isOnline, onLocationUpdate }: DriverMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const driverMarker = useRef<mapboxgl.Marker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    const initMap = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch Mapbox token using query parameter
        const response = await fetch(
          "https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=token"
        );
        
        if (!response.ok) {
          throw new Error("فشل في تحميل الخريطة");
        }
        
        const data = await response.json();
        
        if (!data?.token) {
          throw new Error("فشل في تحميل الخريطة");
        }

        mapboxgl.accessToken = data.token;

        // Default to Ramadi center if no location
        const center = driverLocation || { lat: 33.4279, lng: 43.3070 };

        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [center.lng, center.lat],
          zoom: 14,
          attributionControl: false
        });

        map.current.addControl(
          new mapboxgl.NavigationControl({ showCompass: false }),
          "top-left"
        );

        map.current.on("load", () => {
          setLoading(false);
          
          // Add driver marker
          if (driverLocation) {
            addDriverMarker(driverLocation);
          }
        });

      } catch (err: any) {
        console.error("Map init error:", err);
        setError(err.message || "فشل في تحميل الخريطة");
        setLoading(false);
      }
    };

    initMap();

    return () => {
      map.current?.remove();
    };
  }, []);

  // Update driver marker when location changes
  useEffect(() => {
    if (!map.current || !driverLocation) return;

    if (driverMarker.current) {
      driverMarker.current.setLngLat([driverLocation.lng, driverLocation.lat]);
    } else {
      addDriverMarker(driverLocation);
    }

    // Center map on driver
    map.current.flyTo({
      center: [driverLocation.lng, driverLocation.lat],
      duration: 1000
    });
  }, [driverLocation]);

  const addDriverMarker = (location: { lat: number; lng: number }) => {
    if (!map.current) return;

    // Create custom driver marker element
    const el = document.createElement("div");
    el.className = "driver-marker";
    el.innerHTML = `
      <div class="relative">
        <div class="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg border-4 border-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8c-.1.2-.1.4-.1.6v4.7c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
        </div>
        ${isOnline ? '<div class="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>' : ''}
      </div>
    `;

    driverMarker.current = new mapboxgl.Marker({ element: el })
      .setLngLat([location.lng, location.lat])
      .addTo(map.current);
  };

  const handleCenterOnDriver = () => {
    if (!map.current || !driverLocation) return;
    
    map.current.flyTo({
      center: [driverLocation.lng, driverLocation.lat],
      zoom: 15,
      duration: 1000
    });
  };

  if (error) {
    return (
      <div className="relative h-48 bg-secondary/50 rounded-2xl flex items-center justify-center">
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
    <div className="relative h-48 rounded-2xl overflow-hidden">
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
