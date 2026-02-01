import React, { useEffect, useRef, useState, useCallback } from "react";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";
import {
  ArrowRight,
  Navigation,
  Loader2,
  MapPin,
  Target,
  AlertTriangle,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast"; // added for toast notifications
import { useDynamicPlacesSearch } from "@/hooks/useDynamicPlacesSearch";
import { DynamicSearchHeader, DynamicSearchResults } from "./DynamicSearchResults";
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
  const map = useRef<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [centerAddress, setCenterAddress] = useState<string>("");
  const [serviceAreaStatus, setServiceAreaStatus] =
    useState<ServiceAreaCheck | null>(null);
  const [isCheckingService, setIsCheckingService] = useState(false);
  const [currentMode, setCurrentMode] = useState<"pickup" | "dropoff">(
    "pickup"
  );
  const [pickupLocation, setPickupLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const { apiKey: googleMapsApiKey } = useGoogleMapsApiKey();
  const {
    searchQuery,
    setSearchQuery,
    predictions,
    isSearching,
    isLoadingDetails,
    getPlaceDetails,
    clearSearch,
  } = useDynamicPlacesSearch(userLocation);

  // Set initial mode based on prop when component opens
  useEffect(() => {
    if (isOpen && !hasInitialized) {
      setCurrentMode(type);
      setPickupLocation(null);
      setSearchQuery("");
      clearSearch();
      setCenterAddress("");
      setHasInitialized(true);
    }
  }, [isOpen, type, hasInitialized, clearSearch]);

  // Reset initialization flag and internal state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasInitialized(false);
      setCurrentMode("pickup"); // Reset to pickup for next time
      setPickupLocation(null);
    }
  }, [isOpen]);
  const ramadiCenter: [number, number] = [43.2954, 33.4262];

  // Load Google Maps API script
  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === "undefined" || window.google) return;
    if (!googleMapsApiKey) return;

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places,geocoding&language=ar`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      console.error("❌ Failed to load Google Maps API script");
    };
    document.head.appendChild(script);
  }, [isOpen, googleMapsApiKey]);

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
      if (!window.google?.maps) return;
      try {
        const geocoder = new google.maps.Geocoder();
        const result = await geocoder.geocode({
          location: new google.maps.LatLng(lat, lng),
          language: "ar",
        });
        if (result.results && result.results[0]) {
          setCenterAddress(result.results[0].formatted_address);
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
    if (!isOpen || !mapContainer.current || !googleMapsApiKey) return;

    const checkGoogleMaps = setInterval(() => {
      if (window.google?.maps) {
        clearInterval(checkGoogleMaps);
        if (!mapContainer.current || map.current) return;

        const initialCenter = initialLocation
          ? { lat: initialLocation.lat, lng: initialLocation.lng }
          : userLocation
          ? { lat: userLocation.lat, lng: userLocation.lng }
          : { lat: ramadiCenter[1], lng: ramadiCenter[0] };

        map.current = new google.maps.Map(mapContainer.current, {
          center: initialCenter,
          zoom: 16,
          disableDefaultUI: true,
          zoomControl: false,
          mapTypeControl: false,
          scaleControl: false,
          streetViewControl: false,
          rotateControl: false,
          fullscreenControl: false,
        });

        setIsLoading(false);
        const center = map.current.getCenter();
        if (center) reverseGeocode(center.lat(), center.lng());

        if (userLocation) {
          new google.maps.Marker({
            position: { lat: userLocation.lat, lng: userLocation.lng },
            map: map.current,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: "#3b82f6",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
          });
        }

        map.current.addListener("dragstart", () => setIsDragging(true));
        map.current.addListener("dragend", () => {
          setIsDragging(false);
          const currentCenter = map.current?.getCenter();
          if (currentCenter) reverseGeocode(currentCenter.lat(), currentCenter.lng());
        });
      }
    }, 100);

    return () => {
      clearInterval(checkGoogleMaps);
      map.current = null;
    };
  }, [isOpen, googleMapsApiKey, initialLocation, userLocation, reverseGeocode]);
  const { toast } = useToast();

  const centerOnUser = () => {
    if (userLocation && map.current) {
      map.current.panTo({ lat: userLocation.lat, lng: userLocation.lng });
      map.current.setZoom(16);
    }
  };

  const manualGeolocateLocal = () => {
    if (!navigator.geolocation) {
      toast({ title: '⚠️ المتصفح لا يدعم تحديد الموقع', variant: 'destructive' });
      return;
    }
    
    // طلب صلاحية الموقع بشكل فوري
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (map.current) {
          map.current.panTo({ lat, lng });
          map.current.setZoom(17);
        }
        reverseGeocode(lat, lng);
        // إزالة Toast لتحسين تجربة المستخدم
      },
      (err) => {
        console.warn('[MapLocationPicker] Geolocation error', err);
        const errorMsg = err.code === 1 
          ? 'يرجى منح صلاحية الوصول للموقع من إعدادات المتصفح'
          : 'فشل تحديد الموقع، يرجى المحاولة مرة أخرى';
        toast({ title: errorMsg, variant: 'destructive' });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  };

  useEffect(() => {
    console.log('[MapLocationPicker] manual button check');
    setTimeout(() => {
      const el = document.querySelector('.manual-geolocate-button');
      console.log('[MapLocationPicker] manual element:', el);
    }, 250);
  }, []);
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
      lat: center?.lat(),
      lng: center?.lng(),
    });
    if (!center) return;
    const serviceCheck = await checkServiceArea(center.lat(), center.lng());
    const location = {
      lat: center.lat(),
      lng: center.lng(),
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

        {/* Floating manual geolocate button - top-left (brought forward for mobile overlays) */}
        <div className="absolute top-14 sm:top-4 left-4 z-50 safe-area-top">
          <button
            onClick={manualGeolocateLocal}
            className="manual-geolocate-button w-10 h-10 flex items-center justify-center rounded-md bg-primary text-primary-foreground shadow-glow shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 active:scale-95 border border-primary/30"
            title="تحديث الموقع"
            aria-label="تحديث الموقع"
          >
            <Navigation className="w-4 h-4" />
          </button>
        </div>

        {/* Drag instruction hint - moved to bottom-left */}
        {!isDragging && centerAddress && (
          <div className="absolute bottom-4 left-4 z-30 pointer-events-none safe-area-bottom">
            <div className="bg-card/90 backdrop-blur-md px-3 py-2 rounded-full shadow-lg border border-border/50 animate-bounce">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="text-lg">👉</span>
                اسحب الخريطة لتغيير الموقع
              </p>
            </div>
          </div>
        )}

        {/* RADICAL FIX v2: Pin rendered OUTSIDE the map container flow */}
        {/* Using a portal-like approach with highest z-index */}
        {(() => {
          console.log('🔴 PIN RENDER - isPickup:', isPickup, 'isLoading:', isLoading);
          return null;
        })()}
        <div 
          id="location-pin-marker"
          style={{
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, calc(-100% + 8px))',
            zIndex: 99999,
            pointerEvents: 'none',
          }}
        >
          {/* Outer glow ring for visibility */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: isPickup 
                ? 'radial-gradient(circle, rgba(34, 197, 94, 0.3) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(14, 165, 233, 0.3) 0%, transparent 70%)',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Pin head - SOLID COLORS */}
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isPickup ? '#16a34a' : '#0284c7',
                border: '5px solid white',
                boxShadow: `
                  0 8px 32px ${isPickup ? 'rgba(22, 163, 74, 0.6)' : 'rgba(2, 132, 199, 0.6)'},
                  0 0 0 8px rgba(255, 255, 255, 0.8),
                  0 0 80px ${isPickup ? 'rgba(22, 163, 74, 0.5)' : 'rgba(2, 132, 199, 0.5)'}
                `,
              }}
            >
              {isPickup ? (
                <Target style={{ width: '28px', height: '28px', color: 'white', strokeWidth: 3 }} />
              ) : (
                <MapPin style={{ width: '28px', height: '28px', color: 'white', strokeWidth: 3 }} />
              )}
            </div>

            {/* Pin needle - using CSS triangle */}
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: '14px solid transparent',
                borderRight: '14px solid transparent',
                borderTop: `40px solid ${isPickup ? '#16a34a' : '#0284c7'}`,
                marginTop: '-8px',
                filter: `drop-shadow(0 4px 8px ${isPickup ? 'rgba(22, 163, 74, 0.4)' : 'rgba(2, 132, 199, 0.4)'})`,
              }}
            />
            
            {/* Ground shadow */}
            <div 
              style={{
                width: '24px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.25)',
                filter: 'blur(4px)',
                marginTop: '-4px',
              }}
            />
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
          {/* Dynamic search input */}
          <div className="mb-3 relative">
            <DynamicSearchHeader
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onClear={clearSearch}
              isSearching={isSearching}
              placeholder={
                isPickup
                  ? "ابحث عن موقع الانطلاق..."
                  : "ابحث عن الوجهة..."
              }
            />
          </div>

          {/* Dynamic search results */}
          {searchQuery && (
            <DynamicSearchResults
              query={searchQuery}
              results={predictions}
              isSearching={isSearching}
              isLoadingDetails={isLoadingDetails}
              onSelect={async (placeId, mainText) => {
                const placeDetails = await getPlaceDetails(placeId);
                if (placeDetails) {
                  if (map.current) {
                    map.current.panTo({
                      lat: placeDetails.lat,
                      lng: placeDetails.lng,
                    });
                    map.current.setZoom(16);
                  }
                  setCenterAddress(placeDetails.address);
                  checkServiceArea(placeDetails.lat, placeDetails.lng);
                  setSearchQuery("");
                }
              }}
              maxResults={6}
            />
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
