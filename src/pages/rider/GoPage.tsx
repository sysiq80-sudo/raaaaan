import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  ArrowRight,
  Navigation,
  Loader2,
  MapPin,
  Target,
  AlertTriangle,
  Check,
  Star,
  Clock,
  Car,
  Route,
} from "lucide-react";
import LocationSearchInput from "@/components/LocationSearchInput";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useFareCalculation } from "@/hooks/useFareCalculation";
import { useOptimizedNearbyDrivers } from "@/hooks/useOptimizedNearbyDrivers";
import CompactVehicleSelector from "@/components/rider/CompactVehicleSelector";
import { PaymentMethodBadge } from "@/components/rider/PaymentMethodSelector";

interface ServiceAreaCheck {
  in_service: boolean;
  region: {
    id: string;
    name_ar: string;
    name_en: string | null;
  } | null;
  nearest_region: {
    id: string;
    name_ar: string;
    distance_km: number;
  } | null;
}

interface SavedPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  icon?: string;
}

type VehicleType = "economy" | "comfort" | "premium" | "women_only";
type PaymentMethodType =
  | "cash"
  | "wallet"
  | "card"
  | "zain_cash"
  | "super_key"
  | "nas_wallet";

const GoPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  // Map state
  const [isLoading, setIsLoading] = useState(true);
  const [mapToken, setMapToken] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [centerAddress, setCenterAddress] = useState<string>("");
  const [serviceAreaStatus, setServiceAreaStatus] =
    useState<ServiceAreaCheck | null>(null);
  const [isCheckingService, setIsCheckingService] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Flow state
  const [currentMode, setCurrentMode] = useState<
    "pickup" | "dropoff" | "booking"
  >("pickup");
  const [pickupLocation, setPickupLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);

  // User state
  const [userId, setUserId] = useState<string | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [loadingSavedPlaces, setLoadingSavedPlaces] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Booking state
  const [selectedVehicle, setSelectedVehicle] =
    useState<VehicleType>("economy");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("cash");
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [isBooking, setIsBooking] = useState(false);

  const ramadiCenter: [number, number] = [43.2954, 33.4262];

  // Fare calculation
  const { fareBreakdown, fareLoading } = useFareCalculation(
    pickupLocation,
    dropoffLocation,
    selectedVehicle,
    routeDistance
  );

  // Nearby drivers
  const { nearbyDriversCount, availableDriversByType } =
    useOptimizedNearbyDrivers(pickupLocation, selectedVehicle, {
      enableRealtime: !!pickupLocation,
      debounceMs: 1000,
    });

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => console.error("Geolocation error:", error),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Fetch user ID and saved places
  useEffect(() => {
    const fetchUserAndPlaces = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user?.id) {
          setUserId(session.user.id);
          fetchSavedPlaces(session.user.id);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUserAndPlaces();
  }, []);

  // Fetch saved places
  const fetchSavedPlaces = async (userId: string) => {
    setLoadingSavedPlaces(true);
    try {
      const { data, error } = await supabase
        .from("saved_places")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setSavedPlaces(data || []);
    } catch (error) {
      console.error("Error fetching saved places:", error);
    } finally {
      setLoadingSavedPlaces(false);
    }
  };

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch(
          "https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=token",
          { headers: { "Content-Type": "application/json" } }
        );
        const data = await response.json();
        if (data.token) setMapToken(data.token);
      } catch (error) {
        console.error("Error fetching token:", error);
      }
    };
    fetchToken();
  }, []);

  // Check service area
  const checkServiceArea = useCallback(async (lat: number, lng: number) => {
    try {
      setIsCheckingService(true);
      const response = await fetch(
        `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/check-service-area?lat=${lat}&lng=${lng}`
      );
      const data = await response.json();
      setServiceAreaStatus(data);
      return data;
    } catch {
      return null;
    } finally {
      setIsCheckingService(false);
    }
  }, []);

  // Reverse geocode
  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      try {
        const response = await fetch(
          `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=reverse-geocode&lat=${lat}&lng=${lng}`,
          { headers: { "Content-Type": "application/json" } }
        );
        const data = await response.json();
        if (data.features?.[0]?.place_name) {
          setCenterAddress(data.features[0].place_name);
        } else {
          setCenterAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }
        checkServiceArea(lat, lng);
      } catch {
        setCenterAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    },
    [checkServiceArea]
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapToken || currentMode === "booking") return;

    mapboxgl.accessToken = mapToken;
    const initialCenter = userLocation
      ? ([userLocation.lng, userLocation.lat] as [number, number])
      : ramadiCenter;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: initialCenter,
      zoom: 16,
      pitch: 0,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-left");

    map.current.on("load", () => {
      setIsLoading(false);
      const center = map.current?.getCenter();
      if (center) reverseGeocode(center.lat, center.lng);

      // Add user location marker if available
      if (userLocation) {
        const el = document.createElement("div");
        el.innerHTML = `
          <div class="relative">
            <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-30"></div>
            <div class="relative w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg"></div>
          </div>
        `;
        new mapboxgl.Marker(el)
          .setLngLat([userLocation.lng, userLocation.lat])
          .addTo(map.current!);
      }

      // Add route source
      map.current?.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [] },
        },
      });

      // Route glow layer
      map.current?.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#00d9a5",
          "line-width": 12,
          "line-blur": 8,
          "line-opacity": 0.4,
        },
      });

      // Route main layer
      map.current?.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#00d9a5", "line-width": 5, "line-opacity": 1 },
      });
    });

    map.current.on("dragstart", () => setIsDragging(true));
    map.current.on("dragend", () => {
      setIsDragging(false);
      const center = map.current?.getCenter();
      if (center) reverseGeocode(center.lat, center.lng);
    });
    map.current.on("moveend", () => {
      if (!isDragging) {
        const center = map.current?.getCenter();
        if (center) reverseGeocode(center.lat, center.lng);
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [mapToken, userLocation, reverseGeocode, currentMode]);

  // Fetch route when both locations are set
  useEffect(() => {
    if (!pickupLocation || !dropoffLocation || !mapToken) return;

    const fetchRoute = async () => {
      try {
        const start = `${pickupLocation.lng},${pickupLocation.lat}`;
        const end = `${dropoffLocation.lng},${dropoffLocation.lat}`;

        const response = await fetch(
          `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=directions&start=${start}&end=${end}`
        );
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          setRouteDistance(route.distance / 1000);
          setRouteDuration(route.duration / 60);

          // Draw route on map
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

            // Fit map to route
            const bounds = new mapboxgl.LngLatBounds();
            route.geometry.coordinates.forEach((coord: [number, number]) =>
              bounds.extend(coord)
            );
            map.current?.fitBounds(bounds, { padding: 80, duration: 1000 });
          }
        }
      } catch (error) {
        console.error("Error fetching route:", error);
      }
    };

    fetchRoute();
  }, [pickupLocation, dropoffLocation, mapToken]);

  const centerOnUser = () => {
    if (userLocation && map.current) {
      map.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 16,
        duration: 1000,
      });
    }
  };

  const handleConfirm = async () => {
    if (!map.current) return;

    const center = map.current.getCenter();
    const serviceCheck = await checkServiceArea(center.lat, center.lng);
    const location = {
      lat: center.lat,
      lng: center.lng,
      address: centerAddress,
      inService: serviceCheck?.in_service,
    };

    if (currentMode === "pickup") {
      setPickupLocation(location);
      setCurrentMode("dropoff");
      setCenterAddress("");
      setSearchQuery("");
      setServiceAreaStatus(null);
      toast({
        title: "تم تحديد موقع الانطلاق ✅",
        description: location.address,
      });
    } else if (currentMode === "dropoff") {
      setDropoffLocation(location);
      setCurrentMode("booking");
      toast({ title: "تم تحديد الوجهة ✅", description: location.address });
    }
  };

  const handleSearchSelect = (location: {
    lat: number;
    lng: number;
    address: string;
  }) => {
    if (map.current) {
      map.current.flyTo({
        center: [location.lng, location.lat],
        zoom: 16,
        duration: 800,
      });
    }
    setCenterAddress(location.address);
    checkServiceArea(location.lat, location.lng);
  };

  const handleSavedPlaceSelect = (place: SavedPlace) => {
    if (map.current) {
      map.current.flyTo({
        center: [place.lng, place.lat],
        zoom: 16,
        duration: 800,
      });
    }
    setCenterAddress(place.address);
    checkServiceArea(place.lat, place.lng);
  };

  const handleBookRide = async () => {
    if (!userId) {
      toast({
        title: "يجب تسجيل الدخول",
        description: "الرجاء تسجيل الدخول للحجز",
        variant: "destructive",
      });
      navigate("/auth?redirect=/go");
      return;
    }

    if (!pickupLocation || !dropoffLocation) {
      toast({
        title: "معلومات ناقصة",
        description: "الرجاء تحديد نقطة الانطلاق والوجهة",
        variant: "destructive",
      });
      return;
    }

    setIsBooking(true);
    try {
      const { data: ride, error } = await supabase
        .from("rides")
        .insert([
          {
            rider_id: userId,
            pickup_location: pickupLocation,
            dropoff_location: dropoffLocation,
            pickup_address: pickupLocation.address,
            dropoff_address: dropoffLocation.address,
            vehicle_type: selectedVehicle,
            payment_method: paymentMethod,
            estimated_fare: fareBreakdown?.total_fare || 0,
            distance_km: routeDistance
              ? Number(routeDistance.toFixed(2))
              : null,
            duration_minutes: routeDuration ? Math.round(routeDuration) : null,
            status: "pending",
          } as any,
        ])
        .select()
        .single();

      if (error) throw error;

      // Trigger ride matching
      await supabase.functions.invoke("match-ride", {
        body: { ride_id: ride.id },
      });

      toast({
        title: "تم إرسال طلبك ✅",
        description: "جاري البحث عن سائق قريب",
      });
      navigate("/rider-main");
    } catch (error: any) {
      console.error("Booking error:", error);
      toast({
        title: "فشل الحجز",
        description: error.message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setIsBooking(false);
    }
  };

  const isPickup = currentMode === "pickup";
  const isDropoff = currentMode === "dropoff";
  const isBookingMode = currentMode === "booking";

  // Booking confirmation screen
  if (isBookingMode && pickupLocation && dropoffLocation) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <div className="bg-card/95 backdrop-blur-md border-b border-border/50 z-30">
          <div className="flex items-center justify-between p-4 safe-area-top">
            <button
              onClick={() => setCurrentMode("dropoff")}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold">تأكيد الرحلة</h1>
            <div className="w-10" />
          </div>
        </div>

        {/* Map with route */}
        <div className="h-48 relative">
          <div ref={mapContainer} className="absolute inset-0" />
        </div>

        {/* Booking details */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* Route info */}
          <div className="space-y-3 bg-muted/50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">من</p>
                <p className="font-medium text-sm">{pickupLocation.address}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-500 mt-1.5" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">إلى</p>
                <p className="font-medium text-sm">{dropoffLocation.address}</p>
              </div>
            </div>
          </div>

          {/* Trip summary */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Route className="w-4 h-4 text-primary" />
              <span>ملخص الرحلة</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 bg-background rounded-lg">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Navigation className="w-3 h-3" />
                  <span className="text-xs">المسافة</span>
                </div>
                <p className="font-bold text-sm">
                  {routeDistance ? `${routeDistance.toFixed(1)} كم` : "---"}
                </p>
              </div>
              <div className="text-center p-2 bg-background rounded-lg">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Clock className="w-3 h-3" />
                  <span className="text-xs">الوقت</span>
                </div>
                <p className="font-bold text-sm">
                  {routeDuration ? `${Math.round(routeDuration)} د` : "---"}
                </p>
              </div>
              <div className="text-center p-2 bg-background rounded-lg">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Car className="w-3 h-3" />
                  <span className="text-xs">سائقون</span>
                </div>
                <p className="font-bold text-sm text-green-600">
                  {nearbyDriversCount || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Vehicle selector */}
          <CompactVehicleSelector
            selectedVehicle={selectedVehicle}
            onSelect={setSelectedVehicle}
            availableDrivers={availableDriversByType}
          />

          {/* Payment method */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              طريقة الدفع
            </p>
            <PaymentMethodBadge method={paymentMethod} onClick={() => {}} />
          </div>
        </div>

        {/* Book button */}
        <div className="p-4 bg-card/95 backdrop-blur-md border-t border-border/50">
          <Button
            onClick={handleBookRide}
            disabled={isBooking || fareLoading || nearbyDriversCount === 0}
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-primary to-primary/80"
          >
            {isBooking ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري الحجز...
              </span>
            ) : (
              <span>
                احجز الآن •{" "}
                {fareBreakdown?.total_fare?.toLocaleString() || "---"} د.ع
              </span>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Location picker screen
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card/95 backdrop-blur-md border-b border-border/50 z-30">
        <div className="flex items-center justify-between p-4 safe-area-top">
          <button
            onClick={() => {
              if (currentMode === "dropoff" && pickupLocation) {
                setCurrentMode("pickup");
                setPickupLocation(null);
              } else {
                navigate(-1);
              }
            }}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">
            {isPickup ? "حدد موقع الانطلاق" : "حدد الوجهة"}
          </h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0" />

        {/* Drag instruction */}
        {!isDragging && centerAddress && (
          <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-10 pointer-events-none">
            <div className="bg-card/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-border/50 animate-bounce">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="text-lg">👆</span>
                اسحب الخريطة لتغيير الموقع
              </p>
            </div>
          </div>
        )}

        {/* Location pin */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="flex flex-col items-center">
            <div className="relative">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shadow-xl border-2 border-white ${
                  isPickup ? "bg-green-500" : "bg-blue-500"
                }`}
              >
                {isPickup ? (
                  <Target className="w-4 h-4 text-white" />
                ) : (
                  <MapPin className="w-4 h-4 text-white" />
                )}
              </div>
              <div
                className={`w-0.5 h-6 mx-auto ${
                  isPickup ? "bg-green-500" : "bg-blue-500"
                }`}
                style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }}
              />
            </div>
            <div className="mt-2 px-3 py-2 bg-card/95 backdrop-blur-md rounded-lg shadow-lg border border-border/50 max-w-[250px]">
              <p className="text-sm font-medium text-foreground text-center line-clamp-2">
                {centerAddress || "جاري تحديد العنوان..."}
              </p>
            </div>
          </div>
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-card/90 backdrop-blur-md flex items-center justify-center z-30">
            <div className="text-center">
              <Loader2 className="w-14 h-14 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground font-medium">
                جاري تحميل الخريطة...
              </p>
            </div>
          </div>
        )}

        {/* Center on user button */}
        {userLocation && (
          <button
            onClick={centerOnUser}
            className="absolute bottom-5 left-4 w-14 h-14 bg-card/95 backdrop-blur-md rounded-2xl border border-border/50 shadow-xl flex items-center justify-center hover:bg-accent transition-all duration-200 active:scale-95 z-40 group"
          >
            <Navigation className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
          </button>
        )}
      </div>

      {/* Bottom panel */}
      <div className="bg-card/95 backdrop-blur-md border-t border-border/50 shadow-2xl z-30">
        <div className="p-3 sm:p-4">
          {/* Service area warning */}
          {serviceAreaStatus && !serviceAreaStatus.in_service && (
            <div className="flex items-center gap-3 p-3 mb-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-800 text-sm mb-1">
                  ⚠️ خارج منطقة الخدمة
                </p>
                {serviceAreaStatus.nearest_region && (
                  <p className="text-amber-700 text-xs">
                    أقرب منطقة: {serviceAreaStatus.nearest_region.name_ar} (
                    {serviceAreaStatus.nearest_region.distance_km} كم)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Address display */}
          <div className="flex items-start gap-3 mb-4 p-3 rounded-xl border bg-card/50">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                isPickup
                  ? "bg-green-500/20 border-green-400"
                  : "bg-blue-500/20 border-blue-400"
              }`}
            >
              {isPickup ? (
                <Target className="w-6 h-6 text-green-600" />
              ) : (
                <MapPin className="w-6 h-6 text-blue-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-xs font-semibold px-2 py-1 rounded-full inline-block mb-1 ${
                  isPickup
                    ? "bg-green-100 text-green-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {isPickup ? "🚗 موقع الانطلاق" : "🎯 الوجهة"}
              </p>
              <p className="font-semibold text-foreground text-sm line-clamp-2">
                {centerAddress || "جاري تحديد العنوان..."}
              </p>
              {centerAddress && (
                <p className="text-xs text-muted-foreground mt-1">
                  اسحب الخريطة لتغيير الموقع • اضغط للتأكيد
                </p>
              )}
            </div>
          </div>

          {/* Search input */}
          <div className="mb-3">
            <LocationSearchInput
              placeholder={
                isPickup
                  ? "اكتب لتحديد موقع الانطلاق..."
                  : "اكتب لتحديد الوجهة..."
              }
              value={searchQuery}
              onChange={setSearchQuery}
              onLocationSelect={handleSearchSelect}
              type={isPickup ? "pickup" : "dropoff"}
              userLocation={userLocation}
              className="w-full"
            />
          </div>

          {/* Saved places (dropoff only) */}
          {isDropoff && savedPlaces.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3 px-1 flex items-center gap-2">
                <Star className="w-3 h-3 text-amber-600" />
                أماكني المحفوظة
              </p>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {loadingSavedPlaces ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  savedPlaces.map((place) => (
                    <button
                      key={place.id}
                      onClick={() => handleSavedPlaceSelect(place)}
                      className="flex flex-col items-center flex-shrink-0 w-24 h-28 p-2 rounded-xl border border-border/50 hover:border-amber-500 hover:bg-amber-500/10 transition-all"
                    >
                      <div className="text-4xl mb-2">{place.icon || "📍"}</div>
                      <p className="text-[11px] font-semibold text-center line-clamp-2">
                        {place.name}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Confirm button */}
          <Button
            onClick={handleConfirm}
            disabled={isCheckingService || !centerAddress}
            className={`w-full h-12 sm:h-14 text-base sm:text-lg font-bold rounded-xl ${
              isPickup
                ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            }`}
          >
            {isCheckingService ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جاري التحقق...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5" />
                <span>تأكيد {isPickup ? "موقع الانطلاق" : "الوجهة"}</span>
                <span>{isPickup ? "🚗" : "🎯"}</span>
              </div>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GoPage;
