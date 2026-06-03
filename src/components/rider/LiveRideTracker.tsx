import React, { useEffect, useRef, useState, useCallback } from "react";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";
import { useAdaptiveRouting } from "@/hooks/useAdaptiveRouting";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { getOrCreateSharedMap } from "@/lib/googleMapService";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRiderLocation } from "@/hooks/useRiderLocation";
import DriverInfoCard from "@/components/rider/DriverInfoCard";
import ChangeDestinationSheet from "@/components/rider/ChangeDestinationSheet";
import { CancellationReasonDialog } from "@/components/rider/CancellationReasonDialog";
import { RideChat } from "@/components/rider/RideChat";
import FareBreakdownCard from "@/components/driver/FareBreakdownCard";
import { useBroadcastChannel } from "@/hooks/useBroadcastChannel";
import {
  playSound,
  vibrate,
  VibrationPatterns,
  showNotification,
  requestNotificationPermission,
} from "@/utils/rideNotificationSounds";
import {
  X,
  Loader2,
  CheckCircle,
  MapPin,
  Edit2,
  Search,
  UserCheck,
  MapPinned,
  Route,
  Menu,
  Timer,
  Navigation,
  Check,
} from "lucide-react";
import { motion } from "framer-motion";
import RiderSideMenu from "@/components/rider/RiderSideMenu";
import RiderMapHeader from "@/components/rider/RiderMapHeader";
import logo from "@/assets/logo.png";
import { carBase64 } from "@/assets/carBase64";

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
  onRebook?: () => void;
}

const LiveRideTracker: React.FC<LiveRideTrackerProps> = ({
  ride,
  onClose,
  onRideUpdate,
  onRebook,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const dropoffMarkerRef = useRef<google.maps.Marker | null>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const routeGlowRef = useRef<google.maps.Polyline | null>(null);
  const driverRouteRef = useRef<google.maps.Polyline | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);

  // 🔥 Real-time driver location tracking for rider
  // Enables continuous tracking with 5-second updates (reduced from 30s)
  const isRideActive = ['accepted', 'arrived', 'in_progress'].includes(ride.status);
  useRiderLocation({ 
    enabled: isRideActive, 
    updateInterval: 5000 // تحديث كل 5 ثواني للرؤية المباشرة
  });

  const { apiKey: googleMapsApiKey } = useGoogleMapsApiKey();
  const { getRoute: getAdaptiveRoute, currentAdapter: routingAdapter } = useAdaptiveRouting();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);
  // Leaflet fallback refs
  const osmMapRef = useRef<any>(null);
  const osmDriverMarkerRef = useRef<any>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  // ETA throttle — only fetch OSRM route every 30s or when driver moves > 300m
  const lastETAFetchRef = useRef<{ time: number; lat: number; lng: number } | null>(null);
  const [estimatedArrival, setEstimatedArrival] = useState<number | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [previousStatus, setPreviousStatus] = useState<string>(ride.status);
  const [showArrivedAlert, setShowArrivedAlert] = useState(false);
  const [approachingNotified, setApproachingNotified] = useState(false);
  const [driverApproachingNotified, setDriverApproachingNotified] =
    useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [driverCancelledRide, setDriverCancelledRide] = useState(false);
  const [showDestinationChange, setShowDestinationChange] = useState(false);
  const [remainingDistance, setRemainingDistance] = useState<number | null>(
    null
  );
  const [routeCoordinates, setRouteCoordinates] = useState<
    Array<{ lat: number; lng: number }>
  >([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lrtExpanded, setLrtExpanded] = useState(false);
  const { toast } = useToast();

  // Handle driver location update from broadcast
  const handleDriverLocationUpdate = (location: { lat: number; lng: number }) => {
    setDriver((prev) =>
      prev ? { ...prev, current_location: location } : null
    );
    updateDriverMarker(location);
    calculateETA(location);
    if (ride.status === "accepted") {
      fetchDriverToPickupRoute(location);
      checkDriverApproaching(location);
    }
  };

  // Use broadcast channel hook
  const { sendQuickMessage, handleRiderArrived } = useBroadcastChannel({
    ride,
    driver,
    onRideUpdate: (updatedRide) => onRideUpdate(updatedRide as unknown as Ride),
    onDriverLocationUpdate: handleDriverLocationUpdate,
    onClose,
    onDriverCancelled: () => setDriverCancelledRide(true),
    setShowArrivedAlert,
  });

  // Handle "I'm on my way" button for arrived status
  const handleOnMyWay = () => {
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

  // Load Google Maps API script
  useEffect(() => {
    if (typeof window === "undefined" || window.google?.maps) return;
    if (!googleMapsApiKey) {
      setMapLoadFailed(true);
      return;
    }

    loadGoogleMaps(googleMapsApiKey).catch(err => {
      console.error("LiveRideTracker: Google Maps load error", err);
    });
  }, [googleMapsApiKey]);

  // Initialize Leaflet fallback map when Google Maps is unavailable
  useEffect(() => {
    if (!mapLoadFailed || !mapContainer.current || osmMapRef.current) return;

    (async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      leafletRef.current = L;

      if (!mapContainer.current || osmMapRef.current) return;

      const osmMap = L.map(mapContainer.current, {
        center: [ride.pickup_location.lat, ride.pickup_location.lng],
        zoom: 14,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(osmMap);

      // Pickup marker (green)
      L.circleMarker([ride.pickup_location.lat, ride.pickup_location.lng], {
        radius: 10, color: '#059669', fillColor: '#34d399', fillOpacity: 0.9, weight: 2,
      }).addTo(osmMap);

      // Dropoff marker (orange)
      L.circleMarker([ride.dropoff_location.lat, ride.dropoff_location.lng], {
        radius: 10, color: '#ea580c', fillColor: '#ff9f43', fillOpacity: 0.9, weight: 2,
      }).addTo(osmMap);

      // Fit both points in view
      osmMap.fitBounds(
        L.latLngBounds([
          [ride.pickup_location.lat, ride.pickup_location.lng],
          [ride.dropoff_location.lat, ride.dropoff_location.lng],
        ]),
        { padding: [40, 40] }
      );

      osmMapRef.current = osmMap;
      setIsLoading(false);
    })();

    return () => {
      osmMapRef.current?.remove();
      osmMapRef.current = null;
      osmDriverMarkerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoadFailed]);

  // Fetch driver info
  useEffect(() => {
    const fetchDriver = async () => {
      if (!ride.driver_id) return;

      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("id", ride.driver_id)
        .maybeSingle();

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

  // Initialize Google Map
  useEffect(() => {
    if (!mapContainer.current || !googleMapsApiKey) return;

    const MAX_ATTEMPTS = 50; // ✅ FIX: حد أقصى 5 ثواني (50 * 100ms)
    let attempts = 0;
    const checkGoogleMaps = setInterval(() => {
      attempts++;
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(checkGoogleMaps);
        console.error("[LiveRideTracker] ❌ Google Maps failed to load after 5s");
        setMapLoadFailed(true);
        setIsLoading(false);
        return;
      }
      if (window.google?.maps) {
        clearInterval(checkGoogleMaps);
        if (!mapContainer.current || map.current) return;

        map.current = getOrCreateSharedMap(mapContainer.current, {
          center: { lat: ride.pickup_location.lat, lng: ride.pickup_location.lng },
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: false,
          mapTypeControl: false,
          scaleControl: false,
          streetViewControl: false,
          rotateControl: false,
          fullscreenControl: false,
          // ✅ بدون styles مخصصة — نفس المظهر الافتراضي لباقي خرائط الراكب
        });

        directionsServiceRef.current = new google.maps.DirectionsService();

        map.current.addListener("tilesloaded", () => {
          setIsLoading(false);
        });

        // إضافة علامة نقطة الانطلاق (نقطة مضيئة خضراء)
        pickupMarkerRef.current = new google.maps.Marker({
          position: ride.pickup_location,
          map: map.current,
          icon: {
            url: "data:image/svg+xml," + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
                <defs>
                  <radialGradient id="pickupGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="#34d399" stop-opacity="0.6"/>
                    <stop offset="60%" stop-color="#34d399" stop-opacity="0.15"/>
                    <stop offset="100%" stop-color="#34d399" stop-opacity="0"/>
                  </radialGradient>
                </defs>
                <circle cx="24" cy="24" r="22" fill="url(#pickupGlow)">
                  <animate attributeName="r" values="14;22;14" dur="2s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite"/>
                </circle>
                <circle cx="24" cy="24" r="8" fill="#059669" stroke="#34d399" stroke-width="3"/>
                <circle cx="24" cy="24" r="3.5" fill="#ffffff"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(48, 48),
            anchor: new google.maps.Point(24, 24),
          },
        });

        // إضافة علامة الوجهة (نقطة مضيئة برتقالية)
        dropoffMarkerRef.current = new google.maps.Marker({
          position: ride.dropoff_location,
          map: map.current,
          icon: {
            url: "data:image/svg+xml," + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
                <defs>
                  <radialGradient id="dropoffGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="#ff9f43" stop-opacity="0.6"/>
                    <stop offset="60%" stop-color="#ff9f43" stop-opacity="0.15"/>
                    <stop offset="100%" stop-color="#ff9f43" stop-opacity="0"/>
                  </radialGradient>
                </defs>
                <circle cx="24" cy="24" r="22" fill="url(#dropoffGlow)">
                  <animate attributeName="r" values="14;22;14" dur="2s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite"/>
                </circle>
                <circle cx="24" cy="24" r="8" fill="#ea580c" stroke="#ff9f43" stroke-width="3"/>
                <circle cx="24" cy="24" r="3.5" fill="#ffffff"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(48, 48),
            anchor: new google.maps.Point(24, 24),
          },
        });

        // رسم المسار
        fetchRoute();
      }
    }, 100);

    return () => {
      clearInterval(checkGoogleMaps);
      // تنظيف
      routePolylineRef.current?.setMap(null);
      routeGlowRef.current?.setMap(null);
      driverRouteRef.current?.setMap(null);
      driverMarkerRef.current?.setMap(null);
      pickupMarkerRef.current?.setMap(null);
      dropoffMarkerRef.current?.setMap(null);
      map.current = null;
    };
  }, [googleMapsApiKey]);

  // Helper: ضبط إطار الخريطة لتشمل كل النقاط
  const fitBoundsToPoints = useCallback((points: Array<{ lat: number; lng: number }>) => {
    if (!map.current || points.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    points.forEach(p => bounds.extend(p));
    map.current.fitBounds(bounds, { top: 80, bottom: 80, left: 40, right: 40 });
  }, []);

  // Helper: رسم خط على الخريطة
  const drawPolyline = useCallback((path: google.maps.LatLng[], color: string, weight: number, opacity: number, isDashed = false): google.maps.Polyline => {
    const polyline = new google.maps.Polyline({
      path,
      strokeColor: color,
      strokeWeight: weight,
      strokeOpacity: opacity,
      geodesic: true,
      ...(isDashed ? {
        icons: [{
          icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
          offset: "0",
          repeat: "15px",
        }],
        strokeOpacity: 0,
      } : {}),
    });
    polyline.setMap(map.current);
    return polyline;
  }, []);

  // Fetch route using adaptive routing (Google/OSRM fallback consistent with booking)
  const fetchRoute = async () => {
    if (!map.current) return;

    // ✅ الـ useEffect أدناه يضمن استدعاء fetchRoute فقط بعد جهوز الـ adapter
    try {
      const origin = { lat: ride.pickup_location.lat, lng: ride.pickup_location.lng };
      const destination = { lat: ride.dropoff_location.lat, lng: ride.dropoff_location.lng };
      const routeResult = await getAdaptiveRoute(origin, destination);

      if (routeResult && routeResult.path.length > 0) {
        const pathLatLng = routeResult.path.map(p => new google.maps.LatLng(p.lat, p.lng));

        // رسم خط التوهج (glow)
        routeGlowRef.current?.setMap(null);
        routeGlowRef.current = drawPolyline(pathLatLng, "#00d9a5", 12, 0.3);

        // رسم خط المسار الأساسي
        routePolylineRef.current?.setMap(null);
        routePolylineRef.current = drawPolyline(pathLatLng, "#00d9a5", 5, 1);

        // حفظ إحداثيات المسار
        setRouteCoordinates(routeResult.path);

        // المسافة المتبقية
        setRemainingDistance(routeResult.distance / 1000);

        // ضبط الإطار
        fitBoundsToPoints([ride.pickup_location, ride.dropoff_location]);
      }
    } catch (error: any) {
      // إذا الـ adapter لم يجهز بعد — الـ useEffect سيعيد المحاولة تلقائياً
      if (error?.message?.includes('not initialized')) return;
      console.error("Error fetching route via adaptive routing:", error);
    }
  };

  // ✅ إذا الـ adapter جهز بعد الخريطة — ارسم المسار تلقائياً
  useEffect(() => {
    if (routingAdapter && map.current && !routePolylineRef.current) {
      fetchRoute();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routingAdapter]);

  // Update route to destination after arrival using adaptive routing
  const updateRouteToDestination = async (driverLocation: { lat: number; lng: number }) => {
    if (!map.current) return;

    try {
      const origin = { lat: driverLocation.lat, lng: driverLocation.lng };
      const destination = { lat: ride.dropoff_location.lat, lng: ride.dropoff_location.lng };
      const routeResult = await getAdaptiveRoute(origin, destination);

      if (routeResult && routeResult.path.length > 0) {
        const pathLatLng = routeResult.path.map(p => new google.maps.LatLng(p.lat, p.lng));

        // تحديث خط المسار
        routeGlowRef.current?.setMap(null);
        routeGlowRef.current = drawPolyline(pathLatLng, "#00d9a5", 12, 0.3);

        routePolylineRef.current?.setMap(null);
        routePolylineRef.current = drawPolyline(pathLatLng, "#00d9a5", 5, 1);

        setRemainingDistance(routeResult.distance / 1000);

        fitBoundsToPoints([driverLocation, ride.dropoff_location]);
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
            updateRouteToDestination(driver.current_location);
          }
        }
      )
      .subscribe();

    let broadcastCommChannel: any = null;
    
    if (ride.driver_id) {
      // Primary: Supabase Realtime Broadcast (fast, P2P — no DB IO)
      // Note: postgres_changes on drivers removed — drivers table no longer in Realtime publication
      // Fallback: 30s polling below covers DB sync
      broadcastCommChannel = supabase
        .channel(`ride-comm-${ride.id}`)
        .on("broadcast", { event: "driver_location_update" }, (payload) => {
          const newLocation = payload.payload.location as {
            lat: number;
            lng: number;
            heading?: number;
            speed?: number;
          } | null;
          
          if (newLocation) {
            setDriver((prev) =>
              prev ? { ...prev, current_location: newLocation } : null
            );
            updateDriverMarker(newLocation);
            // ETA and Route checks might be too heavy to run on every broadcast tick, 
            // maybe throttle them, but for now we run calculateETA.
            calculateETA(newLocation);
          }
        })
        .subscribe();
    }

    return () => {
      supabase.removeChannel(rideChannel);
      if (broadcastCommChannel) supabase.removeChannel(broadcastCommChannel);
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
          .maybeSingle();

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
    // Phase 3C: fallback only — primary updates arrive via broadcast + postgres_changes.
    // 30 s is sufficient; polling more frequently wastes DB reads for each active rider.
    const interval = setInterval(pollDriverLocation, 30000);

    return () => clearInterval(interval);
  }, [ride.driver_id, ride.status, driver?.current_location]);

  // Fetch and draw route from driver to pickup
  // Fetch and draw route from driver to pickup (Optimized to reduce API costs)
  const fetchDriverToPickupRoute = async (driverLocation: {
    lat: number;
    lng: number;
  }) => {
    if (!map.current || ride.status === "in_progress") return;

    try {
      // 🛑 بناءً على طلبك، تم إلغاء رسم مَسار السائق والخط المستقيم بالكامل، فقط نظهر السيارة.
      driverRouteRef.current?.setMap(null);
    } catch (error) {
      console.error("Error drawing driver route:", error);
    }
  };

  // Helper: Calculate heading between two coordinates
  const calculateHeading = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const l1 = lat1 * Math.PI / 180;
    const l2 = lat2 * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(l2);
    const x = Math.cos(l1) * Math.sin(l2) - Math.sin(l1) * Math.cos(l2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  };

  // Update driver marker on map with smooth animation
  const animationRef = useRef<number | null>(null);

  const updateDriverMarker = (location: { lat: number; lng: number; heading?: number; speed?: number }) => {
    // Leaflet fallback mode — simple marker update, no animations
    if (osmMapRef.current && leafletRef.current) {
      const L = leafletRef.current;
      if (!osmDriverMarkerRef.current) {
        osmDriverMarkerRef.current = L.circleMarker([location.lat, location.lng], {
          radius: 8, color: '#0d9488', fillColor: '#14b8a6', fillOpacity: 1, weight: 2,
        }).addTo(osmMapRef.current);
      } else {
        osmDriverMarkerRef.current.setLatLng([location.lat, location.lng]);
      }
      return;
    }

    if (!map.current) return;

    let targetHeading = location.heading || 0;
    
    // Fallback: calculate heading if device didn't provide one
    if (!location.heading && driverMarkerRef.current) {
      const prevPos = driverMarkerRef.current.getPosition();
      if (prevPos) {
        const pLat = prevPos.lat();
        const pLng = prevPos.lng();
        if (pLat !== location.lat || pLng !== location.lng) {
          targetHeading = calculateHeading(pLat, pLng, location.lat, location.lng);
        }
      }
    }

    const drawCarIcon = (currentHeading: number) => {
      const carSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
          <defs>
            <linearGradient id="lightBeam" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.6"/>
              <stop offset="100%" stop-color="#fbbf24" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <g transform="rotate(${Math.round(currentHeading)} 40 40)">
            <!-- Soft shadow -->
            <ellipse cx="40" cy="41.6" rx="30" ry="15" fill="black" opacity="0.25" transform="rotate(90 40 40)" />
            
            <!-- Headlight beams (beams of light pointing forward) -->
            <path d="M 32.5,13.3 L 16.7,-13.3 L 38.3,-13.3 Z" fill="url(#lightBeam)" />
            <path d="M 47.5,13.3 L 41.7,-13.3 L 63.3,-13.3 Z" fill="url(#lightBeam)" />

            <!-- Car image (rotated 90deg to face UP) -->
            <image href="${carBase64}" x="6.7" y="20.6" width="66.6" height="38.8" transform="rotate(90 40 40)" />
          </g>
        </svg>
      `;
      return {
        url: "data:image/svg+xml," + encodeURIComponent(carSvg),
        scaledSize: new google.maps.Size(80, 80),
        anchor: new google.maps.Point(40, 40),
      };
    };

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new google.maps.Marker({
        position: location,
        map: map.current,
        icon: drawCarIcon(targetHeading),
      });
      return;
    }

    // Smooth Interpolation
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    const startPos = driverMarkerRef.current.getPosition();
    if (!startPos) return;

    const startLat = startPos.lat();
    const startLng = startPos.lng();
    const endLat = location.lat;
    const endLng = location.lng;
    
    // Skip animation if distance is too small (e.g., GPS jitter) or too large (e.g., jump)
    const distance = Math.sqrt(Math.pow(endLat - startLat, 2) + Math.pow(endLng - startLng, 2));
    if (distance < 0.00001 || distance > 0.01) {
      driverMarkerRef.current.setPosition(location);
      driverMarkerRef.current.setIcon(drawCarIcon(targetHeading));
      return;
    }

    const duration = 1000; // 1 second animation to match broadcast frequency
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease out cubic)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const currentLat = startLat + (endLat - startLat) * easeProgress;
      const currentLng = startLng + (endLng - startLng) * easeProgress;
      
      driverMarkerRef.current!.setPosition({ lat: currentLat, lng: currentLng });
      driverMarkerRef.current!.setIcon(drawCarIcon(targetHeading)); // Keep heading static for duration of animation

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    // ضبط إطار الخريطة ليشمل السائق والنقاط المهمة
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(location);
    bounds.extend(ride.pickup_location);
    if (ride.status === "in_progress") {
      bounds.extend(ride.dropoff_location);
    }
    // We might not want to fitBounds on EVERY tick, because it ruins dragging the map.
    // Let's only fit bounds if it's the first time or if requested.
    // Commented out to allow user to drag map around without being snapped back immediately.
    // map.current.fitBounds(bounds, { top: 80, bottom: 80, left: 40, right: 40 });
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

  // Calculate ETA via OSRM adaptive routing (throttled: max once per 30s or every 300m moved).
  // Falls back to Haversine only if the routing adapter fails completely.
  const calculateETA = async (driverLocation: { lat: number; lng: number }) => {
    const targetLocation =
      ride.status === "in_progress"
        ? ride.dropoff_location
        : ride.pickup_location;

    const now = Date.now();
    const last = lastETAFetchRef.current;
    if (last) {
      const movedMeters = calculateDistanceMeters(
        { lat: last.lat, lng: last.lng },
        driverLocation
      );
      if ((now - last.time) < 30_000 && movedMeters < 300) return; // still fresh
    }

    try {
      const route = await getAdaptiveRoute(
        { lat: driverLocation.lat, lng: driverLocation.lng },
        { lat: targetLocation.lat, lng: targetLocation.lng }
      );
      lastETAFetchRef.current = { time: now, lat: driverLocation.lat, lng: driverLocation.lng };
      setEstimatedArrival(Math.max(1, Math.round(route.duration / 60)));
    } catch {
      // OSRM failed — apply the same 30s cooldown so we don't hammer it on every
      // location update, and fall back to Haversine for this cycle.
      lastETAFetchRef.current = { time: now, lat: driverLocation.lat, lng: driverLocation.lng };
      const distanceMeters = calculateDistanceMeters(driverLocation, targetLocation);
      setEstimatedArrival(Math.max(1, Math.round(distanceMeters / 8.33 / 60)));
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

  // Cancel ride handler — via atomic RPC
  const handleCancelRide = async (reason?: string) => {
    if (!["pending", "accepted", "arrived"].includes(ride.status)) {
      toast({
        title: "لا يمكن إلغاء الرحلة",
        description: "لا يمكن إلغاء الرحلة بعد بدء المشوار",
        variant: "destructive",
      });
      return;
    }

    setIsCancelling(true);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        toast({ title: "خطأ", description: "يرجى تسجيل الدخول مرة أخرى", variant: "destructive" });
        setIsCancelling(false);
        return;
      }

      // ═══ استدعاء RPC الذري ═══
      const { data: cancelResult, error } = await supabase.rpc(
        'cancel_ride_by_rider' as any,
        {
          p_ride_id: ride.id,
          p_rider_user_id: currentUser.id,
          p_reason: reason || "إلغاء من قبل الراكب",
        }
      );

      if (error) {
        console.error("[LiveTracker] ❌ Cancel RPC error:", error.message);
        toast({ title: "حدث خطأ", description: "لم نتمكن من إلغاء الرحلة، حاول مرة أخرى", variant: "destructive" });
      } else {
        const result = cancelResult as { success: boolean; penalty_amount?: number; penalty_paid?: boolean; error?: string } | null;
        if (result?.success) {
          playSound("cancelled");
          const penaltyAmount = result.penalty_amount || 0;
          if (penaltyAmount > 0 && result.penalty_paid) {
            toast({
              title: "تم إلغاء الرحلة ❌",
              description: `تم إلغاء الرحلة وخصم غرامة إلغاء: ${penaltyAmount.toLocaleString()} د.ع من محفظتك`,
            });
          } else if (penaltyAmount > 0 && !result.penalty_paid) {
            toast({
              title: "تم إلغاء الرحلة ❌",
              description: "تم إلغاء الرحلة. لم يُخصم شيء من محفظتك لعدم كفاية الرصيد.",
            });
          } else {
            toast({
              title: "تم إلغاء الرحلة ❌",
              description: "تم إلغاء الرحلة بنجاح دون أي غرامات",
            });
          }
          onClose();
        } else {
          toast({
            title: "حدث خطأ",
            description: result?.error || "لا يمكن إلغاء الرحلة في هذه المرحلة",
            variant: "destructive",
          });
        }
      }
    } catch (err) {
      console.error("[LiveTracker] ❌ Cancel exception:", err);
      toast({ title: "حدث خطأ", description: "حدث خطأ غير متوقع أثناء الإلغاء", variant: "destructive" });
    }

    setIsCancelling(false);
    setShowCancelConfirm(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-[480px] mx-auto">
      {/* Side Menu */}
      <RiderSideMenu 
        open={menuOpen} 
        onOpenChange={setMenuOpen}
        onLogout={() => {}} 
      />

      {/* Header — Premium glassmorphism header */}
      <RiderMapHeader
        onMenuOpen={() => setMenuOpen(true)}
        stepLabel={ride.status === 'accepted' ? 'السائق في الطريق' : ride.status === 'arrived' ? 'السائق وصل' : ride.status === 'in_progress' ? 'في الرحلة' : 'تتبع الرحلة'}
      />

      {/* Status Floating Card - ملتصقة بالحافة — ملونة حسب المرحلة */}
      <div className="absolute z-10" dir="rtl" style={{ top: 'calc(3.5rem + env(safe-area-inset-top) + 8px)', right: '0' }}>
        {ride.status === "accepted" && (
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            className="bg-gradient-to-l from-blue-600/80 to-blue-800/70 backdrop-blur-xl border border-blue-400/20 rounded-l-2xl rounded-r-none border-r-0 px-4 py-2.5 shadow-lg shadow-blue-900/30"
          >
            <p className="text-[10px] text-blue-200/80 font-medium">السائق في الطريق</p>
            <p className="text-lg font-black tabular-nums text-white">
              {estimatedArrival ? `${estimatedArrival} د` : "—"}
            </p>
          </motion.div>
        )}

        {ride.status === "arrived" && (
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            className="bg-gradient-to-l from-emerald-600/80 to-teal-800/70 backdrop-blur-xl border border-emerald-400/20 rounded-l-2xl rounded-r-none border-r-0 px-4 py-2.5 shadow-lg shadow-emerald-900/30"
          >
            <p className="text-[10px] text-emerald-200/80 font-medium">السائق وصل</p>
            <p className="text-lg font-black text-white">بانتظارك</p>
          </motion.div>
        )}

        {ride.status === "in_progress" && (
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            className="bg-gradient-to-l from-violet-600/80 to-purple-800/70 backdrop-blur-xl border border-violet-400/20 rounded-l-2xl rounded-r-none border-r-0 px-4 py-2.5 shadow-lg shadow-violet-900/30"
          >
            <p className="text-[10px] text-violet-200/80 font-medium">في الرحلة</p>
            <p className="text-lg font-black tabular-nums text-white">
              {remainingDistance
                ? remainingDistance < 1
                  ? `${Math.round(remainingDistance * 1000)} م`
                  : `${remainingDistance.toFixed(1)} كم`
                : estimatedArrival ? `${estimatedArrival} د` : "—"}
            </p>
          </motion.div>
        )}
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
        <div ref={mapContainer} className="absolute inset-0 bg-gray-100 dark:bg-gray-800" />
        {isLoading && (
          <div className="absolute inset-0 bg-card/80 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}
      </div>



      {/* Bottom Sheet */}
      <motion.div
        animate={{ height: lrtExpanded ? '85dvh' : '40dvh' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col bg-[#0d1321] border-t border-slate-800/40"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
          if (info.offset.y < -40 || info.velocity.y < -400) setLrtExpanded(true);
          else if (info.offset.y > 40 || info.velocity.y > 400) setLrtExpanded(false);
        }}
      >
        {/* Drag Handle */}
        <button
          onClick={() => setLrtExpanded(v => !v)}
          aria-label={lrtExpanded ? 'تصغير الورقة السفلية' : 'توسيع الورقة السفلية'}
          title={lrtExpanded ? 'تصغير' : 'توسيع'}
          className="w-full pt-2 pb-1 flex justify-center cursor-grab active:cursor-grabbing shrink-0"
        >
          <motion.div
            className="rounded-full"
            animate={{
              width: lrtExpanded ? 32 : 48,
              backgroundColor: lrtExpanded ? 'rgb(0,179,176)' : 'rgb(209,213,219)',
            }}
            style={{ height: 5 }}
            transition={{ duration: 0.25 }}
          />
        </button>

        <div className="flex-1 overflow-y-auto px-4" style={{ paddingBottom: 'max(1rem, var(--safe-area-bottom, 0px))' }} dir="rtl">

        {/* ── بطاقة حالة الرحلة (In Progress) ── */}
        {ride.status === "in_progress" && (
          <div className="rounded-2xl p-3.5 mb-3 bg-white/[0.04] flex items-center justify-between gap-4">
            <div className="flex flex-col items-center flex-1">
              <span className="text-[10px] text-slate-500 mb-1">الوقت</span>
              <span className="font-bold text-[15px] text-white tabular-nums">
                {countdownSeconds !== null && countdownSeconds > 0
                  ? `${Math.floor(countdownSeconds / 60)} د`
                  : "0 د"}
              </span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex flex-col items-center flex-1">
              <span className="text-[10px] text-slate-500 mb-1">المسافة</span>
              <span className="font-bold text-[15px] text-white tabular-nums">
                {remainingDistance
                  ? remainingDistance < 1
                    ? `${Math.round(remainingDistance * 1000)} م`
                    : `${remainingDistance.toFixed(1)} كم`
                  : "--"}
              </span>
            </div>
          </div>
        )}

        {/* ══ بطاقة تفاصيل الرحلة الموحدة ══ */}
        <div className="rounded-2xl overflow-hidden mb-2 bg-white/[0.03] border border-white/[0.06]">
          {/* بيانات السائق */}
          <DriverInfoCard
            driver={driver}
            rideId={ride.id}
            rideStatus={ride.status}
            estimatedFare={ride.estimated_fare ?? undefined}
            currentLocation={driver?.current_location || ride.pickup_location}
            driverPhone={driver?.phone ?? undefined}
          >
            {/* شريط الإجراءات السريعة */}
            <div className="flex items-center gap-2 overflow-x-auto px-4 py-2.5 border-t border-white/[0.06] scrollbar-hide">
              <RideChat
                rideId={ride.id}
                userType="rider"
                rideStatus={ride.status}
                driverPhone={driver?.phone ?? undefined}
                pickupAddress={ride.pickup_address ?? undefined}
              />

              {(ride.status === "accepted" || ride.status === "arrived") && (
                <>
                  <div className="w-px h-5 shrink-0 bg-white/10" />
                  {ride.status === "accepted" && (
                    <>
                      <button
                        onClick={() => sendQuickMessage("rider_waiting", "✅ تم إبلاغ السائق", "السائق يعلم أنك بالانتظار")}
                        className="shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all active:scale-95 bg-white/[0.07] text-slate-300 hover:bg-white/[0.12]"
                      >
                        👋 بالانتظار
                      </button>
                      <button
                        onClick={() => sendQuickMessage("rider_where_are_you", "✅ تم إرسال السؤال", "السائق سيوضح موقعه")}
                        className="shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all active:scale-95 bg-white/[0.07] text-slate-300 hover:bg-white/[0.12]"
                      >
                        📍 أين وصلت؟
                      </button>
                    </>
                  )}
                  {ride.status === "arrived" && (
                    <>
                      <button
                        onClick={() => sendQuickMessage("rider_where_are_you", "✅ تم إرسال السؤال", "السائق سيوضح موقعه")}
                        className="shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all active:scale-95 bg-white/[0.07] text-slate-300 hover:bg-white/[0.12]"
                      >
                        📍 أين موقعك؟
                      </button>
                      <button
                        onClick={() => sendQuickMessage("rider_wait_moment", "✅ تم إبلاغ السائق", "السائق سينتظرك قليلاً")}
                        className="shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all active:scale-95 bg-white/[0.07] text-slate-300 hover:bg-white/[0.12]"
                      >
                        ⏱️ انتظرني
                      </button>
                    </>
                  )}
                  
                  {/* زر إلغاء الرحلة */}
                  <div className="w-px h-5 shrink-0 bg-white/10" />
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all active:scale-95 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                  >
                    ✕ إلغاء الرحلة
                  </button>
                </>
              )}
            </div>
          </DriverInfoCard>

          {/* خط سير الرحلة */}
          <div className="border-t border-white/[0.06] px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center mt-1.5">
                <div className="w-3 h-3 rounded-full bg-white" />
                <div className="w-px h-7 bg-white/20 my-1" />
                <div className="w-3 h-3 rounded-sm bg-slate-400" />
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-4">
                <div>
                  <p className="text-[10px] text-slate-500 mb-0.5">الانطلاق</p>
                  <p className="text-[13px] font-semibold text-white truncate">{ride.pickup_address || "موقع الانطلاق"}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-500 mb-0.5">الوجهة</p>
                    <p className="text-[13px] font-semibold text-white truncate">{ride.dropoff_address || "الوجهة"}</p>
                  </div>
                  {(ride.status === "in_progress" || ride.status === "accepted") && (
                    <button
                      onClick={() => setShowDestinationChange(true)}
                      className="shrink-0 px-3 py-1 rounded-full text-[10px] font-bold transition-all active:scale-95 bg-white/[0.07] text-slate-300 hover:bg-white/[0.12]"
                    >
                      تغيير
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* تفاصيل الأجرة (مكتملة فقط) */}
          {ride.status === "completed" && ride.final_fare ? (
            <div className="border-t border-white/[0.06]">
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
            </div>
          ) : null}
        </div>
        </div>
      </motion.div>

      {/* ✅ شاشة إلغاء السائق مع خيار إعادة الحجز */}
      {driverCancelledRide && (
        <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center gap-6 p-6">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
            <X className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground text-center">
            السائق ألغى الرحلة
          </h2>
          <p className="text-muted-foreground text-center text-sm">
            يمكنك طلب سائق آخر بنفس التفاصيل
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {onRebook && (
              <Button
                onClick={() => {
                  setDriverCancelledRide(false);
                  onRebook();
                }}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3"
              >
                <Search className="w-4 h-4 ml-2" />
                طلب سائق آخر
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setDriverCancelledRide(false);
                onClose();
              }}
              className="w-full"
            >
              العودة للرئيسية
            </Button>
          </div>
        </div>
      )}
      
      <CancellationReasonDialog
        open={showCancelConfirm}
        onOpenChange={setShowCancelConfirm}
        onConfirm={(reason) => handleCancelRide(reason)}
        isLoading={isCancelling}
        rideStatus={ride.status}
        estimatedFare={ride.estimated_fare || 0}
      />
    </div>
  );
};

export default LiveRideTracker;
