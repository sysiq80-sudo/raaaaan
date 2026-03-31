import React, { useEffect, useRef, useState, useCallback } from "react";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRiderLocation } from "@/hooks/useRiderLocation";
import FareBreakdownCard from "@/components/driver/FareBreakdownCard";
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
  Check,
} from "lucide-react";
import { motion } from "framer-motion";
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

        // إضافة علامة نقطة الانطلاق (أخضر)
        const pickupIcon = document.createElement("div");
        pickupIcon.innerHTML = `
          <div class="flex flex-col items-center">
            <div class="w-10 h-10 rounded-full flex items-center justify-center shadow-lg" style="background: linear-gradient(135deg, #00d9a5, #00b389);">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </div>
          </div>
        `;
        const hasAdvancedMarker = !!window.google?.maps?.marker?.AdvancedMarkerElement;
        pickupMarkerRef.current = new google.maps.Marker({
            position: ride.pickup_location,
            map: map.current,
            icon: hasAdvancedMarker ? {
              url: "data:image/svg+xml," + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                  <defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#00d9a5"/><stop offset="100%" stop-color="#00b389"/></linearGradient></defs>
                  <circle cx="20" cy="20" r="18" fill="url(#pg)" stroke="white" stroke-width="3"/>
                  <circle cx="20" cy="20" r="6" fill="none" stroke="white" stroke-width="2"/>
                  <circle cx="20" cy="20" r="2" fill="white"/>
                </svg>
              `),
              scaledSize: new google.maps.Size(40, 40),
              anchor: new google.maps.Point(20, 20),
            } : undefined,
          });

        // إضافة علامة الوجهة (أزرق)
        dropoffMarkerRef.current = new google.maps.Marker({
          position: ride.dropoff_location,
          map: map.current,
          icon: {
            url: "data:image/svg+xml," + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
                <defs><linearGradient id="dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0ea5e9"/><stop offset="100%" stop-color="#0284c7"/></linearGradient></defs>
                <path d="M20 0C9 0 0 9 0 20c0 15 20 28 20 28s20-13 20-28C40 9 31 0 20 0z" fill="url(#dg)" stroke="white" stroke-width="3"/>
                <circle cx="20" cy="18" r="7" fill="none" stroke="white" stroke-width="2"/>
                <circle cx="20" cy="18" r="3" fill="white"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(40, 48),
            anchor: new google.maps.Point(20, 48),
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
  const fetchDriverToPickupRoute = async (driverLocation: {
    lat: number;
    lng: number;
  }) => {
    if (!map.current || !directionsServiceRef.current || ride.status === "in_progress") return;

    try {
      const result = await directionsServiceRef.current.route({
        origin: driverLocation,
        destination: ride.pickup_location,
        travelMode: google.maps.TravelMode.DRIVING,
      });

      if (result.routes?.[0]) {
        const path = result.routes[0].overview_path;

        // تحديث أو إنشاء خط مسار السائق (أزرق متقطع)
        driverRouteRef.current?.setMap(null);
        driverRouteRef.current = drawPolyline(path, "#3b82f6", 4, 1, true);
      }
    } catch (error) {
      console.error("Error fetching driver route:", error);
    }
  };

  // Update driver marker on map
  const updateDriverMarker = (location: { lat: number; lng: number }) => {
    if (!map.current) return;

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setPosition(location);
    } else {
      driverMarkerRef.current = new google.maps.Marker({
        position: location,
        map: map.current,
        icon: {
          url: "data:image/svg+xml," + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="22" fill="none" stroke="#3b82f6" stroke-width="2" opacity="0.3">
                <animate attributeName="r" values="16;22;16" dur="2s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite"/>
              </circle>
              <defs><linearGradient id="cg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#1d4ed8"/></linearGradient></defs>
              <circle cx="24" cy="24" r="16" fill="url(#cg)" stroke="white" stroke-width="2"/>
              <path d="M14 24l3-9h14l3 9M32 30a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm-16 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4zM14 24v8h2v-2h16v2h2v-8H14z" fill="white"/>
            </svg>
          `),
          scaledSize: new google.maps.Size(48, 48),
          anchor: new google.maps.Point(24, 24),
        },
        zIndex: 999,
      });
    }

    // ضبط إطار الخريطة ليشمل السائق والنقاط المهمة
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(location);
    bounds.extend(ride.pickup_location);
    if (ride.status === "in_progress") {
      bounds.extend(ride.dropoff_location);
    }
    map.current.fitBounds(bounds, { top: 80, bottom: 80, left: 40, right: 40 });
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
    if (!directionsServiceRef.current) return;
    
    const targetLocation =
      ride.status === "in_progress"
        ? ride.dropoff_location
        : ride.pickup_location;

    try {
      const result = await directionsServiceRef.current.route({
        origin: driverLocation,
        destination: targetLocation,
        travelMode: google.maps.TravelMode.DRIVING,
      });
      
      if (result.routes?.[0]?.legs?.[0]) {
        const durationSec = result.routes[0].legs[0].duration?.value || 0;
        setEstimatedArrival(Math.round(durationSec / 60));
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

        <StatusIcons
          userLocation={driver?.current_location || ride.pickup_location}
        />

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
        <div ref={mapContainer} className="absolute inset-0 bg-gray-100 dark:bg-gray-800" />
        {isLoading && (
          <div className="absolute inset-0 bg-card/80 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}
      </div>

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
      <div className="bg-card rounded-t-3xl shadow-xl border-t border-border p-4 space-y-3 overflow-hidden">
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
          estimatedFare={ride.estimated_fare}
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
            <div className="w-3 h-3 mt-1.5 rounded-full bg-green-500" />
            <p className="text-sm text-foreground flex-1">
              {ride.dropoff_address || "الوجهة"}
            </p>
            {(ride.status === "in_progress" || ride.status === "accepted") && (
              <Button
                variant="ghost"
                size="sm"
                className="text-primary text-xs h-6 px-2"
                onClick={() => {
                  setShowDestinationChange(true);
                }}
              >
                <Edit2 className="w-3 h-3 ml-1" />
                تغيير
              </Button>
            )}
          </div>
        </div>

        {/* Quick Reply Buttons for Accepted & Arrived Status */}
        {(ride.status === "accepted" || ride.status === "arrived") && (
          <div className="pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground mb-3 text-center font-semibold">
              {ride.status === "accepted" ? "رسائل سريعة للسائق" : "تواصل مع السائق"}
            </p>
            <div className="space-y-2">
              {ride.status === "accepted" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-blue-500/10 border-2 border-blue-400/50 text-blue-600 hover:bg-blue-500/20 font-medium shadow-sm h-12 rounded-none px-4"
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
                    className="w-full bg-amber-500/10 border-2 border-amber-400/50 text-amber-600 hover:bg-amber-500/20 font-medium shadow-sm h-12 rounded-none px-4"
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
                </>
              )}
              {ride.status === "arrived" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-purple-500/10 border-2 border-purple-400/50 text-purple-600 hover:bg-purple-500/20 font-medium shadow-sm h-12 rounded-none px-4"
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-orange-500/10 border-2 border-orange-400/50 text-orange-600 hover:bg-orange-500/20 font-medium shadow-sm h-12 rounded-none px-4"
                    onClick={() =>
                      sendQuickMessage(
                        "rider_wait_moment",
                        "✅ تم إبلاغ السائق",
                        "السائق سينتظرك قليلاً"
                      )
                    }
                  >
                    ⏱️ انتظرني قليلاً
                  </Button>
                </>
              )}
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
        ) : null}
      </div>
    </div>
  );
};

export default LiveRideTracker;
