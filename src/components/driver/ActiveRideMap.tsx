import { useEffect, useRef, useState } from "react";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { getMarkerIcon, getDirections, getDarkMapStyle } from "@/lib/googleMapService";
import { Loader2, AlertCircle, Navigation, Clock } from "lucide-react";

interface ActiveRideMapProps {
  driverLocation: { lat: number; lng: number } | null;
  pickupLocation: { lat: number; lng: number };
  dropoffLocation: { lat: number; lng: number };
  rideStatus: "accepted" | "arrived" | "in_progress";
}

export const ActiveRideMap = ({
  driverLocation,
  pickupLocation,
  dropoffLocation,
  rideStatus,
}: ActiveRideMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const driverMarker = useRef<google.maps.Marker | null>(null);
  const pickupMarker = useRef<google.maps.Marker | null>(null);
  const dropoffMarker = useRef<google.maps.Marker | null>(null);
  const routePolyline = useRef<google.maps.Polyline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    distance: string;
    duration: string;
  } | null>(null);
  const { apiKey, isLoading: isApiKeyLoading } = useGoogleMapsApiKey();

  // Get target location based on ride status
  const targetLocation =
    rideStatus === "in_progress" ? dropoffLocation : pickupLocation;

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !apiKey || isApiKeyLoading) return;

    const initMap = async () => {
      try {
        setLoading(true);
        setError(null);

        loadGoogleMaps(apiKey).then(() => {
          if (!window.google || !mapContainer.current) return;

          const center = driverLocation || pickupLocation;

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
          addMarkers();
          if (driverLocation) {
            fetchAndDrawRoute();
          }
        }).catch((err) => {
          console.error("Map load error:", err);
          setError("فشل في تحميل الخريطة");
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
      if (map.current) {
        map.current = null;
      }
    };
  }, [apiKey, isApiKeyLoading]);

  // Update markers when locations change
  useEffect(() => {
    if (!map.current || loading) return;

    updateDriverMarker();
    if (driverLocation) {
      fetchAndDrawRoute();
    }
  }, [driverLocation, rideStatus, loading]);

  const addMarkers = () => {
    if (!map.current) return;

    // Pickup marker (green)
    pickupMarker.current = new google.maps.Marker({
      position: new google.maps.LatLng(pickupLocation.lat, pickupLocation.lng),
      map: map.current,
      title: "نقطة الالتقاط",
      icon: getMarkerIcon("pickup"),
    });

    // Dropoff marker (blue)
    dropoffMarker.current = new google.maps.Marker({
      position: new google.maps.LatLng(dropoffLocation.lat, dropoffLocation.lng),
      map: map.current,
      title: "الوجهة النهائية",
      icon: getMarkerIcon("dropoff"),
    });
  };

  const updateDriverMarker = () => {
    if (!map.current || !driverLocation) return;

    if (driverMarker.current) {
      driverMarker.current.setPosition(
        new google.maps.LatLng(driverLocation.lat, driverLocation.lng)
      );
    } else {
      driverMarker.current = new google.maps.Marker({
        position: new google.maps.LatLng(
          driverLocation.lat,
          driverLocation.lng
        ),
        map: map.current,
        title: "السائق",
        icon: getMarkerIcon("driver"),
      });
    }

    fitMapBounds();
  };

  const fitMapBounds = () => {
    if (!map.current) return;

    const bounds = new google.maps.LatLngBounds();

    if (driverLocation) {
      bounds.extend(
        new google.maps.LatLng(driverLocation.lat, driverLocation.lng)
      );
    }
    bounds.extend(
      new google.maps.LatLng(pickupLocation.lat, pickupLocation.lng)
    );
    bounds.extend(
      new google.maps.LatLng(dropoffLocation.lat, dropoffLocation.lng)
    );

    map.current.fitBounds(bounds);
  };

  const fetchAndDrawRoute = async () => {
    if (!map.current || !driverLocation) return;

    try {
      const result = await getDirections(driverLocation, targetLocation);

      if (!result) return;

      // Update route info
      setRouteInfo({
        distance: result.distance,
        duration: result.duration,
      });

      // Remove existing route
      if (routePolyline.current) {
        routePolyline.current.setMap(null);
      }

      // Draw new route
      routePolyline.current = new google.maps.Polyline({
        path: result.route.map(
          (p) => new google.maps.LatLng(p.lat, p.lng)
        ),
        geodesic: true,
        strokeColor: rideStatus === "in_progress" ? "#38bdf8" : "#00e5ff",
        strokeOpacity: 0.95,
        strokeWeight: 5,
        map: map.current,
      });

      fitMapBounds();
    } catch (err) {
      console.error("Route fetch error:", err);
    }
  };

  if (error) {
    return (
      <div className="h-56 bg-secondary/50 rounded-xl flex items-center justify-center">
        <div className="text-center p-4">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-56 rounded-xl overflow-hidden border border-border">
      {loading && (
        <div className="absolute inset-0 z-10 bg-secondary/80 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}

      <div ref={mapContainer} className="absolute inset-0" />

      {/* Route Info Overlay */}
      {routeInfo && (
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <div className="bg-card/95 backdrop-blur shadow-lg px-4 py-2 rounded-xl flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Navigation
                className={`w-4 h-4 ${
                  rideStatus === "in_progress" ? "text-red-500" : "text-green-500"
                }`}
              />
              <span className="font-bold text-foreground">
                {routeInfo.distance}
              </span>
            </div>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-bold text-foreground">
                {routeInfo.duration}
              </span>
            </div>
          </div>
          <div
            className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white ${
              rideStatus === "in_progress" ? "bg-red-500" : "bg-green-500"
            }`}
          >
            {rideStatus === "in_progress" ? "للوجهة" : "للعميل"}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveRideMap;
