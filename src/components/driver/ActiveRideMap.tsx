import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Loader2, AlertCircle, Navigation, Clock } from "lucide-react";

interface ActiveRideMapProps {
  driverLocation: { lat: number; lng: number } | null;
  pickupLocation: { lat: number; lng: number };
  dropoffLocation: { lat: number; lng: number };
  rideStatus: 'accepted' | 'arrived' | 'in_progress';
}

export const ActiveRideMap = ({ 
  driverLocation, 
  pickupLocation, 
  dropoffLocation,
  rideStatus 
}: ActiveRideMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const driverMarker = useRef<mapboxgl.Marker | null>(null);
  const pickupMarker = useRef<mapboxgl.Marker | null>(null);
  const dropoffMarker = useRef<mapboxgl.Marker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);

  // Get target location based on ride status
  const targetLocation = rideStatus === 'in_progress' ? dropoffLocation : pickupLocation;

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    const initMap = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          "https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=token"
        );
        
        if (!response.ok) throw new Error("فشل في تحميل الخريطة");
        
        const data = await response.json();
        if (!data?.token) throw new Error("فشل في تحميل الخريطة");

        mapboxgl.accessToken = data.token;

        const center = driverLocation || pickupLocation;

        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [center.lng, center.lat],
          zoom: 14,
          attributionControl: false
        });

        map.current.on("load", () => {
          setLoading(false);
          addMarkers();
          if (driverLocation) {
            fetchAndDrawRoute();
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

    // Pickup marker (green pulsing)
    const pickupEl = document.createElement("div");
    pickupEl.innerHTML = `
      <div class="relative">
        <div class="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-lg border-3 border-white animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap font-bold shadow">
          العميل
        </div>
      </div>
    `;
    
    pickupMarker.current = new mapboxgl.Marker({ element: pickupEl })
      .setLngLat([pickupLocation.lng, pickupLocation.lat])
      .addTo(map.current);

    // Dropoff marker (red)
    const dropoffEl = document.createElement("div");
    dropoffEl.innerHTML = `
      <div class="relative">
        <div class="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center shadow-lg border-3 border-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
            <line x1="4" x2="4" y1="22" y2="15"/>
          </svg>
        </div>
        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap font-bold shadow">
          الوجهة
        </div>
      </div>
    `;
    
    dropoffMarker.current = new mapboxgl.Marker({ element: dropoffEl })
      .setLngLat([dropoffLocation.lng, dropoffLocation.lat])
      .addTo(map.current);

    // Add driver marker if location available
    if (driverLocation) {
      updateDriverMarker();
    }

    // Fit bounds to show all markers
    fitMapBounds();
  };

  const updateDriverMarker = () => {
    if (!map.current || !driverLocation) return;

    if (driverMarker.current) {
      driverMarker.current.setLngLat([driverLocation.lng, driverLocation.lat]);
    } else {
      const driverEl = document.createElement("div");
      driverEl.innerHTML = `
        <div class="relative">
          <div class="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg border-4 border-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8c-.1.2-.1.4-.1.6v4.7c0 .6.4 1 1 1h2"/>
              <circle cx="7" cy="17" r="2"/>
              <circle cx="17" cy="17" r="2"/>
            </svg>
          </div>
          <div class="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
        </div>
      `;
      
      driverMarker.current = new mapboxgl.Marker({ element: driverEl })
        .setLngLat([driverLocation.lng, driverLocation.lat])
        .addTo(map.current);
    }
  };

  const fitMapBounds = () => {
    if (!map.current) return;

    const bounds = new mapboxgl.LngLatBounds();
    
    if (driverLocation) {
      bounds.extend([driverLocation.lng, driverLocation.lat]);
    }
    bounds.extend([pickupLocation.lng, pickupLocation.lat]);
    bounds.extend([dropoffLocation.lng, dropoffLocation.lat]);

    map.current.fitBounds(bounds, {
      padding: { top: 60, bottom: 60, left: 40, right: 40 },
      duration: 1000
    });
  };

  const fetchAndDrawRoute = async () => {
    if (!map.current || !driverLocation) return;

    try {
      const response = await fetch(
        `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=directions&start=${driverLocation.lng},${driverLocation.lat}&end=${targetLocation.lng},${targetLocation.lat}`
      );

      if (!response.ok) return;

      const data = await response.json();
      
      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        const coords = route.geometry.coordinates;

        // Update route info
        const distanceKm = (route.distance / 1000).toFixed(1);
        const durationMin = Math.round(route.duration / 60);
        setRouteInfo({
          distance: `${distanceKm} كم`,
          duration: `${durationMin} د`
        });

        // Remove existing route layer
        if (map.current.getLayer('route')) {
          map.current.removeLayer('route');
          map.current.removeSource('route');
        }
        if (map.current.getLayer('route-glow')) {
          map.current.removeLayer('route-glow');
        }

        // Add route to map
        map.current.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: coords
            }
          }
        });

        // Glow effect
        map.current.addLayer({
          id: 'route-glow',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': rideStatus === 'in_progress' ? '#ef4444' : '#22c55e',
            'line-width': 10,
            'line-opacity': 0.3
          }
        });

        // Main route line
        map.current.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': rideStatus === 'in_progress' ? '#ef4444' : '#22c55e',
            'line-width': 5
          }
        });

        // Fit bounds to include route
        const bounds = new mapboxgl.LngLatBounds();
        coords.forEach((coord: [number, number]) => bounds.extend(coord));
        map.current.fitBounds(bounds, {
          padding: { top: 80, bottom: 80, left: 50, right: 50 },
          duration: 1000
        });
      }
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
              <Navigation className={`w-4 h-4 ${rideStatus === 'in_progress' ? 'text-red-500' : 'text-green-500'}`} />
              <span className="font-bold text-foreground">{routeInfo.distance}</span>
            </div>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-bold text-foreground">{routeInfo.duration}</span>
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white ${
            rideStatus === 'in_progress' ? 'bg-red-500' : 'bg-green-500'
          }`}>
            {rideStatus === 'in_progress' ? 'للوجهة' : 'للعميل'}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveRideMap;
