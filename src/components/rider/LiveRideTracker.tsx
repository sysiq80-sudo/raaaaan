import React, { useEffect, useRef, useState, useCallback } from "react";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRiderLocation } from "@/hooks/useRiderLocation";
import DriverInfoCard from "@/components/rider/DriverInfoCard";
import ChangeDestinationSheet from "@/components/rider/ChangeDestinationSheet";
import { RideChat } from "@/components/rider/RideChat";
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
  const [driver, setDriver] = useState<Driver | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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
    onRideUpdate,
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
    if (!googleMapsApiKey) return;

    loadGoogleMaps(googleMapsApiKey).catch(err => {
      console.error("LiveRideTracker: Google Maps load error", err);
    });
  }, [googleMapsApiKey]);

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
        setIsLoading(false);
        return;
      }
      if (window.google?.maps) {
        clearInterval(checkGoogleMaps);
        if (!mapContainer.current || map.current) return;

        map.current = new google.maps.Map(mapContainer.current, {
          center: { lat: ride.pickup_location.lat, lng: ride.pickup_location.lng },
          zoom: 14,
          tilt: 45,
          disableDefaultUI: true,
          zoomControl: false,
          mapTypeControl: false,
          scaleControl: false,
          streetViewControl: false,
          rotateControl: false,
          fullscreenControl: false,
          styles: [
            // نمط داكن مشابه لـ dark-v11
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
            { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
            { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
            { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
            { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
            { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
            { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
            { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
            { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
            { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
            { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
            { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
            { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
            { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
          ],
        });

        directionsServiceRef.current = new google.maps.DirectionsService();

        map.current.addListener("tilesloaded", () => {
          setIsLoading(false);
        });

        // إضافة علامة نقطة الانطلاق (أخضر زمردي فاخر)
        pickupMarkerRef.current = new google.maps.Marker({
          position: ride.pickup_location,
          map: map.current,
          icon: {
            url: "data:image/svg+xml," + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="56" viewBox="0 0 48 56">
                <!-- Drop shadow -->
                <ellipse cx="24" cy="52" rx="14" ry="4" fill="black" opacity="0.2"/>
                <!-- Pin base -->
                <path d="M24 50 C24 50 40 32 40 20 C40 8 32 0 24 0 C16 0 8 8 8 20 C8 32 24 50 24 50 Z" fill="url(#mainGrad)"/>
                <!-- Inner glow -->
                <path d="M24 48 C24 48 38 31 38 20 C38 10 31 3 24 3 C17 3 10 10 10 20 C10 31 24 48 24 48 Z" fill="none" stroke="white" stroke-width="1.5" stroke-opacity="0.5"/>
                <!-- Circle hole -->
                <circle cx="24" cy="20" r="10" fill="white" shadow="0 2px 4px rgba(0,0,0,0.2)"/>
                <!-- Inner dot -->
                <circle cx="24" cy="20" r="4" fill="#059669"/>
                
                <defs>
                  <linearGradient id="mainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#34d399"/>
                    <stop offset="100%" stop-color="#059669"/>
                  </linearGradient>
                </defs>
              </svg>
            `),
            scaledSize: new google.maps.Size(42, 50),
            anchor: new google.maps.Point(21, 50),
          },
        });

        // إضافة علامة الوجهة (أخضر زمردي داكن)
        dropoffMarkerRef.current = new google.maps.Marker({
          position: ride.dropoff_location,
          map: map.current,
          icon: {
            url: "data:image/svg+xml," + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="56" viewBox="0 0 48 56">
                <!-- Drop shadow -->
                <ellipse cx="24" cy="52" rx="14" ry="4" fill="black" opacity="0.2"/>
                <!-- Pin base -->
                <path d="M24 50 C24 50 40 32 40 20 C40 8 32 0 24 0 C16 0 8 8 8 20 C8 32 24 50 24 50 Z" fill="url(#dropoffGrad)"/>
                <!-- Inner glow -->
                <path d="M24 48 C24 48 38 31 38 20 C38 10 31 3 24 3 C17 3 10 10 10 20 C10 31 24 48 24 48 Z" fill="none" stroke="white" stroke-width="1.5" stroke-opacity="0.5"/>
                <!-- Square Check (Destination) -->
                <rect x="16" y="12" width="16" height="16" rx="4" fill="white" shadow="0 2px 4px rgba(0,0,0,0.2)"/>
                <path d="M19 20 l3 3 l7 -7" fill="none" stroke="#047857" stroke-width="2.5" stroke-linecap="round"/>
                
                <defs>
                  <linearGradient id="dropoffGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#10b981"/>
                    <stop offset="100%" stop-color="#047857"/>
                  </linearGradient>
                </defs>
              </svg>
            `),
            scaledSize: new google.maps.Size(42, 50),
            anchor: new google.maps.Point(21, 50),
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

  // Fetch route using Google Directions
  const fetchRoute = async () => {
    if (!map.current || !directionsServiceRef.current) return;

    try {
      const result = await directionsServiceRef.current.route({
        origin: ride.pickup_location,
        destination: ride.dropoff_location,
        travelMode: google.maps.TravelMode.DRIVING,
      });

      if (result.routes?.[0]) {
        const route = result.routes[0];
        const path = route.overview_path;

        // رسم خط التوهج (glow)
        routeGlowRef.current?.setMap(null);
        routeGlowRef.current = drawPolyline(path, "#00d9a5", 12, 0.3);

        // رسم خط المسار الأساسي
        routePolylineRef.current?.setMap(null);
        routePolylineRef.current = drawPolyline(path, "#00d9a5", 5, 1);

        // حفظ إحداثيات المسار
        const coords = path.map(p => ({ lng: p.lng(), lat: p.lat() }));
        setRouteCoordinates(coords);
        
        // المسافة المتبقية
        const leg = route.legs?.[0];
        if (leg?.distance?.value) {
          setRemainingDistance(leg.distance.value / 1000);
        }

        // ضبط الإطار
        fitBoundsToPoints([ride.pickup_location, ride.dropoff_location]);
      }
    } catch (error) {
      console.error("Error fetching route:", error);
    }
  };

  // Update route to destination after arrival
  const updateRouteToDestination = async (driverLocation: { lat: number; lng: number }) => {
    if (!map.current || !directionsServiceRef.current) return;

    try {
      const result = await directionsServiceRef.current.route({
        origin: driverLocation,
        destination: ride.dropoff_location,
        travelMode: google.maps.TravelMode.DRIVING,
      });

      if (result.routes?.[0]) {
        const route = result.routes[0];
        const path = route.overview_path;

        // تحديث خط المسار
        routeGlowRef.current?.setMap(null);
        routeGlowRef.current = drawPolyline(path, "#00d9a5", 12, 0.3);

        routePolylineRef.current?.setMap(null);
        routePolylineRef.current = drawPolyline(path, "#00d9a5", 5, 1);

        const leg = route.legs?.[0];
        if (leg?.distance?.value) {
          setRemainingDistance(leg.distance.value / 1000);
        }

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

    let driverChannel: any = null;
    let broadcastCommChannel: any = null;
    
    if (ride.driver_id) {
      // 1. Fallback: PostgreSQL updates (slow, every ~10s or 5s)
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
        
      // 2. High-Frequency: Supabase Realtime Broadcast (fast, native-like)
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
      if (driverChannel) supabase.removeChannel(driverChannel);
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
    const interval = setInterval(pollDriverLocation, 5000);

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
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
          <g transform="rotate(${Math.round(currentHeading)} 24 24)">
            <!-- Soft shadow -->
            <rect x="16" y="8" width="16" height="32" rx="6" fill="black" opacity="0.3"/>
            <!-- Car body (Premium sleek design, emerald tinted dark) -->
            <rect x="16" y="6" width="16" height="32" rx="6" fill="#0f172a" stroke="#5bdda6" stroke-width="1.5"/>
            <!-- Windshield -->
            <path d="M18 16 Q24 14 30 16 L29 20 L19 20 Z" fill="#020617"/>
            <!-- Rear Window -->
            <path d="M18 30 Q24 32 30 30 L29 26 L19 26 Z" fill="#020617"/>
            <!-- Headlights -->
            <rect x="17" y="6" width="3" height="2" fill="#fbbf24" rx="1"/>
            <rect x="28" y="6" width="3" height="2" fill="#fbbf24" rx="1"/>
            <!-- Tail lights -->
            <rect x="17" y="36" width="4" height="2" fill="#ef4444" rx="1"/>
            <rect x="27" y="36" width="4" height="2" fill="#ef4444" rx="1"/>
            <!-- Mirrors -->
            <rect x="14" y="18" width="2" height="3" fill="#1e293b" rx="1"/>
            <rect x="32" y="18" width="2" height="3" fill="#1e293b" rx="1"/>
          </g>
        </svg>
      `;
      return {
        url: "data:image/svg+xml," + encodeURIComponent(carSvg),
        scaledSize: new google.maps.Size(48, 48),
        anchor: new google.maps.Point(24, 24),
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

  // Calculate ETA using Google Directions
  const calculateETA = async (driverLocation: { lat: number; lng: number }) => {
    const targetLocation =
      ride.status === "in_progress"
        ? ride.dropoff_location
        : ride.pickup_location;

    try {
      // 🚫 STOPPED using Directions API for real-time ETA to prevent massive cost.
      // Fallback: Haversine distance with assumed 30km/h average city speed (8.33 m/s).
      const distanceMeters = calculateDistanceMeters(driverLocation, targetLocation);
      const durationSec = distanceMeters / 8.33; 
      setEstimatedArrival(Math.max(1, Math.round(durationSec / 60)));
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
        <div className="flex items-center gap-2 bg-card/90 backdrop-blur-xl px-3 py-2 rounded-xl shadow-lg border border-border/20">
          <span className="font-bold text-base bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            ران
          </span>
          <img src={logo} alt="RAAN" className="w-8 h-8 rounded-lg shadow-sm" />
        </div>




        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMenuOpen(true)}
          className="bg-card/90 backdrop-blur-xl hover:bg-card shadow-lg rounded-xl w-10 h-10 border border-border/20 hover:scale-105 transition-all"
        >
          <Menu className="w-5 h-5" />
        </Button>
      </header>

      {/* Status Progress Column - Right Side */}
      <div className="absolute top-16 right-3 z-10" dir="rtl">
        <div className="rounded-2xl px-2.5 py-3 flex flex-col items-center gap-0" style={{ background: 'rgba(11,19,38,0.92)', backdropFilter: 'blur(16px)', border: '1px solid rgba(91,221,166,0.12)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          {[
            { status: 'accepted', label: 'قَبِل', icon: UserCheck, num: 1 },
            { status: 'arrived', label: 'وصل', icon: MapPinned, num: 2 },
            { status: 'in_progress', label: 'بالطريق', icon: Route, num: 3 },
            { status: 'completed', label: 'وصلنا', icon: CheckCircle, num: 4 },
          ].map((step, idx, arr) => {
            const statusOrder = ['accepted', 'arrived', 'in_progress', 'completed'];
            const currentIdx = statusOrder.indexOf(ride.status);
            const isActive = currentIdx === idx;
            const isPassed = currentIdx > idx;
            const StepIcon = step.icon;

            return (
              <React.Fragment key={step.status}>
                {/* الخطوة */}
                <div className="flex items-center gap-2 w-full">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-500 ${
                      isPassed
                        ? 'bg-[#5bdda6]'
                        : isActive
                        ? 'border-2 border-[#5bdda6]'
                        : 'border border-white/10'
                    }`}
                    style={isActive ? { background: 'rgba(91,221,166,0.15)', boxShadow: '0 0 12px rgba(91,221,166,0.3)' } : isPassed ? { boxShadow: '0 0 8px rgba(91,221,166,0.25)' } : { background: '#151f30' }}
                  >
                    {isPassed ? (
                      <Check className="w-3.5 h-3.5 text-[#0b1326]" />
                    ) : (
                      <StepIcon className={`w-3 h-3 ${isActive ? 'text-[#5bdda6]' : 'text-white/25'}`} />
                    )}
                  </div>
                  <span className={`text-[10px] font-bold whitespace-nowrap transition-all ${
                    isActive ? 'text-[#5bdda6]' : isPassed ? 'text-[#5bdda6]/50' : 'text-white/20'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {/* خط الربط */}
                {idx < arr.length - 1 && (
                  <div className="flex justify-start w-full pr-[13px]">
                    <div className={`w-px h-3 transition-colors duration-500 ${
                      isPassed ? 'bg-[#5bdda6]/40' : 'bg-white/6'
                    }`} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
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
        animate={{ height: lrtExpanded ? '85dvh' : '50dvh' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
        style={{ background: '#0b1326', borderTop: '1px solid rgba(91,221,166,0.15)' }}
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
              backgroundColor: lrtExpanded ? 'rgb(52,211,153)' : 'rgb(100,116,139)',
            }}
            style={{ height: 5 }}
            transition={{ duration: 0.25 }}
          />
        </button>

        <div className="flex-1 overflow-y-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" dir="rtl" style={{ background: '#0b1326' }}>

        {/* ── بطاقة حالة الرحلة (In Progress) ── */}
        {ride.status === "in_progress" && (
          <div className="rounded-xl p-3 mb-2" style={{ background: 'rgba(91,221,166,0.08)', border: '1px solid rgba(91,221,166,0.15)' }}>
            <p className="font-bold text-[12px] text-center mb-2" style={{ color: '#5bdda6' }}>
              🚗 بالطريق لوجهتك • استمتع برحلتك
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <Timer className="w-3.5 h-3.5" style={{ color: '#5bdda6' }} />
                <span className="font-bold text-[12px] text-white">
                  {countdownSeconds !== null && countdownSeconds > 0
                    ? `${Math.floor(countdownSeconds / 60)} دقيقة`
                    : "0 دقيقة"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <Navigation className="w-3.5 h-3.5" style={{ color: '#5bdda6' }} />
                <span className="font-bold text-[12px] text-white">
                  {remainingDistance
                    ? remainingDistance < 1
                      ? `${Math.round(remainingDistance * 1000)} م`
                      : `${remainingDistance.toFixed(1)} كم`
                    : "--"}
                </span>
              </div>
            </div>
          </div>
        )}



        {/* ══════════════════════════════════════════════════ */}
        {/* ══  بطاقة السائق الموحّدة (Premium Unified Card) ══ */}
        {/* ══════════════════════════════════════════════════ */}
        <div
          className="rounded-2xl overflow-hidden mb-2"
          style={{
            background: 'linear-gradient(180deg, #111b2e 0%, #0d1525 100%)',
            border: '1px solid rgba(91,221,166,0.12)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          }}
        >
          {/* ─── 1. بيانات السائق (الأهمية القصوى) ─── */}
          <DriverInfoCard
            driver={driver}
            rideId={ride.id}
            rideStatus={ride.status}
            estimatedFare={ride.estimated_fare}
            currentLocation={driver?.current_location || ride.pickup_location}
          >
            {/* ─── 2. شريط الإجراءات السريعة ─── */}
            <div
              className="flex items-center gap-1.5 overflow-x-auto px-3 py-2"
              style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
            >
              <RideChat
                rideId={ride.id}
                userType="rider"
                rideStatus={ride.status}
                driverPhone={driver?.phone ?? undefined}
                pickupAddress={ride.pickup_address ?? undefined}
              />
              {driver?.phone && (
                <a
                  href={`tel:${driver.phone}`}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95"
                  style={{ background: 'rgba(34,197,94,0.08)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.15)' }}
                >
                  📞 اتصال
                </a>
              )}

              {/* فاصل */}
              <div className="w-px h-5 shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />

              {/* رسائل سريعة سياقية */}
              {(ride.status === "accepted" || ride.status === "arrived") && (
                <>
                  {ride.status === "accepted" && (
                    <>
                      <button
                        onClick={() => sendQuickMessage("rider_waiting", "✅ تم إبلاغ السائق", "السائق يعلم أنك بالانتظار")}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95"
                        style={{ background: 'rgba(59,130,246,0.08)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.15)' }}
                      >
                        👋 بالانتظار
                      </button>
                      <button
                        onClick={() => sendQuickMessage("rider_where_are_you", "✅ تم إرسال السؤال", "السائق سيوضح موقعه")}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95"
                        style={{ background: 'rgba(245,158,11,0.08)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.15)' }}
                      >
                        📍 أين وصلت؟
                      </button>
                    </>
                  )}
                  {ride.status === "arrived" && (
                    <>
                      <button
                        onClick={() => sendQuickMessage("rider_where_are_you", "✅ تم إرسال السؤال", "السائق سيوضح موقعه")}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95"
                        style={{ background: 'rgba(168,85,247,0.08)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.15)' }}
                      >
                        📍 أين موقعك؟
                      </button>
                      <button
                        onClick={() => sendQuickMessage("rider_wait_moment", "✅ تم إبلاغ السائق", "السائق سينتظرك قليلاً")}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95"
                        style={{ background: 'rgba(249,115,22,0.08)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.15)' }}
                      >
                        ⏱️ انتظرني
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </DriverInfoCard>

          {/* ─── 3. خط سير الرحلة (الانطلاق → الوجهة) ─── */}
          <div style={{ borderTop: '1px solid rgba(91,221,166,0.06)' }}>
            {/* الانطلاق */}
            <div className="flex items-center gap-2.5 px-3 py-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'rgba(91,221,166,0.1)', border: '1px solid rgba(91,221,166,0.18)' }}
              >
                <MapPin className="w-3 h-3" style={{ color: '#5bdda6' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[8px] font-bold tracking-[0.15em] uppercase" style={{ color: 'rgba(91,221,166,0.7)' }}>الانطلاق</p>
                <p className="text-[11px] font-semibold text-white/90 truncate">{ride.pickup_address || "موقع الانطلاق"}</p>
              </div>
            </div>

            {/* الخط الواصل */}
            <div className="flex items-center px-3">
              <div className="w-7 flex justify-center">
                <div className="flex flex-col items-center gap-px">
                  <div className="w-px h-1" style={{ background: 'rgba(91,221,166,0.15)' }} />
                  <div className="w-1 h-1 rounded-full" style={{ background: 'rgba(91,221,166,0.2)' }} />
                  <div className="w-px h-1" style={{ background: 'rgba(91,221,166,0.15)' }} />
                </div>
              </div>
            </div>

            {/* الوجهة */}
            <div className="flex items-center gap-2.5 px-3 py-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(91,221,166,0.1)', border: '1px solid rgba(91,221,166,0.18)' }}
              >
                <Navigation className="w-3 h-3 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[8px] font-bold tracking-[0.15em] uppercase text-emerald-400/70">الوجهة</p>
                <p className="text-[11px] font-semibold text-white/90 truncate">{ride.dropoff_address || "الوجهة"}</p>
              </div>
              {(ride.status === "in_progress" || ride.status === "accepted") && (
                <button
                  onClick={() => setShowDestinationChange(true)}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95"
                  style={{ background: 'rgba(91,221,166,0.08)', color: '#5bdda6', border: '1px solid rgba(91,221,166,0.15)' }}
                >
                  <Edit2 className="w-2.5 h-2.5" />
                  تغيير
                </button>
              )}
            </div>
          </div>

          {/* ─── 4. تفاصيل الأجرة (للرحلات المكتملة فقط) ─── */}
          {ride.status === "completed" && ride.final_fare ? (
            <div style={{ borderTop: '1px solid rgba(91,221,166,0.06)' }}>
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
    </div>
  );
};

export default LiveRideTracker;
