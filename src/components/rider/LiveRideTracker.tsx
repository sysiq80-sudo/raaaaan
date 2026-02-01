import React, { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRiderLocation } from "@/hooks/useRiderLocation";
import FareBreakdownCard from "@/components/driver/FareBreakdownCard";
import RideCompletedScreen from "@/components/rider/RideCompletedScreen";
import { EmergencyTriangleButton } from "@/components/rider/EmergencyTriangleButton";
import { RideShareButton } from "@/components/rider/RideShareButton";
import DriverInfoCard from "@/components/rider/DriverInfoCard";
import RideStatusBar from "@/components/rider/RideStatusBar";
import ChangeDestinationSheet from "@/components/rider/ChangeDestinationSheet";
import { ChatButton } from "@/components/ride/RideChat";
import { useBroadcastChannel } from "@/hooks/useBroadcastChannel";
import {
  playSound,
  vibrate,
  VibrationPatterns,
  showNotification,
  requestNotificationPermission,
} from "@/utils/rideNotificationSounds";
import { calculateLocalDistance } from "@/lib/mapUtils";
import {
  X,
  Loader2,
  Shield,
  CheckCircle,
  Clock,
  MapPin,
  Edit2,
  Car,
  Search,
  UserCheck,
  MapPinned,
  Route,
  Menu,
  Bell,
  Timer,
  Navigation,
} from "lucide-react";
import RiderSideMenu from "@/components/rider/RiderSideMenu";
import StatusIcons from "@/components/common/StatusIcons";
import logo from "@/assets/logo.png";

interface Ride {
  id: string;
  pickup_location: { lat: number; lng: number };
  dropoff_location: { lat: number; lng: number };
  pickup_address: string | null;
  dropoff_address: string | null;
  status: string;
  estimated_fare: number | null;
  final_fare: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  vehicle_type: string;
  driver_id: string | null;
  created_at: string;
  completed_at: string | null;
  started_at?: string | null;
  driver_rating?: number | null;
}

interface Driver {
  id: string;
  full_name: string;
  phone: string;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  vehicle_color: string | null;
  rating: number | null;
  current_location: { lat: number; lng: number } | null;
}

interface LiveRideTrackerProps {
  ride: Ride;
  onClose: () => void;
  onRideUpdate: (ride: Ride) => void;
}

const LiveRideTracker: React.FC<LiveRideTrackerProps> = ({
  ride,
  onClose,
  onRideUpdate,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pickupMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const dropoffMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // 🔥 Real-time driver location tracking for rider
  // Enables continuous tracking with 5-second updates (reduced from 30s)
  const isRideActive = ['accepted', 'arrived', 'in_progress'].includes(ride.status);
  useRiderLocation({ 
    enabled: isRideActive, 
    updateInterval: 5000 // تحديث كل 5 ثواني للرؤية المباشرة
  });

  const [mapToken, setMapToken] = useState<string | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [estimatedArrival, setEstimatedArrival] = useState<number | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [showCompletedScreen, setShowCompletedScreen] = useState(false);
  const [previousStatus, setPreviousStatus] = useState<string>(ride.status);
  const [showArrivedAlert, setShowArrivedAlert] = useState(false);
  const [approachingNotified, setApproachingNotified] = useState(false);
  const [driverApproachingNotified, setDriverApproachingNotified] =
    useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDestinationChange, setShowDestinationChange] = useState(false);
  const [remainingDistance, setRemainingDistance] = useState<number | null>(
    null
  );
  const [routeCoordinates, setRouteCoordinates] = useState<
    Array<{ lat: number; lng: number }>
  >([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const { toast } = useToast();

  // Handle driver location update from broadcast
  const handleDriverLocationUpdate = useCallback(
    (location: { lat: number; lng: number }) => {
      setDriver((prev) =>
        prev ? { ...prev, current_location: location } : null
      );
      updateDriverMarker(location);
      calculateETA(location);
      if (ride.status === "accepted") {
        fetchDriverToPickupRoute(location);
        checkDriverApproaching(location);
      }
    },
    [ride.status]
  );

  // Use broadcast channel hook
  const { sendQuickMessage, handleRiderArrived } = useBroadcastChannel({
    ride,
    driver,
    onRideUpdate,
    onDriverLocationUpdate: handleDriverLocationUpdate,
    onClose,
    setShowArrivedAlert,
    setShowCompletedScreen,
  });

  // Handle "I'm on my way" button for arrived status
  const handleOnMyWay = () => {
    console.log("[LiveRideTracker] Rider clicked: I'm on my way");
    sendQuickMessage(
      "rider_on_my_way",
      "✅ تم إبلاغ السائق",
      "السائق يعلم أنك قادم"
    );
    setShowArrivedAlert(false);
  };

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Handle status changes via database updates (fallback)
  useEffect(() => {
    if (ride.status === "accepted" && previousStatus === "pending") {
      playSound("accepted");
      vibrate(VibrationPatterns.accepted);

      showNotification(
        "🎉 تم قبول طلبك!",
        `${driver?.full_name || "السائق"} قَبِل طلبك وفي الطريق إليك`,
        { tag: "ride-accepted", duration: 8000 }
      );

      toast({
        title: "🎉 تم قبول طلبك!",
        description: `${driver?.full_name || "السائق"} في الطريق إليك الآن`,
        duration: 8000,
      });
    }

    if (ride.status === "arrived" && previousStatus !== "arrived") {
      playSound("arrived");
      vibrate(VibrationPatterns.arrived);
      setShowArrivedAlert(true);

      showNotification(
        "🔔 السائق وصل!",
        `${driver?.full_name || "السائق"} وصل لموقعك - اخرج الآن`,
        { tag: "driver-arrived", requireInteraction: true }
      );

      toast({
        title: "🔔 السائق وصل!",
        description: "اخرج الآن - السائق في انتظارك",
        duration: 10000,
      });

      setTimeout(() => setShowArrivedAlert(false), 10000);
    }

    if (ride.status === "in_progress" && previousStatus === "arrived") {
      playSound("inProgress");
      vibrate(VibrationPatterns.inProgress);

      toast({
        title: "🛣️ انطلقت الرحلة!",
        description: "أنت في الطريق للوجهة - رحلة موفقة",
        duration: 5000,
      });
    }

    setPreviousStatus(ride.status);
  }, [ride.status, previousStatus, driver?.full_name, toast]);

  // ✅ REMOVED: Duplicate logic - شاشة التقييم يتم التحكم بها من useActiveRide في GoPage
  // هذا المنطق كان يسبب race condition مع parent component

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch(
          "https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=token"
        );
        const data = await response.json();
        if (data.token) {
          setMapToken(data.token);
        }
      } catch (error) {
        console.error("Error fetching token:", error);
      }
    };
    fetchToken();
  }, []);

  // Fetch driver info
  useEffect(() => {
    const fetchDriver = async () => {
      if (!ride.driver_id) return;

      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("id", ride.driver_id)
        .single();

      if (!error && data) {
        const driverData = data as any;
        setDriver({
          ...driverData,
          current_location: driverData.current_location as {
            lat: number;
            lng: number;
          } | null,
        });
      }
    };

    fetchDriver();
  }, [ride.driver_id]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapToken) return;

    mapboxgl.accessToken = mapToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [ride.pickup_location.lng, ride.pickup_location.lat],
      zoom: 14,
      pitch: 45,
    });

    map.current.on("load", () => {
      setIsLoading(false);

      // Add route source
      map.current?.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [] },
        },
      });

      // Route glow
      map.current?.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#00d9a5",
          "line-width": 12,
          "line-blur": 8,
          "line-opacity": 0.4,
        },
      });

      // Route line
      map.current?.addLayer({
        id: "route",
        type: "line",
        source: "route",
        paint: { "line-color": "#00d9a5", "line-width": 5, "line-opacity": 1 },
      });

      // Add pickup marker
      const pickupEl = document.createElement("div");
      pickupEl.innerHTML = `
        <div class="flex flex-col items-center">
          <div class="w-10 h-10 rounded-full flex items-center justify-center shadow-lg" style="background: linear-gradient(135deg, #00d9a5, #00b389);">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </div>
        </div>
      `;
      pickupMarkerRef.current = new mapboxgl.Marker(pickupEl)
        .setLngLat([ride.pickup_location.lng, ride.pickup_location.lat])
        .addTo(map.current!);

      // Add dropoff marker (blue)
      const dropoffEl = document.createElement("div");
      dropoffEl.innerHTML = `
        <div class="flex flex-col items-center">
          <div class="w-10 h-10 rounded-full flex items-center justify-center shadow-lg" style="background: linear-gradient(135deg, #0ea5e9, #0284c7); box-shadow: 0 0 30px rgba(14, 165, 233, 0.8), 0 4px 20px rgba(14, 165, 233, 0.4); border: 3px solid rgba(255, 255, 255, 0.95);">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
        </div>
      `;
      dropoffMarkerRef.current = new mapboxgl.Marker(dropoffEl)
        .setLngLat([ride.dropoff_location.lng, ride.dropoff_location.lat])
        .addTo(map.current!);

      // Fetch and display route
      fetchRoute();
    });

    return () => {
      // Google Maps doesn't have remove method, just nullify reference
      map.current = null;
    };
  }, [mapToken]);

  // Fetch route
  const fetchRoute = async () => {
    if (!map.current) return;

    const start = `${ride.pickup_location.lng},${ride.pickup_location.lat}`;
    const end = `${ride.dropoff_location.lng},${ride.dropoff_location.lat}`;

    try {
      const response = await fetch(
        `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=directions&start=${start}&end=${end}`
      );
      const data = await response.json();

      if (data.routes?.[0]) {
        const route = data.routes[0];
        const source = map.current?.getSource(
          "route"
        ) as mapboxgl.GeoJSONSource;
        if (source) {
          source.setData({
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: route.geometry.coordinates,
            },
          });
        }

        // Save route coordinates for destination change calculations
        const coords = route.geometry.coordinates.map(
          (c: [number, number]) => ({ lng: c[0], lat: c[1] })
        );
        setRouteCoordinates(coords);
        setRemainingDistance(route.distance / 1000); // Convert to km

        const bounds = new mapboxgl.LngLatBounds();
        route.geometry.coordinates.forEach((coord: [number, number]) =>
          bounds.extend(coord)
        );
        map.current?.fitBounds(bounds, { padding: 80, duration: 1000 });
      }
    } catch (error) {
      console.error("Error fetching route:", error);
    }
  };

  // Update route to destination after arrival
  const updateRouteToDestination = async (driverLocation: { lat: number; lng: number }) => {
    if (!map.current) return;

    const start = `${driverLocation.lng},${driverLocation.lat}`;
    const end = `${ride.dropoff_location.lng},${ride.dropoff_location.lat}`;

    console.log('[updateRouteToDestination] From:', start, 'To:', end);

    try {
      const response = await fetch(
        `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=directions&start=${start}&end=${end}`
      );
      const data = await response.json();

      if (data.routes?.[0]) {
        const route = data.routes[0];
        const source = map.current?.getSource("route") as mapboxgl.GeoJSONSource;
        
        if (source) {
          console.log('[updateRouteToDestination] ✅ Updating route on map');
          source.setData({
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: route.geometry.coordinates,
            },
          });

          // Update remaining distance
          setRemainingDistance(route.distance / 1000);

          // Fit bounds to new route
          const bounds = new mapboxgl.LngLatBounds();
          route.geometry.coordinates.forEach((coord: [number, number]) =>
            bounds.extend(coord)
          );
          map.current?.fitBounds(bounds, { padding: 80, duration: 1000 });
        }
      }
    } catch (error) {
      console.error("Error updating route to destination:", error);
    }
  };

  // Subscribe to real-time updates
  useEffect(() => {
    const rideChannel = supabase
      .channel(`ride-${ride.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rides",
          filter: `id=eq.${ride.id}`,
        },
        (payload) => {
          const updatedRide = payload.new as any;
          onRideUpdate({ ...ride, ...updatedRide });

          // 🔄 تحديث المسار عند تغيير الحالة إلى arrived أو in_progress
          if ((updatedRide.status === "arrived" || updatedRide.status === "in_progress") && driver?.current_location) {
            console.log('[LiveRideTracker] 🗺️ Updating route to destination after arrival');
            updateRouteToDestination(driver.current_location);
          }

          if (updatedRide.status === "completed") {
            toast({
              title: "تم إكمال الرحلة! ✅",
              description: "شكراً لاستخدامك ران",
            });
          } else if (updatedRide.status === "cancelled") {
            toast({ title: "تم إلغاء الرحلة", variant: "destructive" });
          }
        }
      )
      .subscribe();

    let driverChannel: any = null;
    if (ride.driver_id) {
      driverChannel = supabase
        .channel(`driver-location-${ride.driver_id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "drivers",
            filter: `id=eq.${ride.driver_id}`,
          },
          (payload) => {
            const driverData = payload.new as any;
            const newLocation = driverData.current_location as {
              lat: number;
              lng: number;
            } | null;

            if (newLocation) {
              setDriver((prev) =>
                prev ? { ...prev, current_location: newLocation } : null
              );
              updateDriverMarker(newLocation);
              calculateETA(newLocation);
              fetchDriverToPickupRoute(newLocation);
            }
          }
        )
        .subscribe();
    }

    return () => {
      supabase.removeChannel(rideChannel);
      if (driverChannel) supabase.removeChannel(driverChannel);
    };
  }, [ride.id, ride.driver_id]);

  // Fallback polling for driver location
  useEffect(() => {
    if (
      !ride.driver_id ||
      ride.status === "completed" ||
      ride.status === "cancelled"
    )
      return;

    const pollDriverLocation = async () => {
      try {
        const { data, error } = await supabase
          .from("drivers")
          .select("current_location")
          .eq("id", ride.driver_id)
          .single();

        if (!error && data?.current_location) {
          const newLocation = data.current_location as {
            lat: number;
            lng: number;
          };

          if (
            !driver?.current_location ||
            newLocation.lat !== driver.current_location.lat ||
            newLocation.lng !== driver.current_location.lng
          ) {
            setDriver((prev) =>
              prev ? { ...prev, current_location: newLocation } : null
            );
            updateDriverMarker(newLocation);
            calculateETA(newLocation);
            fetchDriverToPickupRoute(newLocation);
          }
        }
      } catch (err) {
        console.error("Error polling driver location:", err);
      }
    };

    pollDriverLocation();
    const interval = setInterval(pollDriverLocation, 5000);

    return () => clearInterval(interval);
  }, [ride.driver_id, ride.status, driver?.current_location]);

  // Fetch and draw route from driver to pickup
  const fetchDriverToPickupRoute = async (driverLocation: {
    lat: number;
    lng: number;
  }) => {
    if (!map.current || ride.status === "in_progress") return;

    try {
      const response = await fetch(
        `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=directions&start=${driverLocation.lng},${driverLocation.lat}&end=${ride.pickup_location.lng},${ride.pickup_location.lat}`
      );
      const data = await response.json();

      if (data.routes?.[0]) {
        const route = data.routes[0];

        if (map.current.getSource("driver-route")) {
          (
            map.current.getSource("driver-route") as mapboxgl.GeoJSONSource
          ).setData({
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: route.geometry.coordinates,
            },
          });
        } else {
          map.current.addSource("driver-route", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: route.geometry.coordinates,
              },
            },
          });

          map.current.addLayer(
            {
              id: "driver-route",
              type: "line",
              source: "driver-route",
              paint: {
                "line-color": "#3b82f6",
                "line-width": 4,
                "line-dasharray": [2, 2],
              },
            },
            "route-glow"
          );
        }
      }
    } catch (error) {
      console.error("Error fetching driver route:", error);
    }
  };

  // Update driver marker on map
  const updateDriverMarker = (location: { lat: number; lng: number }) => {
    if (!map.current) return;

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLngLat([location.lng, location.lat]);
    } else {
      const driverEl = document.createElement("div");
      driverEl.innerHTML = `
        <div class="relative">
          <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-30"></div>
          <div class="relative w-12 h-12 rounded-full flex items-center justify-center shadow-lg border-2 border-white" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8);">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M5 11l1.5-4.5h11L19 11M17.5 15a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm-11 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM5 11v5a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-5H5z"/>
            </svg>
          </div>
        </div>
      `;
      driverMarkerRef.current = new mapboxgl.Marker(driverEl)
        .setLngLat([location.lng, location.lat])
        .addTo(map.current);
    }

    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend([location.lng, location.lat]);
    bounds.extend([ride.pickup_location.lng, ride.pickup_location.lat]);
    if (ride.status === "in_progress") {
      bounds.extend([ride.dropoff_location.lng, ride.dropoff_location.lat]);
    }
    map.current.fitBounds(bounds, { padding: 80, duration: 500 });
  };

  // Calculate distance between two points (Haversine formula)
  const calculateDistanceMeters = (
    loc1: { lat: number; lng: number },
    loc2: { lat: number; lng: number }
  ): number => {
    const R = 6371000;
    const dLat = ((loc2.lat - loc1.lat) * Math.PI) / 180;
    const dLng = ((loc2.lng - loc1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((loc1.lat * Math.PI) / 180) *
        Math.cos((loc2.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate ETA
  const calculateETA = async (driverLocation: { lat: number; lng: number }) => {
    const targetLocation =
      ride.status === "in_progress"
        ? ride.dropoff_location
        : ride.pickup_location;

    try {
      const response = await fetch(
        `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=directions&start=${driverLocation.lng},${driverLocation.lat}&end=${targetLocation.lng},${targetLocation.lat}`
      );
      const data = await response.json();
      if (data.routes?.[0]) {
        setEstimatedArrival(Math.round(data.routes[0].duration / 60));
      }
    } catch (error) {
      console.error("Error calculating ETA:", error);
    }
  };

  // Check if driver is approaching
  const checkDriverApproaching = useCallback(
    (driverLocation: { lat: number; lng: number }) => {
      // فقط في حالة "accepted" وقبل إرسال إشعار سابق
      if (ride.status !== "accepted" || driverApproachingNotified) return;

      const distanceToPickup = calculateDistanceMeters(
        driverLocation,
        ride.pickup_location
      );

      // إشعار واحد فقط عند الاقتراب لـ 100 متر
      if (distanceToPickup <= 100 && !driverApproachingNotified) {
        setDriverApproachingNotified(true);

        playSound("driverApproaching");
        vibrate(VibrationPatterns.driverApproaching);

        toast({
          title: "🚗 السائق اقترب جداً!",
          description: "السائق على بعد أقل من 100 متر - اخرج الآن!",
          duration: 10000,
        });

        showNotification(
          "🚗 السائق يقترب!",
          "السائق على بعد أقل من 100 متر من موقعك - اخرج الآن!",
          {
            tag: "driver-approaching",
            requireInteraction: true,
            duration: 10000,
          }
        );
      }
    },
    [ride.status, ride.pickup_location, driverApproachingNotified, toast]
  );

  // Initial driver marker and approaching check
  useEffect(() => {
    if (driver?.current_location) {
      updateDriverMarker(driver.current_location);
      calculateETA(driver.current_location);
      checkDriverApproaching(driver.current_location);
    }
  }, [driver?.current_location, checkDriverApproaching]);

  // Countdown timer effect
  useEffect(() => {
    if (ride.status !== "in_progress" || !estimatedArrival) {
      setCountdownSeconds(null);
      return;
    }

    setCountdownSeconds(estimatedArrival * 60);

    const timer = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev === null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [ride.status, estimatedArrival]);

  // Notify rider when approaching destination
  useEffect(() => {
    if (
      ride.status === "in_progress" &&
      countdownSeconds !== null &&
      countdownSeconds <= 120 &&
      countdownSeconds > 0 &&
      !approachingNotified
    ) {
      setApproachingNotified(true);

      playSound("arrived");
      vibrate([200, 100, 200]);

      toast({
        title: "📍 اقتربت من الوجهة!",
        description: "ستصل خلال دقيقتين تقريباً - استعد للنزول",
        duration: 8000,
      });

      showNotification(
        "📍 اقتربت من الوجهة!",
        "ستصل خلال دقيقتين تقريباً - استعد للنزول",
        { tag: "approaching-destination", duration: 8000 }
      );
    }
  }, [countdownSeconds, ride.status, approachingNotified, toast]);

  // Reset approaching notification when ride changes
  useEffect(() => {
    setApproachingNotified(false);
  }, [ride.id]);

  // Cancel ride handler
  const handleCancelRide = async () => {
    if (!["pending", "accepted"].includes(ride.status)) {
      toast({
        title: "لا يمكن إلغاء الرحلة",
        description: "لا يمكن إلغاء الرحلة بعد وصول السائق أو بدء التنقل",
        variant: "destructive",
      });
      return;
    }

    setIsCancelling(true);

    const { error } = await supabase
      .from("rides")
      .update({
        status: "cancelled",
        cancelled_by: "rider",
        cancellation_reason: "إلغاء من قبل الراكب",
      })
      .eq("id", ride.id);

    if (!error) {
      playSound("cancelled");
      toast({
        title: "تم إلغاء الرحلة ❌",
        description: "يمكنك طلب رحلة جديدة في أي وقت",
      });
      onClose();
    } else {
      toast({
        title: "حدث خطأ",
        description: "لم نتمكن من إلغاء الرحلة، حاول مرة أخرى",
        variant: "destructive",
      });
    }

    setIsCancelling(false);
    setShowCancelConfirm(false);
  };

  // Show completed screen if ride is completed
  if (showCompletedScreen) {
    return (
      <RideCompletedScreen
        ride={{
          id: ride.id,
          pickup_address: ride.pickup_address,
          dropoff_address: ride.dropoff_address,
          final_fare: ride.final_fare,
          estimated_fare: ride.estimated_fare,
          distance_km: ride.distance_km,
          duration_minutes: ride.duration_minutes,
          driver_id: ride.driver_id,
        }}
        driverName={driver?.full_name || "السائق"}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Side Menu */}
      <RiderSideMenu 
        user={null} 
        open={menuOpen} 
        onOpenChange={setMenuOpen}
        onLogout={() => {}} 
      />

      {/* Header - Menu Left, Logo Center, Status Icons Right */}
      <header className="absolute top-3 left-0 right-0 z-10 px-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMenuOpen(true)}
          className="bg-card/90 backdrop-blur-xl hover:bg-card shadow-lg rounded-xl w-10 h-10 border border-border/20 hover:scale-105 transition-all"
        >
          <Menu className="w-5 h-5" />
        </Button>

        <div className="flex items-center gap-2 bg-card/90 backdrop-blur-xl px-3 py-2 rounded-xl shadow-lg border border-border/20">
          <span className="font-bold text-base bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            ران
          </span>
          <img src={logo} alt="RAAN" className="w-8 h-8 rounded-lg shadow-sm" />
        </div>

        <StatusIcons
          userLocation={driver?.current_location || ride.pickup_location}
        />
      </header>

      {/* Status Progress Column - Right Side */}
      <div className="absolute top-16 right-3 z-10 flex flex-col gap-1.5">
        {[
          {
            status: "accepted",
            label: "السائق قَبِل",
            icon: UserCheck,
            color: "bg-blue-500",
          },
          {
            status: "arrived",
            label: "السائق وصل",
            icon: MapPinned,
            color: "bg-green-500",
          },
          {
            status: "in_progress",
            label: "جاري التوصيل",
            icon: Route,
            color: "bg-primary",
          },
          {
            status: "completed",
            label: "تم الوصول",
            icon: CheckCircle,
            color: "bg-emerald-500",
          },
        ].map((step, idx) => {
          const currentIndex = [
            "accepted",
            "arrived",
            "in_progress",
            "completed",
          ].indexOf(ride.status);
          const isActive = ride.status === step.status;
          const isPassed = currentIndex > idx;
          const isFuture = currentIndex < idx;
          const StepIcon = step.icon;

          return (
            <div
              key={step.status}
              className={`flex items-center gap-2 backdrop-blur-xl rounded-lg px-2.5 py-1.5 shadow-md border transition-all duration-300 ${
                isActive
                  ? "bg-green-500/90 border-green-400 scale-105 shadow-lg shadow-green-500/20"
                  : isPassed
                  ? "bg-gray-400/70 border-gray-300/50"
                  : isFuture
                  ? `${step.color}/20 border-${step.color.replace(
                      "bg-",
                      ""
                    )}/30 opacity-60`
                  : "bg-card/70 border-border/20"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                  isActive
                    ? "bg-white/20"
                    : isPassed
                    ? "bg-white/20"
                    : isFuture
                    ? step.color
                    : "bg-muted"
                }`}
              >
                <StepIcon
                  className={`w-3 h-3 transition-all ${
                    isActive
                      ? "text-white"
                      : isPassed
                      ? "text-white"
                      : isFuture
                      ? "text-white"
                      : "text-muted-foreground"
                  }`}
                />
              </div>
              <span
                className={`text-[10px] font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? "text-white"
                    : isPassed
                    ? "text-white"
                    : isFuture
                    ? "text-foreground/80"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Change Destination Sheet */}
      <ChangeDestinationSheet
        isOpen={showDestinationChange}
        onClose={() => setShowDestinationChange(false)}
        rideId={ride.id}
        currentPosition={driver?.current_location || ride.pickup_location}
        originalDropoff={ride.dropoff_location}
        originalDropoffAddress={ride.dropoff_address || ""}
        currentFare={ride.estimated_fare || 0}
        perKmFare={500}
        routeCoordinates={routeCoordinates}
        onDestinationChanged={(newDropoff, newAddress, newFare) => {
          onRideUpdate({
            ...ride,
            dropoff_location: newDropoff,
            dropoff_address: newAddress,
            estimated_fare: newFare,
          });
        }}
        onStopAdded={(stop, stopAddress, addedFare) => {
          onRideUpdate({
            ...ride,
            estimated_fare: (ride.estimated_fare || 0) + addedFare,
          });
          toast({ title: "✅ تم إضافة المحطة", description: stopAddress });
        }}
      />

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0" />
        {isLoading && (
          <div className="absolute inset-0 bg-card/80 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}
      </div>

      {/* Arrived Alert - Outside Bottom Sheet */}
      {ride.status === "arrived" && (
        <div className="px-4 pb-2">
          <div
            className={`bg-green-500/10 backdrop-blur-2xl border border-green-500/30 rounded-2xl p-3 shadow-2xl ${
              showArrivedAlert ? "animate-bounce" : ""
            }`}
          >
            <div className="flex items-center gap-2 overflow-x-auto">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-10 h-10 rounded-full bg-green-500/20 backdrop-blur-sm flex items-center justify-center animate-bounce border-2 border-green-500/40">
                  <Bell className="w-5 h-5 text-green-600" />
                </div>
                <span className="font-bold text-sm text-green-600 whitespace-nowrap">
                  🔔 السائق وصل! اخرج الآن
                </span>
              </div>

              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  className="bg-green-500 text-white hover:bg-green-600 font-bold h-10 text-xs shadow-lg whitespace-nowrap"
                  onClick={handleOnMyWay}
                >
                  🚶 أنا قادم
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500/20 font-medium h-10 text-xs whitespace-nowrap"
                  onClick={() =>
                    sendQuickMessage(
                      "rider_wait_moment",
                      "✅ تم إبلاغ السائق",
                      "السائق سينتظرك دقيقة"
                    )
                  }
                >
                  ⏱️ انتظرني دقيقة
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500/20 font-medium h-10 text-xs whitespace-nowrap"
                  onClick={() =>
                    sendQuickMessage(
                      "rider_where_are_you",
                      "✅ تم إرسال السؤال",
                      "السائق سيوضح موقعه"
                    )
                  }
                >
                  📍 أين موقعك؟
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In Progress Status - Outside Bottom Sheet */}
      {ride.status === "in_progress" && (
        <div className="px-4 pb-2">
          <div className="bg-primary/10 backdrop-blur-2xl border border-primary/30 rounded-2xl p-4 shadow-xl">
            <p className="font-bold text-sm text-primary text-center mb-3">
              🚗 بالطريق لوجهتك • استمتع برحلتك
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center gap-1.5 bg-background rounded-full px-3 py-1 shadow-sm">
                <Timer className="w-3.5 h-3.5 text-primary" />
                <span className="font-bold text-sm text-foreground">
                  {countdownSeconds !== null && countdownSeconds > 0
                    ? `${Math.floor(countdownSeconds / 60)} دقيقة`
                    : "0 دقيقة"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-background rounded-full px-3 py-1 shadow-sm">
                <Navigation className="w-3.5 h-3.5 text-primary" />
                <span className="font-bold text-sm text-foreground">
                  {remainingDistance
                    ? remainingDistance < 1
                      ? `${Math.round(remainingDistance * 1000)} م`
                      : `${remainingDistance.toFixed(1)} كم`
                    : "--"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sheet */}
      <div className="bg-card rounded-t-3xl shadow-xl border-t border-border p-4 space-y-4 max-h-[50vh] overflow-y-auto">
        {/* Safety & Share Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-4 h-4 text-green-500" />
            <span>رحلة مؤمّنة</span>
          </div>
          <div className="flex items-center gap-2">
            <EmergencyTriangleButton
              rideId={ride.id}
              currentLocation={driver?.current_location || ride.pickup_location}
            />
            <RideShareButton rideId={ride.id} />
          </div>
        </div>

        {/* Driver Info - Using new component */}
        <DriverInfoCard
          driver={driver}
          rideId={ride.id}
          rideStatus={ride.status}
        />

        {/* Trip Info with Change Destination */}
        <div className="space-y-2 pt-3 border-t border-border">
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 mt-1.5 rounded-full bg-primary" />
            <p className="text-sm text-foreground flex-1">
              {ride.pickup_address || "موقع الانطلاق"}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 mt-1.5 rounded-full bg-blue-500" />
            <p className="text-sm text-foreground flex-1">
              {ride.dropoff_address || "الوجهة"}
            </p>
            {(ride.status === "in_progress" || ride.status === "accepted") && (
              <Button
                variant="ghost"
                size="sm"
                className="text-primary text-xs h-6 px-2"
                onClick={() => {
                  console.log('[LiveRideTracker] Change destination button clicked');
                  setShowDestinationChange(true);
                }}
              >
                <Edit2 className="w-3 h-3 ml-1" />
                تغيير
              </Button>
            )}
          </div>
        </div>

        {/* Quick Reply Buttons for Accepted Status */}
        {ride.status === "accepted" && (
          <div className="pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2 text-center">
              رسائل سريعة للسائق:
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                className="bg-blue-500/10 border-blue-500/30 text-blue-600 hover:bg-blue-500/20 font-medium"
                onClick={() =>
                  sendQuickMessage(
                    "rider_waiting",
                    "✅ تم إبلاغ السائق",
                    "السائق يعلم أنك بالانتظار"
                  )
                }
              >
                👋 أنا بالانتظار
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-amber-500/10 border-amber-500/30 text-amber-600 hover:bg-amber-500/20 font-medium"
                onClick={() =>
                  sendQuickMessage(
                    "rider_where_are_you",
                    "✅ تم إرسال السؤال",
                    "السائق سيوضح موقعه"
                  )
                }
              >
                📍 أين وصلت؟
              </Button>
            </div>
          </div>
        )}

        {/* Fare Breakdown - Show for completed rides */}
        {ride.status === "completed" && ride.final_fare ? (
          <FareBreakdownCard
            baseFare={2000}
            distanceKm={ride.distance_km || 0}
            perKmRate={500}
            waitingMinutes={0}
            waitingRatePerMin={100}
            vehicleType={ride.vehicle_type}
            vehicleMultiplier={1}
            finalFare={ride.final_fare}
          />
        ) : (
          <div className="space-y-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">الأجرة المتوقعة</p>
                <p className="text-xl font-bold text-primary">
                  {(ride.estimated_fare || 0).toLocaleString()} د.ع
                </p>
              </div>
            </div>

            {/* Cancel Ride Button */}
            {["pending", "accepted"].includes(ride.status) && (
              <>
                {!showCancelConfirm ? (
                  <Button
                    variant="outline"
                    className="w-full text-destructive border-destructive/50 hover:bg-destructive/10"
                    onClick={() => setShowCancelConfirm(true)}
                  >
                    <X className="w-4 h-4 ml-2" />
                    إلغاء الرحلة
                  </Button>
                ) : (
                  <div className="bg-destructive/10 rounded-xl p-4 space-y-3 border border-destructive/30">
                    <p className="text-sm text-center text-destructive font-medium">
                      هل أنت متأكد من إلغاء الرحلة؟
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setShowCancelConfirm(false)}
                        disabled={isCancelling}
                      >
                        لا، تراجع
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={handleCancelRide}
                        disabled={isCancelling}
                      >
                        {isCancelling ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>نعم، إلغاء</>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveRideTracker;
