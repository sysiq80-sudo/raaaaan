import React, { useEffect, useRef, useState, useCallback } from "react";
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
  Sparkles,
  Star,
} from "lucide-react";
import LocationSearchInput from "@/components/LocationSearchInput";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SavedPlace } from "./SavedPlaces";
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
interface MapLocationPickerProps {
  isOpen: boolean;
  onClose: () => void;
  type: "pickup" | "dropoff";
  onConfirm: (location: {
    lat: number;
    lng: number;
    address: string;
    inService?: boolean;
  }) => void;
  initialLocation?: {
    lat: number;
    lng: number;
  } | null;
  userLocation?: {
    lat: number;
    lng: number;
  } | null;
  onPickupConfirmed?: (pickupLocation: {
    lat: number;
    lng: number;
    address: string;
    inService?: boolean;
  }) => void;
}
const MapLocationPicker: React.FC<MapLocationPickerProps> = ({
  isOpen,
  onClose,
  type,
  onConfirm,
  initialLocation,
  userLocation,
  onPickupConfirmed,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapToken, setMapToken] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [centerAddress, setCenterAddress] = useState<string>("");
  const [serviceAreaStatus, setServiceAreaStatus] =
    useState<ServiceAreaCheck | null>(null);
  const [isCheckingService, setIsCheckingService] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMode, setCurrentMode] = useState<"pickup" | "dropoff">(
    "pickup"
  );
  const [pickupLocation, setPickupLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [loadingSavedPlaces, setLoadingSavedPlaces] = useState(false);

  // Set initial mode based on prop when component opens
  useEffect(() => {
    if (isOpen && !hasInitialized) {
      setCurrentMode(type);
      setPickupLocation(null); // Clear pickup location when modal opens
      setSearchQuery("");
      setCenterAddress("");
      setHasInitialized(true);
    }
    // Don't reset currentMode if already initialized - let internal state manage transitions
  }, [isOpen, type, hasInitialized]);

  // Reset initialization flag and internal state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasInitialized(false);
      setCurrentMode("pickup"); // Reset to pickup for next time
      setPickupLocation(null);
    }
  }, [isOpen]);

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
    if (isOpen) {
      fetchUserAndPlaces();
    }
  }, [isOpen]);

  // Fetch saved places
  const fetchSavedPlaces = async (userId: string) => {
    setLoadingSavedPlaces(true);
    try {
      const { data, error } = await supabase
        .from("saved_places")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", {
          ascending: true,
        });
      if (error) throw error;
      setSavedPlaces(data || []);
    } catch (error) {
      console.error("Error fetching saved places:", error);
    } finally {
      setLoadingSavedPlaces(false);
    }
  };
  const ramadiCenter: [number, number] = [43.2954, 33.4262];

  // Fetch Mapbox token
  useEffect(() => {
    if (!isOpen) return;
    const fetchToken = async () => {
      try {
        const response = await fetch(
          "https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=token",
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        const data = await response.json();
        if (data.token) setMapToken(data.token);
      } catch (error) {
        console.error("Error fetching token:", error);
      }
    };
    fetchToken();
  }, [isOpen]);

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
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        const data = await response.json();
        if (data.features?.[0]?.place_name) {
          setCenterAddress(data.features[0].place_name);
        } else {
          // Fallback when Mapbox has no address for these coordinates
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
    if (!isOpen || !mapContainer.current || !mapToken) return;
    mapboxgl.accessToken = mapToken;
    const initialCenter = initialLocation
      ? ([initialLocation.lng, initialLocation.lat] as [number, number])
      : userLocation
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
  }, [isOpen, mapToken, initialLocation, userLocation, reverseGeocode]);
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
    console.log("🔘 Confirm button clicked");
    console.log("📍 Current state:", {
      currentMode,
      type,
      centerAddress,
      hasPickupLocation: !!pickupLocation,
      mapExists: !!map.current,
    });
    if (!map.current) {
      console.log("❌ No map reference");
      return;
    }
    const center = map.current.getCenter();
    console.log("🗺️ Map center:", {
      lat: center.lat,
      lng: center.lng,
    });
    const serviceCheck = await checkServiceArea(center.lat, center.lng);
    const location = {
      lat: center.lat,
      lng: center.lng,
      address: centerAddress,
      inService: serviceCheck?.in_service,
    };
    console.log("📦 Location prepared:", location);

    // If in pickup mode, save location and switch to dropoff mode
    if (currentMode === "pickup") {
      console.log("✅ Pickup mode - saving location");
      setPickupLocation(location);
      setCurrentMode("dropoff");
      setCenterAddress("");
      setSearchQuery("");
      setServiceAreaStatus(null);

      // Call the pickup confirmed callback if provided
      if (onPickupConfirmed) {
        console.log("📞 Calling onPickupConfirmed");
        onPickupConfirmed(location);
      }
      console.log("🔄 Staying open for dropoff selection");
      return; // Don't close, stay open for dropoff
    }

    // If in dropoff mode, confirm location and close
    console.log("✅ Dropoff mode - confirming location");
    onConfirm(location);
  };

  // Handle selecting a location from search suggestions
  const handleSearchSelect = (location: {
    lat: number;
    lng: number;
    address: string;
    inService?: boolean;
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

  // Handle saved place selection
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
  if (!isOpen) return null;
  const isPickup = currentMode === "pickup";

  // Always use distinct colors for pickup (green) and dropoff (blue)
  const pinColor = isPickup
    ? "from-green-500 to-green-600"
    : "from-sky-400 to-sky-600";
  const glowColor = isPickup
    ? "0 0 40px rgba(34, 197, 94, 0.8), 0 0 80px rgba(34, 197, 94, 0.4)"
    : "0 0 50px rgba(14, 165, 233, 0.9), 0 0 100px rgba(14, 165, 233, 0.5), 0 0 0 3px rgba(255, 255, 255, 0.8)";
  const gradientColor = isPickup
    ? "linear-gradient(to bottom, #22c55e, transparent)"
    : "linear-gradient(to bottom, #0ea5e9, transparent)";
  const bgOpacity = isPickup ? "bg-green-500/30" : "bg-sky-400/40";
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card/95 backdrop-blur-md border-b border-border/50 z-30">
        <div className="flex items-center justify-between p-4 safe-area-top">
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted transition-colors"
            aria-label="العودة"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">
            {isPickup ? "حدد موقع الانطلاق" : "حدد الوجهة"}
          </h1>
          <div className="w-10" /> {/* Spacer for balance */}
        </div>
      </div>

      {/* Map Container - Takes remaining space */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0" />

        {/* Drag instruction hint */}
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

        {/* Clean and simple location pin */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="flex flex-col items-center">
            {/* Clean map pin - needle tip indicates exact location */}
            <div className="relative">
              {/* Pin head */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shadow-xl border-2 ${
                  isPickup ? "bg-green-500 border-white" : "bg-sky-500 border-white"
                }`}
                style={!isPickup ? {
                  boxShadow: "0 0 30px rgba(14, 165, 233, 0.8), 0 4px 20px rgba(14, 165, 233, 0.4), 0 0 0 2px rgba(255, 255, 255, 0.9), 0 0 0 4px rgba(14, 165, 233, 0.3)"
                } : undefined}
              >
                {isPickup ? (
                  <Target className="w-4 h-4 text-white" />
                ) : (
                  <MapPin className="w-4 h-4 text-white" />
                )}
              </div>

              {/* Pin needle pointing down to exact location */}
              <div
                className={`w-0.5 h-6 mx-auto ${
                  isPickup ? "bg-green-500" : "bg-sky-500"
                }`}
                style={{
                  clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
                }}
              />
            </div>

            {/* Address below pin */}
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
              <div
                className="w-14 h-14 rounded-full mx-auto mb-4"
                style={{
                  background: "conic-gradient(from 0deg, transparent, #3b82f6)",
                  animation: "spin 1s linear infinite",
                  WebkitMask:
                    "radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))",
                }}
              />
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
            aria-label="تحديد موقعي الحالي"
          >
            <Navigation className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
          </button>
        )}
      </div>

      {/* Bottom panel - Fixed at bottom */}
      <div className="bg-card/95 backdrop-blur-md border-t border-border/50 shadow-2xl z-30">
        <div className="p-3 sm:p-4">
          {/* Service area status with compact styling */}
          {serviceAreaStatus && !serviceAreaStatus.in_service && (
            <div className="flex items-center gap-3 p-3 mb-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 shadow-lg">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0 shadow-inner">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-800 text-sm mb-1">
                  ⚠️ هذا الموقع خارج منطقة الخدمة
                </p>
                {serviceAreaStatus.nearest_region && (
                  <p className="text-amber-700 text-xs">
                    أقرب منطقة خدمة:{" "}
                    <span className="font-medium">
                      {serviceAreaStatus.nearest_region.name_ar}
                    </span>
                    <br />
                    المسافة:{" "}
                    <span className="font-medium">
                      {serviceAreaStatus.nearest_region.distance_km} كم
                    </span>
                  </p>
                )}
                <p className="text-amber-600 text-xs mt-1">
                  اسحب الخريطة للانتقال إلى منطقة الخدمة
                </p>
              </div>
            </div>
          )}

          {/* Address display with compact styling */}
          <div className="flex items-start gap-3 mb-4 p-3 rounded-xl border bg-card/50">
            <div
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0 border ${
                isPickup
                  ? "bg-green-500/20 border-green-400 shadow-lg shadow-green-500/20"
                  : "bg-sky-500/20 border-sky-400 shadow-lg shadow-sky-500/30"
              }`}
              style={{
                boxShadow: isPickup
                  ? "0 0 20px rgba(34, 197, 94, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.1)"
                  : "0 0 25px rgba(14, 165, 233, 0.5), 0 0 40px rgba(14, 165, 233, 0.2), inset 0 2px 4px rgba(255, 255, 255, 0.1)",
              }}
            >
              {isPickup ? (
                <Target className="w-6 h-6 sm:w-7 sm:h-7 text-green-600 drop-shadow-sm" />
              ) : (
                <MapPin className="w-6 h-6 sm:w-7 sm:h-7 text-sky-600 drop-shadow-sm" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    isPickup
                      ? "bg-green-100 text-green-800 border border-green-200"
                      : "bg-blue-100 text-blue-800 border border-blue-200"
                  }`}
                >
                  {isPickup ? "🚗 موقع الانطلاق" : "🎯 الوجهة"}
                </p>
              </div>
              <p className="font-semibold text-foreground text-sm sm:text-base line-clamp-2 leading-relaxed">
                {centerAddress || "جاري تحديد العنوان..."}
              </p>
              {centerAddress && (
                <p className="text-xs text-muted-foreground mt-1">
                  اسحب الخريطة لتغيير الموقع • اضغط للتأكيد
                </p>
              )}
            </div>
          </div>

          {/* Search input to set location by typing with suggestions */}
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

          {/* Saved Places Section - Horizontal Scrolling (only show in dropoff mode) */}
          {!isPickup && savedPlaces.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3 px-1 flex items-center gap-2">
                <Star className="w-3 h-3 text-amber-600" />
                أماكني المحفوظة
              </p>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {loadingSavedPlaces ? (
                  <div className="flex items-center justify-center w-full py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  savedPlaces.map((place) => (
                    <button
                      key={place.id}
                      onClick={() => handleSavedPlaceSelect(place)}
                      className="flex flex-col items-center justify-center flex-shrink-0 w-24 h-28 p-2 rounded-xl border border-border/50 hover:border-amber-500 hover:bg-amber-500/10 hover:shadow-md transition-all duration-200 group overflow-hidden bg-card/50"
                    >
                      <div className="text-4xl leading-none mb-2">
                        {place.icon || "📍"}
                      </div>
                      <p className="text-[11px] font-semibold text-foreground text-center line-clamp-2 leading-tight group-hover:text-amber-600 transition-colors">
                        {place.name}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Confirm button - compact styling */}
          <Button
            onClick={handleConfirm}
            disabled={isCheckingService || !centerAddress}
            className={`w-full h-12 sm:h-14 text-base sm:text-lg font-bold rounded-xl transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] ${
              isPickup
                ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg shadow-green-500/30"
                : "bg-gradient-to-r from-sky-400 to-sky-600 hover:from-sky-500 hover:to-sky-700 shadow-lg shadow-sky-500/40"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            style={{
              boxShadow: isPickup
                ? "0 4px 20px rgba(34, 197, 94, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)"
                : "0 4px 25px rgba(14, 165, 233, 0.5), 0 0 40px rgba(14, 165, 233, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
            }}
          >
            {isCheckingService ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                <span className="text-sm sm:text-base">
                  جاري التحقق من المنطقة...
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="text-sm sm:text-base">
                  تأكيد {isPickup ? "موقع الانطلاق" : "الوجهة"}
                </span>
                <span className="text-sm sm:text-base">
                  {isPickup ? "🚗" : "🎯"}
                </span>
              </div>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
export default MapLocationPicker;
