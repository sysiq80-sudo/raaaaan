import React, {
  useEffect,
  useState,
  useCallback,
  lazy,
  Suspense,
  useRef,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Navigation,
  Loader2,
  MapPin,
  Target,
  AlertTriangle,
  Check,
  Clock,
  ChevronDown,
  Zap,
  Menu,
  ArrowUpDown,
  Sparkles,
  Plus,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import useRiderStore from "@/stores/riderStore";
import { useFareCalculation } from "@/hooks/useFareCalculation";
import { useOptimizedNearbyDrivers } from "@/hooks/useOptimizedNearbyDrivers";
import CompactVehicleSelector from "@/components/rider/CompactVehicleSelector";
import PaymentMethodSheet from "@/components/rider/PaymentMethodSheet";
import { ScheduleRideDialog } from "@/components/rider/ScheduleRideDialog";
import RiderSideMenu from "@/components/rider/RiderSideMenu";
import PromoCodeSheet from "@/components/rider/PromoCodeSheet";
import StatusIcons from "@/components/common/StatusIcons";
import NetworkStatusBar from "@/components/common/NetworkStatusBar";
import StaticMapPlaceholder from "@/components/common/StaticMapPlaceholder";
import RiderNotificationsBell from "@/components/rider/RiderNotificationsBell";
import { motion, AnimatePresence } from "framer-motion";
import { roundFare } from "@/lib/constants";
import { playSound, hapticFeedback } from "@/utils/sounds";

import {
  checkDestinationGeofence,
  type GeofenceResult,
} from "@/lib/geofencing";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// New custom hooks
import { useRiderData } from "@/hooks/useRiderData";
import { useLocationPicker } from "@/hooks/useLocationPicker";
import { useBookingFlow } from "@/hooks/useBookingFlow";
import { useSearchAndPlaces } from "@/hooks/useSearchAndPlaces";
import { useRideTracking } from "@/hooks/useRideTracking";
import { useLastLocation } from "@/hooks/useLastLocation";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  DynamicSearchHeader,
  DynamicSearchResults,
} from "@/components/rider/DynamicSearchResults";
import { LocationPermissionPrompt } from "@/components/rider/LocationPermissionPrompt";
import LocationInputField from "@/components/rider/LocationInputField";
import QuickAccessChips from "@/components/rider/QuickAccessChips";
import FavoriteMarkersLayer from "@/components/rider/FavoriteMarkersLayer";
import MapContainer from "@/components/rider/MapContainer";
import { useFavoritesStore } from "@/stores/useFavoritesStore";

// Performance & Enhancement hooks
import {
  usePerformanceMonitoring,
  useOperationTiming,
} from "@/hooks/usePerformanceMonitoring";
import { useLastRide, useRiderPreferences } from "@/hooks/useLocalStorage";
import { useOfflineMode } from "@/hooks/useOfflineMode";

// Lazy load heavy components
const RideWaitingScreen = lazy(
  () => import("@/components/rider/RideWaitingScreen"),
);
const LiveRideTracker = lazy(
  () => import("@/components/rider/LiveRideTracker"),
);
const RideCompletedScreen = lazy(
  () => import("@/components/rider/RideCompletedScreen"),
);
const RideRatingScreen = lazy(
  () => import("@/components/rider/RideRatingScreen"),
);
const OnboardingFlow = lazy(() => import("@/components/rider/OnboardingFlow"));

// Loading skeleton
const ScreenSkeleton = () => (
  <div className="h-screen w-full bg-background flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-muted-foreground">جاري التحميل...</p>
    </div>
  </div>
);
interface LocationType {
  lat: number;
  lng: number;
  address: string;
}
type VehicleType = "economy" | "comfort" | "premium" | "women_only";
type PaymentMethodType =
  | "cash"
  | "wallet"
  | "card"
  | "zain_cash"
  | "super_key"
  | "nas_wallet";

// Wrapper component to ensure GoPage is rendered safely within Router context
const GoPageContent: React.FC<{ scheduleMode?: boolean }> = ({
  scheduleMode = false,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Performance monitoring
  const metrics = usePerformanceMonitoring("GoPage");
  const { measureOperation } = useOperationTiming();

  // Local storage hooks
  const { lastRide, saveLastRide } = useLastRide();
  const { preferences } = useRiderPreferences();
  const { lastLocation, saveLocation } = useLastLocation();
  const [hasSeenOnboarding] = useLocalStorage(
    "raan_onboarding_completed",
    false,
  );
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [mapReloadKey, setMapReloadKey] = useState(0);
  const [routeStops, setRouteStops] = useState<LocationType[]>([]);
  const favorites = useFavoritesStore((state) => state.favorites);

  // Offline support
  const { isOnline } = useOfflineMode();

  // ✅ دالة متقدمة لبناء عنوان وصفي بمنطق أولويات
  const buildDescriptiveAddress = useCallback((address: string): string => {
    if (!address || !address.trim()) return "";
    if (address.includes("جاري تحديد العنوان")) return "";

    const parts = address
      .split(/[،,]/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parts.length === 0) return "";

    // فحص Plus Code وحذفه إذا وُجد
    const plusCodeRegex = /^[A-Z0-9]{4}\+[A-Z0-9]{2,}/;
    const cleanParts = parts.filter((p) => !plusCodeRegex.test(p));
    if (cleanParts.length === 0) return "";

    const isGovernorate = (value: string) => value.includes("محافظة");
    const isCountry = (value: string) => value === "العراق";

    const filteredParts = cleanParts.filter(
      (p) => !isCountry(p) && !isGovernorate(p),
    );
    if (filteredParts.length === 0) return cleanParts[0] || "";

    // اجعل المدينة في نهاية العنوان قدر الإمكان
    const cityCandidate = [...filteredParts]
      .reverse()
      .find((p) => !isCountry(p) && !isGovernorate(p));
    const headParts = filteredParts.filter((p) => p !== cityCandidate);

    const ordered = cityCandidate
      ? [...headParts, cityCandidate]
      : filteredParts;

    // أولوية العرض: معلم > شارع + حي > مدينة (نهاية)
    if (ordered.length >= 3) return ordered.slice(0, 3).join("، ");
    if (ordered.length === 2) return ordered.join("، ");
    return ordered[0];
  }, []);

  // Core data hooks
  const { userId, user, mapToken, userLocation, menuOpen, setMenuOpen } =
    useRiderData();

  // Get bottom nav state from store
  const bottomNavEnabled = useRiderStore((state) => state.bottomNavEnabled);

  // Location picker
  const {
    mapContainer,
    map,
    isLoading,
    isDragging,
    centerAddress,
    centerLat,
    centerLng,
    serviceAreaStatus,
    isCheckingService,
    setCenterAddress,
    setCenterLat,
    setCenterLng,
    setManualAddress, // ✨ NEW
    checkServiceArea,
    reverseGeocode,
    setIsLoading,
  } = useLocationPicker(mapToken, userLocation, mapReloadKey);

  // Booking flow
  const {
    bookingMapContainer,
    bookingMap,
    selectedVehicle,
    setSelectedVehicle,
    paymentMethod,
    setPaymentMethod,
    routeDistance,
    setRouteDistance,
    routeDuration,
    setRouteDuration,
    isBooking,
    setIsBooking,
    paymentSheetOpen,
    setPaymentSheetOpen,
    initializeBookingMap,
    fetchRoute,
    cleanup: cleanupBooking,
  } = useBookingFlow(mapToken);

  // Search and places
  const {
    searchQuery,
    setSearchQuery,
    predictions,
    isSearching,
    isLoadingDetails,
    getPlaceDetails,
    clearSearch,
  } = useSearchAndPlaces(userLocation);

  // Ride tracking
  const {
    activeRide,
    setActiveRide,
    showWaitingScreen,
    setShowWaitingScreen,
    showLiveTracker,
    setShowLiveTracker,
    completedRide,
    showCompletedScreen,
    setShowCompletedScreen,
    handleRideCompletion,
    checkActiveRideConflict,
    clearCompletedRide,
  } = useRideTracking(userId);

  const smartSuggestions = useMemo(() => {
    const suggestions: Array<{
      id: string;
      label: string;
      address: string;
      lat: number;
      lng: number;
      reason: string;
    }> = [];
    const seen = new Set<string>();

    const addSuggestion = (
      id: string,
      label: string,
      address: string,
      lat: number,
      lng: number,
      reason: string,
    ) => {
      if (!lat || !lng) return;
      const key = `${lat.toFixed(5)}:${lng.toFixed(5)}`;
      if (seen.has(key)) return;
      seen.add(key);
      suggestions.push({ id, label, address, lat, lng, reason });
    };

    const hour = new Date().getHours();
    const preferWork = hour >= 6 && hour <= 11;
    const preferHome = hour >= 16 || hour <= 2;

    if (preferWork) {
      favorites
        .filter((fav) => fav.icon === "work" || fav.name.includes("عمل"))
        .slice(0, 1)
        .forEach((fav) => {
          addSuggestion(
            `fav-${fav.id}`,
            fav.name,
            fav.address,
            fav.lat,
            fav.lng,
            "اقتراح وقت الدوام",
          );
        });
    }

    if (preferHome) {
      favorites
        .filter((fav) => fav.icon === "home" || fav.name.includes("بيت"))
        .slice(0, 1)
        .forEach((fav) => {
          addSuggestion(
            `fav-${fav.id}`,
            fav.name,
            fav.address,
            fav.lat,
            fav.lng,
            "اقتراح وقت الرجوع",
          );
        });
    }

    if (
      lastRide.dropoffAddress &&
      lastRide.dropoffLat &&
      lastRide.dropoffLng &&
      Date.now() - lastRide.timestamp < 7 * 24 * 60 * 60 * 1000
    ) {
      addSuggestion(
        "recent-dropoff",
        "آخر وجهة",
        lastRide.dropoffAddress,
        lastRide.dropoffLat,
        lastRide.dropoffLng,
        "مبني على آخر رحلة",
      );
    }

    favorites
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .forEach((fav) => {
        addSuggestion(
          `fav-${fav.id}`,
          fav.name,
          fav.address,
          fav.lat,
          fav.lng,
          "من المفضلة",
        );
      });

    return suggestions.slice(0, 3);
  }, [favorites, lastRide]);

  const handleSmartSuggestionSelect = useCallback(
    (suggestion: { address: string; lat: number; lng: number }) => {
      if (map.current) {
        map.current.panTo({ lat: suggestion.lat, lng: suggestion.lng });
        map.current.setZoom(16);
      }
      setCenterLat(suggestion.lat);
      setCenterLng(suggestion.lng);
      setManualAddress(suggestion.address);
      checkServiceArea(suggestion.lat, suggestion.lng);
    },
    [map, setCenterLat, setCenterLng, setManualAddress, checkServiceArea],
  );

  const handleAddStop = useCallback(() => {
    if (!centerLat || !centerLng || !centerAddress) {
      toast({
        title: "الرجاء تحديد موقع التوقف",
        description: "اختر موقع التوقف من الخريطة أولاً",
        variant: "destructive",
      });
      return;
    }

    if (routeStops.length >= 3) {
      toast({
        title: "الحد الأقصى للتوقفات",
        description: "يمكنك إضافة حتى 3 توقفات فقط",
        variant: "destructive",
      });
      return;
    }

    const normalizedAddress =
      buildDescriptiveAddress(centerAddress) || centerAddress;
    const alreadyAdded = routeStops.some(
      (stop) =>
        Math.abs(stop.lat - centerLat) < 0.0005 &&
        Math.abs(stop.lng - centerLng) < 0.0005,
    );

    if (alreadyAdded) {
      toast({
        title: "هذا التوقف مضاف بالفعل",
        description: "اختر موقعاً مختلفاً للتوقف",
        variant: "destructive",
      });
      return;
    }

    setRouteStops((prev) => [
      ...prev,
      { lat: centerLat, lng: centerLng, address: normalizedAddress },
    ]);
  }, [
    centerLat,
    centerLng,
    centerAddress,
    routeStops,
    buildDescriptiveAddress,
    toast,
  ]);

  const handleRemoveStop = useCallback((index: number) => {
    setRouteStops((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Local state
  const setStoreUserLocation = useRiderStore((s) => s.setUserLocation);
  const getBestPosition = useCallback(
    (onRefine?: (pos: GeolocationPosition) => void) => {
      return new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("NO_GEOLOCATION"));
          return;
        }

        const quickOptions: PositionOptions = {
          enableHighAccuracy: false,
          timeout: 4000,
          maximumAge: 60000,
        };

        const refineOptions: PositionOptions = {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 0,
        };

        let best: GeolocationPosition | null = null;
        let resolved = false;

        const stopRefineAfterMs = 7000;
        const startedAt = Date.now();

        const tryResolve = (pos: GeolocationPosition) => {
          if (!resolved) {
            resolved = true;
            resolve(pos);
          }
        };

        const watchId = navigator.geolocation.watchPosition(
          (wp) => {
            if (!best || wp.coords.accuracy < best.coords.accuracy) {
              best = wp;
              if (resolved && onRefine) {
                onRefine(wp);
              }
            }
            if (
              wp.coords.accuracy <= 30 ||
              Date.now() - startedAt > stopRefineAfterMs
            ) {
              navigator.geolocation.clearWatch(watchId);
            }
          },
          () => {
            navigator.geolocation.clearWatch(watchId);
          },
          refineOptions,
        );

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            best = pos;
            tryResolve(pos);
          },
          (err) => {
            if (best) {
              tryResolve(best);
              return;
            }

            // fallback سريع منخفض الدقة لتجنب timeout
            navigator.geolocation.getCurrentPosition(
              (fallbackPos) => {
                best = fallbackPos;
                tryResolve(fallbackPos);
              },
              (fallbackErr) => {
                reject(fallbackErr || err);
              },
              quickOptions,
            );
          },
          refineOptions,
        );
      });
    },
    [],
  );

  const getDistanceMeters = useCallback(
    (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const R = 6371000;
      const dLat = (b.lat - a.lat) * (Math.PI / 180);
      const dLng = (b.lng - a.lng) * (Math.PI / 180);
      const lat1 = a.lat * (Math.PI / 180);
      const lat2 = b.lat * (Math.PI / 180);

      const sinDLat = Math.sin(dLat / 2);
      const sinDLng = Math.sin(dLng / 2);
      const aVal =
        sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
      const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
      return R * c;
    },
    [],
  );

  const shouldAcceptLocation = useCallback(
    (pos: GeolocationPosition) => {
      const accuracy = pos.coords.accuracy ?? 9999;
      if (!userLocation) return accuracy <= 150;

      const candidate = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const distance = getDistanceMeters(userLocation, candidate);

      // إذا الدقة ضعيفة والمسافة كبيرة، لا تعتمد القراءة
      if (accuracy > 120 && distance > 80) {
        return false;
      }
      return true;
    },
    [getDistanceMeters, userLocation],
  );

  const manualGeolocateMain = useCallback(() => {
    setIsLoading(true);
    getBestPosition((refined) => {
      if (!shouldAcceptLocation(refined)) return;
      const refinedLoc = {
        lat: refined.coords.latitude,
        lng: refined.coords.longitude,
      };
      setStoreUserLocation(refinedLoc as any);
      if (map.current) {
        map.current.panTo(refinedLoc);
      }
      reverseGeocode(refinedLoc.lat, refinedLoc.lng);
    })
      .then((pos) => {
        if (!shouldAcceptLocation(pos)) {
          if (userLocation && map.current) {
            map.current.panTo({ lat: userLocation.lat, lng: userLocation.lng });
            map.current.setZoom(16);
          }
          toast({
            title: "دقة الموقع منخفضة",
            description: "حاول الاقتراب من نافذة أو تفعيل GPS",
            variant: "destructive",
          });
          return;
        }
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setStoreUserLocation(loc as any);

        if (map.current) {
          map.current.panTo(loc);
          map.current.setZoom(17);
        }

        reverseGeocode(loc.lat, loc.lng);
      })
      .catch((err) => {
        console.warn("[GoPage] geolocation failed", err);
        if (userLocation) {
          if (map.current) {
            map.current.panTo({ lat: userLocation.lat, lng: userLocation.lng });
            map.current.setZoom(16);
          }
          reverseGeocode(userLocation.lat, userLocation.lng);
        } else {
          const errorMsg =
            err?.code === 1 || err?.message === "NO_GEOLOCATION"
              ? "يرجى منح صلاحية الوصول للموقع"
              : "فشل تحديد الموقع";
          toast({ title: errorMsg, variant: "destructive" });
        }
      })
      .finally(() => setIsLoading(false));
  }, [
    getBestPosition,
    map,
    reverseGeocode,
    setIsLoading,
    setStoreUserLocation,
    shouldAcceptLocation,
    toast,
    userLocation,
  ]);

  const manualGeolocateBooking = useCallback(() => {
    getBestPosition((refined) => {
      if (!shouldAcceptLocation(refined)) return;
      const refinedLoc = {
        lat: refined.coords.latitude,
        lng: refined.coords.longitude,
      };
      if (bookingMap.current) {
        bookingMap.current.panTo(refinedLoc);
      }
    })
      .then((pos) => {
        if (!shouldAcceptLocation(pos)) {
          toast({
            title: "دقة الموقع منخفضة",
            description: "حاول الاقتراب من نافذة أو تفعيل GPS",
            variant: "destructive",
          });
          return;
        }
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (bookingMap.current) {
          bookingMap.current.panTo(loc);
          bookingMap.current.setZoom(16);
        }
      })
      .catch((err) => {
        console.warn("[GoPage] booking geolocation failed", err);
        const errorMsg =
          err?.code === 1 || err?.message === "NO_GEOLOCATION"
            ? "يرجى منح صلاحية الوصول للموقع"
            : "فشل تحديد الموقع";
        toast({ title: errorMsg, variant: "destructive" });
      });
  }, [bookingMap, getBestPosition, shouldAcceptLocation, toast]);

  // Layout management - Bottom panel height tracking
  const bottomPanelRef = useRef<HTMLDivElement>(null);
  const scheduleDialogRef = useRef<{ openDialog: () => void }>(null);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(0);
  const [hasStartedDragging, setHasStartedDragging] = useState(false);

  const [currentMode, setCurrentMode] = useState<
    "pickup" | "dropoff" | "booking"
  >("pickup");
  const [pickupLocation, setPickupLocation] = useState<LocationType | null>(
    null,
  );
  const [dropoffLocation, setDropoffLocation] = useState<LocationType | null>(
    null,
  );
  const [isConfirming, setIsConfirming] = useState(false);
  const [localServiceAreaStatus, setLocalServiceAreaStatus] =
    useState<any>(null);
  const [geofenceResult, setGeofenceResult] = useState<GeofenceResult | null>(
    null,
  );
  const [showGeofenceAlert, setShowGeofenceAlert] = useState(false);
  const [showRatingScreen, setShowRatingScreen] = useState(false);

  // Fare calculation
  const { fareBreakdown, fareLoading } = useFareCalculation(
    pickupLocation,
    dropoffLocation,
    selectedVehicle,
    routeDistance,
  );

  // Nearby drivers
  const { availableDriversByType } = useOptimizedNearbyDrivers(
    pickupLocation,
    selectedVehicle,
    {
      enableRealtime: !!pickupLocation,
      debounceMs: 1000,
    },
  );

  // Reset center address when mode changes
  useEffect(() => {
    if (currentMode === "dropoff" || currentMode === "booking") {
      setCenterAddress("");
    }
  }, [currentMode]);

  // Track bottom panel height for map padding
  useEffect(() => {
    const updatePanelHeight = () => {
      if (bottomPanelRef.current) {
        const height = bottomPanelRef.current.offsetHeight;
        setBottomPanelHeight(height);

        // تطبيق padding على الخريطة
        if (mapContainer.current) {
          mapContainer.current.style.paddingBottom = "0px";
        }
      }
    };

    // تحديث فوري
    updatePanelHeight();

    // استدعاء عند resize
    const observer = new ResizeObserver(() => {
      updatePanelHeight();
    });

    if (bottomPanelRef.current) {
      observer.observe(bottomPanelRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Trigger map resize when bottom panel height changes
  useEffect(() => {
    if (map.current && window.google?.maps?.event) {
      window.google.maps.event.trigger(map.current, "resize");

      // recenter the map
      if (userLocation) {
        map.current.panTo({ lat: userLocation.lat, lng: userLocation.lng });
      }
    }
  }, [bottomPanelHeight, userLocation]);

  // فتح dialog الحجز المتقدم تلقائياً عند الدخول عبر /rider/schedule
  useEffect(() => {
    if (
      scheduleMode &&
      scheduleDialogRef.current &&
      pickupLocation &&
      dropoffLocation
    ) {
      // تأخير صغير للسماح بتحميل Dialog تماماً
      const timer = setTimeout(() => {
        scheduleDialogRef.current?.openDialog();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [scheduleMode, pickupLocation, dropoffLocation]);

  // 🔄 تحديث تلقائي مستمر للخريطة
  useEffect(() => {
    if (!userId) return;

    // تحديث فوري عند mount
    const checkRide = async () => {
      const { data } = await supabase
        .from("rides")
        .select("*")
        .eq("rider_id", userId)
        .in("status", ["pending", "accepted", "arrived", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) {
        // لا توجد رحلة نشطة - تأكد من إخفاء الشاشات
        setShowWaitingScreen(false);
        setShowLiveTracker(false);
      }
    };

    checkRide();

    // تحديث دوري كل 3 ثوانٍ
    const interval = setInterval(checkRide, 3000);

    // تحديث عند العودة للـ tab
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log("📍 Page visible - checking ride status");
        checkRide();
      }
    };

    // تحديث عند focus على الصفحة
    const handleFocus = () => {
      console.log("📍 Page focused - checking ride status");
      checkRide();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [userId, setShowWaitingScreen, setShowLiveTracker]);

  // Check if user should see onboarding (first time)
  useEffect(() => {
    if (!hasSeenOnboarding && userId) {
      setShowOnboarding(true);
    }
  }, [hasSeenOnboarding, userId]);

  // عرض طلب صلاحية الموقع عند أول دخول (بعد Onboarding)
  useEffect(() => {
    const hasRequestedBefore = localStorage.getItem(
      "location_permission_requested",
    );
    if (!hasRequestedBefore && userId && hasSeenOnboarding) {
      // تأخير قليل لإعطاء فرصة للـ UI بالتحميل
      setTimeout(() => {
        setShowLocationPrompt(true);
      }, 1000);
    }
  }, [userId, hasSeenOnboarding]);

  const handleLocationPermissionGranted = (location: {
    lat: number;
    lng: number;
  }) => {
    console.log("✅ Location permission granted:", location);
    setShowLocationPrompt(false);
    // تحديث الموقع في الخريطة
    if (map.current) {
      map.current.panTo(location);
      map.current.setZoom(17);
    }
  };

  // Save user location when available (only once when location is first detected)
  useEffect(() => {
    if (userLocation && userLocation.lat && userLocation.lng) {
      saveLocation({
        lat: userLocation.lat,
        lng: userLocation.lng,
        address: "موقعك الحالي",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation?.lat, userLocation?.lng]);

  // Fetch route when both locations are set (for initial location picker map)
  useEffect(() => {
    if (!pickupLocation || !dropoffLocation || currentMode === "booking")
      return;
    fetchRoute(pickupLocation, dropoffLocation, routeStops, {
      optimizeWaypoints: true,
    });
  }, [pickupLocation, dropoffLocation, routeStops, fetchRoute, currentMode]);

  // Initialize booking mode map
  useEffect(() => {
    if (currentMode !== "booking" || !pickupLocation || !dropoffLocation)
      return;
    initializeBookingMap(pickupLocation, dropoffLocation, routeStops, {
      optimizeWaypoints: true,
    });
  }, [
    currentMode,
    pickupLocation,
    dropoffLocation,
    routeStops,
    initializeBookingMap,
  ]);

  // تحذير المستخدم قبل مغادرة الصفحة أثناء الحجز
  useEffect(() => {
    if (currentMode === "booking" && dropoffLocation) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue =
          "هل أنت متأكد من مغادرة الصفحة؟ سيتم إلغاء الحجز الحالي.";
        return e.returnValue;
      };
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () =>
        window.removeEventListener("beforeunload", handleBeforeUnload);
    }
  }, [currentMode, dropoffLocation]);

  // Local helper: center map on user location
  const centerOnUser = useCallback(() => {
    if (!map.current) return;

    // Get fresh location when button is clicked
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const freshLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          if (map.current) {
            map.current.panTo(freshLocation);
            map.current.setZoom(16);
          }
          toast({
            title: "تم التحديث",
            description: "تم تحديث موقعك الحالي",
          });
        },
        (error) => {
          console.error("Location error:", error);
          toast({
            title: "خطأ",
            description: "تعذر الحصول على موقعك الحالي",
            variant: "destructive",
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        },
      );
    } else {
      toast({
        title: "خطأ",
        description: "متصفحك لا يدعم تحديد الموقع",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Local helper: handle location confirmation
  const handleConfirm = useCallback(async () => {
    if (isConfirming) return;
    setIsConfirming(true);
    try {
      // الحصول على مركز الخريطة الحالي
      if (!map.current) {
        toast({
          title: "خطأ",
          description: "الخريطة غير مهيأة",
          variant: "destructive",
        });
        return;
      }
      const center = map.current.getCenter();
      if (!center) {
        console.error("Cannot get map center");
        return;
      }

      // Get the actual lat/lng values - center.lat() and center.lng() are always functions
      const actualLat: number = center.lat();
      const actualLng: number = center.lng();

      let address = centerAddress;

      // إذا لم نحصل على عنوان، نحصل عليه من Google Geocoding
      if (!address) {
        try {
          if (window.google?.maps && map.current) {
            // Step 1: Get full address from Geocoding API first
            const geocoder = new google.maps.Geocoder();
            const result = await geocoder.geocode({
              location: { lat: actualLat, lng: actualLng },
              language: "ar",
            });

            if (result.results && result.results.length > 0) {
              let finalAddress = result.results[0].formatted_address;
              let poiName: string | null = null;

              // Step 2: Try to get POI name
              try {
                const placesService = new google.maps.places.PlacesService(
                  map.current,
                );
                const request = {
                  location: new google.maps.LatLng(actualLat, actualLng),
                  radius: 50,
                  language: "ar",
                };

                await new Promise<void>((resolve) => {
                  placesService.nearbySearch(request, (results, status) => {
                    if (
                      status === google.maps.places.PlacesServiceStatus.OK &&
                      results &&
                      results.length > 0
                    ) {
                      const nearestPlace = results[0];

                      // ✅ فلترة: فقط الأماكن المميزة
                      const validPoiTypes = [
                        "hospital",
                        "clinic",
                        "doctor",
                        "pharmacy",
                        "mosque",
                        "church",
                        "place_of_worship",
                        "school",
                        "university",
                        "library",
                        "government",
                        "city_hall",
                        "police",
                        "fire_station",
                        "shopping_mall",
                        "supermarket",
                        "store",
                        "restaurant",
                        "cafe",
                        "bakery",
                        "bank",
                        "atm",
                        "post_office",
                        "gas_station",
                        "car_repair",
                        "park",
                        "stadium",
                        "gym",
                        "museum",
                        "tourist_attraction",
                        "point_of_interest",
                      ];

                      const hasValidType = nearestPlace.types?.some((t) =>
                        validPoiTypes.includes(t),
                      );
                      const isRoute = nearestPlace.types?.includes("route");
                      const isNeighborhood =
                        nearestPlace.types?.includes("neighborhood");

                      if (
                        nearestPlace.name &&
                        hasValidType &&
                        !isRoute &&
                        !isNeighborhood
                      ) {
                        poiName = nearestPlace.name;
                        console.log(
                          "✅ Valid POI found in confirmation:",
                          poiName,
                        );
                      } else {
                        console.log(
                          "⚠️ Filtered out non-POI:",
                          nearestPlace.name,
                          nearestPlace.types,
                        );
                      }
                    }
                    resolve();
                  });
                });
              } catch (placeError) {
                console.warn("Places API error (non-critical):", placeError);
              }

              // Step 3: Look for POI in geocoding results if not found
              if (!poiName) {
                const poiResult = result.results.find(
                  (r) =>
                    r.types.includes("point_of_interest") &&
                    r.name &&
                    !r.types.includes("route") &&
                    !r.types.includes("neighborhood"),
                );

                if (poiResult && poiResult.name) {
                  poiName = poiResult.name;
                  console.log("✅ POI name from geocoding:", poiName);
                }
              }

              // Step 4: Build descriptive final address with priority logic
              const components = result.results[0]?.address_components || [];
              const getComponent = (type: string) =>
                components.find((c) => c.types.includes(type))?.long_name;

              const streetNumber = getComponent("street_number");
              const route = getComponent("route");
              const neighborhood =
                getComponent("neighborhood") ||
                getComponent("sublocality") ||
                getComponent("sublocality_level_1") ||
                getComponent("sublocality_level_2");
              const locality =
                getComponent("locality") ||
                getComponent("administrative_area_level_2");
              const admin1 = getComponent("administrative_area_level_1");

              const street = [route, streetNumber]
                .filter(Boolean)
                .join(" ")
                .trim();
              const city = locality || admin1;

              const plusCodeRegex = /^[A-Z0-9]{4}\+[A-Z0-9]{2,}/;
              let mainPart = poiName?.trim() || "";
              if (!mainPart || plusCodeRegex.test(mainPart)) {
                mainPart = street || neighborhood || city || "";
              }

              const detailParts = [mainPart, neighborhood || "", city || ""]
                .filter((p) => p && p.length > 0)
                .filter((p, idx, arr) => arr.indexOf(p) === idx);

              let priorityAddress = detailParts.join("، ");
              if (priorityAddress) {
                console.log(
                  "✅ Priority 1 - Address components:",
                  priorityAddress,
                );
              }

              // بديل: تنظيف formatted_address عند الحاجة
              if (!priorityAddress) {
                let addressParts = finalAddress
                  .split(/[،,]/)
                  .map((p) => p.trim())
                  .filter((p) => p.length > 0 && !plusCodeRegex.test(p));
                priorityAddress = addressParts.slice(0, 3).join("، ");
                if (priorityAddress) {
                  console.log(
                    "✅ Priority 2 - Multiple address parts:",
                    priorityAddress,
                  );
                }
              }

              // البديل الأخير
              if (!priorityAddress) {
                priorityAddress =
                  finalAddress ||
                  `${actualLat.toFixed(4)}, ${actualLng.toFixed(4)}`;
                console.log(
                  "✅ Fallback - Using original or coordinates:",
                  priorityAddress,
                );
              }

              address = priorityAddress;
            } else {
              address = `${actualLat.toFixed(5)}, ${actualLng.toFixed(5)}`;
            }
          } else {
            address = `${actualLat.toFixed(5)}, ${actualLng.toFixed(5)}`;
          }
        } catch (error) {
          console.error("Reverse geocode error:", error);
          address = `${actualLat.toFixed(5)}, ${actualLng.toFixed(5)}`;
        }
      }

      // فحص منطقة الخدمة
      const serviceCheck = await checkServiceArea(actualLat, actualLng);
      setLocalServiceAreaStatus(serviceCheck);
      const location: LocationType = {
        lat: actualLat,
        lng: actualLng,
        address: address,
      };
      if (currentMode === "pickup") {
        // فحص Geofencing لموقع الانطلاق
        const geofenceCheck = await checkDestinationGeofence(
          actualLat,
          actualLng,
          mapToken,
        );

        if (!geofenceCheck.allowed) {
          // موقع الانطلاق خارج العراق - عرض رسالة
          setGeofenceResult(geofenceCheck);
          setShowGeofenceAlert(true);
          return; // إيقاف العملية
        }

        setPickupLocation(location);
        setCurrentMode("dropoff");
        setCenterAddress("");
        setSearchQuery("");
        playSound("success");
        toast({
          title: "تم تحديد موقع الانطلاق ✅",
          description: address,
        });
      } else if (currentMode === "dropoff") {
        // فحص Geofencing قبل تحديد الوجهة
        const geofenceCheck = await checkDestinationGeofence(
          actualLat,
          actualLng,
          mapToken,
        );

        if (!geofenceCheck.allowed) {
          // الوجهة خارج العراق - عرض رسالة
          setGeofenceResult(geofenceCheck);
          setShowGeofenceAlert(true);
          return; // إيقاف العملية
        }

        // الوجهة داخل العراق - متابعة الحجز
        setDropoffLocation(location);
        setCurrentMode("booking");
        playSound("success");
        toast({
          title: "تم تحديد الوجهة ✅",
          description: address,
        });
      }
    } catch (error) {
      console.error("Confirm error:", error);
      toast({
        title: "خطأ",
        description: "فشل تأكيد الموقع",
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
    }
  }, [currentMode, centerAddress, isConfirming, map, checkServiceArea, toast]);

  // Track first drag to hide tooltip permanently
  useEffect(() => {
    if (isDragging && !hasStartedDragging) {
      setHasStartedDragging(true);
    }
  }, [isDragging, hasStartedDragging]);

  // Reset booking state
  const resetBooking = useCallback(() => {
    console.log("🔄 [resetBooking] Starting reset process...");

    // Clear all booking-related state
    setPickupLocation(null);
    setDropoffLocation(null);
    setRouteStops([]);
    setRouteDistance(null);
    setRouteDuration(null);
    setShowWaitingScreen(false);
    setShowLiveTracker(false);
    setActiveRide(null);
    setSearchQuery("");
    setLocalServiceAreaStatus(null);

    // Reset to pickup mode to allow user to start fresh
    setCurrentMode("pickup");

    // Force map reinitialization to avoid black screen
    setIsLoading(true);
    setMapReloadKey((prev) => prev + 1);
    if (map.current) {
      map.current = null;
    }

    // ✅ إعادة كتابة منطق إعادة تعيين الخريطة بطريقة async
    const resetMap = async () => {
      if (!map.current) return;

      try {
        console.log("🗺️ [resetBooking] Starting map reset...");

        // ✅ Step 1: إظهار container الخريطة أولاً
        if (mapContainer.current) {
          mapContainer.current.style.display = "block";
          mapContainer.current.style.visibility = "visible";
          mapContainer.current.style.opacity = "1";
        }

        // ✅ Step 2: إخفاء overlay التحميل
        setIsLoading(false);

        // ✅ Step 3: الانتظار حتى repaint التالي
        await new Promise((resolve) => requestAnimationFrame(resolve));

        // ✅ Step 4: إعادة تحجيم الخريطة (Google Maps)
        if (window.google?.maps?.event) {
          window.google.maps.event.trigger(map.current, "resize");
        }
        console.log("✅ [resetBooking] Map resized");

        // ✅ Step 5: إعادة توسيط الخريطة
        if (userLocation) {
          map.current.panTo({ lat: userLocation.lat, lng: userLocation.lng });
          map.current.setZoom(15);

          // تحديث العنوان بعد التحريك
          setTimeout(() => {
            if (map.current) {
              const center = map.current.getCenter();
              if (center) {
                reverseGeocode(center.lat(), center.lng());
              }
            }
          }, 400);
        }

        console.log("✅ [resetBooking] Map reset complete");

        toast({
          title: "جاهز لرحلة جديدة",
          description: "يمكنك الآن طلب رحلة جديدة",
        });
      } catch (error) {
        console.error("❌ [resetBooking] Map reset failed:", error);
        toast({
          title: "خطأ في إعادة تعيين الخريطة",
          description: "حاول تحديث الصفحة",
          variant: "destructive",
        });
      }
    };

    // ✅ بدء reset بعد تأخير قصير
    setTimeout(() => resetMap(), 200);
  }, [userLocation, map, reverseGeocode, toast, setIsLoading, setMapReloadKey]);

  // Handle booking submission
  const handleBookRide = async () => {
    // التحقق من الاتصال بالإنترنت
    if (!isOnline) {
      toast({
        title: "لا يوجد اتصال بالإنترنت",
        description: "تحقق من اتصالك بالإنترنت وحاول مرة أخرى",
        variant: "destructive",
      });
      return;
    }

    if (!userId) {
      toast({
        title: "يجب تسجيل الدخول",
        description: "الرجاء تسجيل الدخول للحجز",
        variant: "destructive",
      });
      if (navigate) {
        navigate("/auth?redirect=/go");
      }
      return;
    }

    // Check if there's already an active ride
    if (
      activeRide &&
      activeRide.status !== "completed" &&
      activeRide.status !== "cancelled"
    ) {
      toast({
        title: "لديك رحلة نشطة",
        description: "الرجاء إنهاء الرحلة الحالية قبل حجز رحلة جديدة",
        variant: "destructive",
      });
      setShowWaitingScreen(true);
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

    // Check if pickup location is in service area
    try {
      const pickupServiceCheck = await checkServiceArea(
        pickupLocation.lat,
        pickupLocation.lng,
      );
      if (pickupServiceCheck && !pickupServiceCheck.in_service) {
        toast({
          title: "⚠️ موقع الانطلاق خارج منطقة الخدمة",
          description: pickupServiceCheck.nearest_region
            ? `أقرب منطقة خدمة: ${pickupServiceCheck.nearest_region.name_ar} (${pickupServiceCheck.nearest_region.distance_km} كم)`
            : "الرجاء اختيار موقع داخل مناطق الخدمة المتاحة",
          variant: "destructive",
        });
        return;
      }

      // Check if dropoff location is in service area
      const dropoffServiceCheck = await checkServiceArea(
        dropoffLocation.lat,
        dropoffLocation.lng,
      );
      if (dropoffServiceCheck && !dropoffServiceCheck.in_service) {
        toast({
          title: "⚠️ الوجهة خارج منطقة الخدمة",
          description: dropoffServiceCheck.nearest_region
            ? `أقرب منطقة خدمة: ${dropoffServiceCheck.nearest_region.name_ar} (${dropoffServiceCheck.nearest_region.distance_km} كم)`
            : "الرجاء اختيار وجهة داخل مناطق الخدمة المتاحة",
          variant: "destructive",
        });
        return;
      }
    } catch (error) {
      console.error("Service area check error:", error);
      // Continue with booking if service check fails
    }

    // Check fare
    const totalFare = fareBreakdown?.total_fare || 0;
    if (totalFare <= 0) {
      toast({
        title: "خطأ في حساب السعر",
        description: "الرجاء إعادة المحاولة",
        variant: "destructive",
      });
      return;
    }

    // التحقق من رصيد المحفظة إذا كان الدفع بالمحفظة
    if (paymentMethod === "wallet") {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("wallet_balance")
          .eq("user_id", userId)
          .single();

        const walletBalance = profile?.wallet_balance || 0;
        if (walletBalance < totalFare) {
          toast({
            title: "رصيد غير كافٍ",
            description: `رصيد المحفظة: ${walletBalance.toLocaleString()} د.ع - الأجرة المتوقعة: ${totalFare.toLocaleString()} د.ع`,
            variant: "destructive",
          });
          setPaymentSheetOpen(true);
          return;
        }
      } catch (error) {
        console.error("Wallet balance check error:", error);
      }
    }

    // Save last ride for quick rebooking
    saveLastRide({
      pickupAddress: pickupLocation.address,
      pickupLat: pickupLocation.lat,
      pickupLng: pickupLocation.lng,
      dropoffAddress: dropoffLocation.address,
      dropoffLat: dropoffLocation.lat,
      dropoffLng: dropoffLocation.lng,
      vehicleType: selectedVehicle,
      timestamp: Date.now(),
    });

    // ✅ إنشاء الحجز بدون حالة انتظار
    try {
      const { data: ride, error } = await supabase
        .from("rides")
        .insert([
          {
            rider_id: userId,
            pickup_location: {
              lat: pickupLocation.lat,
              lng: pickupLocation.lng,
            },
            dropoff_location: {
              lat: dropoffLocation.lat,
              lng: dropoffLocation.lng,
            },
            pickup_address: pickupLocation.address,
            dropoff_address: dropoffLocation.address,
            vehicle_type: selectedVehicle,
            payment_method: paymentMethod,
            estimated_fare: roundFare(fareBreakdown?.total_fare || 0),
            distance_km: routeDistance
              ? Number(routeDistance.toFixed(2))
              : null,
            duration_minutes: routeDuration ? Math.round(routeDuration) : null,
            status: "pending",
            stops:
              routeStops.length > 0
                ? routeStops.map((stop) => ({
                    lat: stop.lat,
                    lng: stop.lng,
                    address: stop.address,
                  }))
                : null,
          } as any,
        ])
        .select()
        .single();
      if (error) throw error;

      // Set active ride for tracking
      const pickupLoc = ride.pickup_location as unknown as {
        lat: number;
        lng: number;
      };
      const dropoffLoc = ride.dropoff_location as unknown as {
        lat: number;
        lng: number;
      };
      setActiveRide({
        id: ride.id,
        pickup_location: pickupLoc,
        dropoff_location: dropoffLoc,
        pickup_address: ride.pickup_address,
        dropoff_address: ride.dropoff_address,
        status: ride.status,
        estimated_fare: ride.estimated_fare,
        final_fare: ride.final_fare,
        distance_km: ride.distance_km,
        duration_minutes: ride.duration_minutes,
        vehicle_type: ride.vehicle_type,
        driver_id: ride.driver_id,
        created_at: ride.created_at,
        completed_at: ride.completed_at,
      });

      // Show waiting screen
      setShowWaitingScreen(true);
      hapticFeedback("booking_confirmed", [100, 50, 100]);

      // Trigger ride matching (في الخلفية)
      await supabase.functions.invoke("match-ride", {
        body: {
          rideId: ride.id,
        },
      });
      // ✅ لا toasts - الشاشة نفسها تعرض حالة البحث
    } catch (error: any) {
      console.error("❌ Booking error:", error);
      // فقط في حالة الخطأ نعرض toast
      toast({
        title: "فشل الحجز",
        description: error.message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    }
    // ✅ لا حاجة لـ setIsBooking(false) - لم نستخدمه أصلاً
  };
  const isPickup = currentMode === "pickup";
  const isDropoff = currentMode === "dropoff";
  const isBookingMode = currentMode === "booking";

  // Show location permission prompt
  if (showLocationPrompt) {
    return (
      <LocationPermissionPrompt
        onPermissionGranted={handleLocationPermissionGranted}
        onSkip={() => setShowLocationPrompt(false)}
      />
    );
  }

  // Show onboarding for new users
  if (showOnboarding) {
    return (
      <Suspense fallback={<ScreenSkeleton />}>
        <OnboardingFlow onComplete={() => setShowOnboarding(false)} />
      </Suspense>
    );
  }

  // Show rating screen first when ride completes
  if (showRatingScreen && completedRide) {
    return (
      <Suspense fallback={<ScreenSkeleton />}>
        <RideRatingScreen
          rideId={completedRide.id}
          driverId={completedRide.driver_id}
          driverName={"السائق"}
          fare={completedRide.final_fare || completedRide.estimated_fare || 0}
          onClose={() => {
            setShowRatingScreen(false);
            // Show completed screen after rating
            setShowCompletedScreen(true);
          }}
        />
      </Suspense>
    );
  }

  // Show completed screen for summary
  if (showCompletedScreen && completedRide) {
    return (
      <Suspense fallback={<ScreenSkeleton />}>
        <RideCompletedScreen
          ride={{
            id: completedRide.id,
            pickup_address: completedRide.pickup_address,
            dropoff_address: completedRide.dropoff_address,
            final_fare: completedRide.final_fare,
            estimated_fare: completedRide.estimated_fare,
            distance_km: completedRide.distance_km,
            duration_minutes: completedRide.duration_minutes,
            driver_id: completedRide.driver_id,
          }}
          driverName={"السائق"}
          onClose={() => {
            console.log(
              "🎉 [RideCompleted] onClose -> clearing completed ride and resetting booking/map",
            );
            setShowRatingScreen(false);
            setShowCompletedScreen(false);
            handleRideCompletion();
            resetBooking();
          }}
        />
      </Suspense>
    );
  }

  // Show waiting screen if ride is pending or accepted
  if (showWaitingScreen && activeRide) {
    return (
      <Suspense fallback={<ScreenSkeleton />}>
        <RideWaitingScreen
          rideId={activeRide.id}
          pickupAddress={
            activeRide.pickup_address ||
            pickupLocation?.address ||
            "موقعي الحالي"
          }
          dropoffAddress={
            activeRide.dropoff_address || dropoffLocation?.address || ""
          }
          estimatedFare={
            activeRide.estimated_fare || fareBreakdown?.total_fare || 0
          }
          onCancel={resetBooking}
          onDriverFound={() => {
            setShowWaitingScreen(false);
            setShowLiveTracker(true);
          }}
        />
      </Suspense>
    );
  }

  // Show live tracker if ride is in progress
  if (showLiveTracker && activeRide) {
    return (
      <Suspense fallback={<ScreenSkeleton />}>
        <LiveRideTracker
          ride={activeRide}
          onClose={resetBooking}
          onRideUpdate={(updatedRide) => {
            if (
              updatedRide.status === "completed" ||
              updatedRide.status === "cancelled"
            ) {
              resetBooking();
            }
          }}
        />
      </Suspense>
    );
  }

  // Booking confirmation screen
  if (isBookingMode && pickupLocation && dropoffLocation) {
    return (
      <motion.div
        initial={{
          opacity: 0,
        }}
        animate={{
          opacity: 1,
        }}
        className="h-screen bg-background flex flex-col overflow-hidden"
      >
        {/* Offline/Online status indicator */}
        {!isOnline && (
          <div className="absolute top-0 left-0 right-0 z-50 bg-destructive/90 backdrop-blur-md px-4 py-2 text-center text-sm font-medium text-destructive-foreground flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>أنت بدون إنترنت - بعض الميزات قد لا تعمل</span>
          </div>
        )}

        {/* Progress indicator - Top */}
        <div
          className={`absolute left-0 right-0 z-50 px-4 pointer-events-none ${!isOnline ? "pt-14" : "pt-2"}`}
        >
          <div className="flex gap-2">
            <div className="flex-1 h-1 rounded-full bg-primary" />
            <div className="flex-1 h-1 rounded-full bg-accent" />
            <div className="flex-1 h-1 rounded-full bg-primary animate-pulse" />
          </div>
        </div>

        {/* Header - Transparent over map */}
        <div
          className={`absolute left-0 right-0 z-40 px-4 pointer-events-auto ${!isOnline ? "top-20" : "top-4"}`}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setMenuOpen(true)}
              className="w-11 h-11 flex items-center justify-center rounded-md bg-card/90 backdrop-blur-md shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 active:scale-95 flex-shrink-0"
              aria-label="القائمة"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Logo and Route info - Combined */}
            <div className="flex-1 flex items-center justify-center gap-2">
              {/* Logo removed */}

              <motion.div
                initial={{
                  y: -20,
                  opacity: 0,
                }}
                animate={{
                  y: 0,
                  opacity: 1,
                }}
                transition={{
                  delay: 0.2,
                }}
                className="bg-card/70 backdrop-blur-xl rounded-md px-3 py-2 flex items-center gap-3 shadow-lg border border-white/10"
              >
                <div className="flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-primary" />
                  <span className="text-sm font-bold">
                    {routeDistance ? `${routeDistance.toFixed(1)} كم` : "---"}
                  </span>
                </div>
                <div className="w-px h-4 bg-border/30" />
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" style={{ color: "#2A6CD5" }} />
                  <span className="text-sm font-bold">
                    {routeDuration ? `${Math.round(routeDuration)} د` : "---"}
                  </span>
                </div>
              </motion.div>
            </div>

            {/* Right-side header spacer (icons moved into side menu) */}
            <div className="w-11" />
          </div>
        </div>

        {/* Map - Top Half */}
        <div className="h-[45%] relative bg-gray-200">
          <div
            ref={bookingMapContainer}
            className="absolute inset-0 bg-gray-100"
          />

          {/* Floating manual geolocate button for booking map (raised) */}
          <div className="absolute top-14 sm:top-4 left-4 z-50 safe-area-top pointer-events-auto">
            <button
              onClick={manualGeolocateBooking}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-background/90 text-primary shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 active:scale-95 border border-primary/20"
              title="تحديد موقعي"
              aria-label="تحديد موقعي"
            >
              <Navigation className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Details - Bottom Half with rounded top */}
        <div className="h-[55%] bg-background rounded-t-3xl -mt-4 relative z-10 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.15)]">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-12 h-1.5 rounded-full bg-muted-foreground/25" />
          </div>

          {/* Scrollable content */}
          <div
            className={`flex-1 overflow-y-auto px-4 space-y-3 ${bottomNavEnabled ? "pb-40" : "pb-6"}`}
          >
            {/* Route summary - Modern vertical timeline */}
            <motion.div
              initial={{
                y: 20,
                opacity: 0,
              }}
              animate={{
                y: 0,
                opacity: 1,
              }}
              className="bg-card rounded-2xl p-4 border border-border/30 shadow-sm"
            >
              <div className="flex gap-3">
                {/* Vertical connecting line */}
                <div className="flex flex-col items-center gap-0">
                  <div className="w-3 h-3 rounded-full bg-primary ring-4 ring-primary/20" />
                  <div
                    className="w-0.5 flex-1 min-h-[32px]"
                    style={{
                      background:
                        "linear-gradient(to bottom, hsl(var(--primary)), hsl(var(--muted)), #2A6CD5)",
                    }}
                  />
                  <div
                    className="w-3 h-3 rounded-full ring-4"
                    style={
                      {
                        backgroundColor: "#2A6CD5",
                        "--tw-ring-color": "rgba(42, 108, 213, 0.2)",
                      } as any
                    }
                  />
                </div>

                {/* Locations */}
                <div className="flex-1 space-y-4">
                  {/* Pickup */}
                  <div className="min-h-[32px]">
                    <p className="text-[10px] uppercase tracking-wider text-primary font-bold mb-0.5">
                      موقع الانطلاق
                    </p>
                    <p className="text-sm font-semibold text-foreground line-clamp-1">
                      {buildDescriptiveAddress(pickupLocation.address || "")}
                    </p>
                  </div>

                  {/* Dropoff */}
                  <div>
                    <p
                      className="text-[10px] uppercase tracking-wider font-bold mb-0.5"
                      style={{ color: "#2A6CD5" }}
                    >
                      الوجهة
                    </p>
                    <p className="text-sm font-semibold text-foreground line-clamp-1">
                      {buildDescriptiveAddress(dropoffLocation.address || "")}
                    </p>
                  </div>
                </div>

                {/* Swap button */}
                <button
                  onClick={() => {
                    const temp = pickupLocation;
                    setPickupLocation(dropoffLocation);
                    setDropoffLocation(temp);
                    toast({
                      title: "تم عكس الاتجاه ✅",
                      description: "تم تبديل موقع الانطلاق مع الوجهة",
                      duration: 2000,
                    });
                  }}
                  className="w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-all duration-200 active:scale-95 shrink-0"
                  aria-label="عكس الاتجاه"
                >
                  <ArrowUpDown className="w-5 h-5 text-primary" />
                </button>
              </div>
            </motion.div>

            {/* Trip Info - Distance & Time */}
            {fareBreakdown && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-2 gap-2"
              >
                {/* Distance */}
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-3 border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-blue-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                        />
                      </svg>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                      المسافة
                    </span>
                  </div>
                  <p className="text-lg font-bold text-blue-600">
                    {fareBreakdown.distance_km.toFixed(1)}{" "}
                    <span className="text-xs font-medium">كم</span>
                  </p>
                </div>

                {/* Estimated Time */}
                <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl p-3 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-purple-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                      الوقت
                    </span>
                  </div>
                  <p className="text-lg font-bold text-purple-600">
                    {Math.ceil(fareBreakdown.distance_km * 2.5)}{" "}
                    <span className="text-xs font-medium">دقيقة</span>
                  </p>
                </div>
              </motion.div>
            )}

            {/* Vehicle selector */}
            <motion.div
              initial={{
                y: 20,
                opacity: 0,
              }}
              animate={{
                y: 0,
                opacity: 1,
              }}
              transition={{
                delay: 0.15,
              }}
            >
              <CompactVehicleSelector
                selectedVehicle={selectedVehicle}
                onSelect={setSelectedVehicle}
                availableDrivers={availableDriversByType}
                baseFare={fareBreakdown?.total_fare}
              />
            </motion.div>

            {/* Fare & Payment - Combined Card */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-primary/5 via-primary/8 to-primary/10 rounded-2xl p-4 border border-primary/20 shadow-lg"
            >
              {/* Fare Display */}
              {fareBreakdown && (
                <div className="mb-3 pb-3 border-b border-primary/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                          الأجرة المتوقعة
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          {fareBreakdown.region_name}
                        </p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-2xl font-bold text-primary">
                        {roundFare(fareBreakdown.total_fare).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        دينار عراقي
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Method Selector */}
              <button
                onClick={() => setPaymentSheetOpen(true)}
                className="w-full bg-card/50 rounded-xl px-4 py-3 border border-border/40 hover:border-primary/40 hover:bg-card/80 transition-all duration-200 active:scale-[0.98] flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg">
                    {paymentMethod === "cash"
                      ? "💵"
                      : paymentMethod === "wallet"
                        ? "👛"
                        : paymentMethod === "card"
                          ? "💳"
                          : paymentMethod === "zain_cash"
                            ? "📱"
                            : paymentMethod === "super_key"
                              ? "🔑"
                              : paymentMethod === "nas_wallet"
                                ? "💼"
                                : "💵"}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                      طريقة الدفع
                    </p>
                    <p className="font-bold text-sm">
                      {paymentMethod === "cash"
                        ? "نقداً"
                        : paymentMethod === "wallet"
                          ? "المحفظة"
                          : paymentMethod === "card"
                            ? "البطاقة"
                            : paymentMethod === "zain_cash"
                              ? "زين كاش"
                              : paymentMethod === "super_key"
                                ? "سوبر كي"
                                : paymentMethod === "nas_wallet"
                                  ? "ناس ولت"
                                  : "نقداً"}
                    </p>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            </motion.div>

            {/* Promo Code */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="px-1"
            >
              <PromoCodeSheet
                userId={userId}
                onApplyPromo={(promo) => {
                  console.log("✅ Promo applied:", promo);
                  toast({
                    title: "🎉 تم تطبيق الخصم",
                    description: promo.message,
                  });
                }}
              />
            </motion.div>

            {/* Schedule option - Enhanced */}
            <motion.div
              initial={{
                y: 20,
                opacity: 0,
              }}
              animate={{
                y: 0,
                opacity: 1,
              }}
              transition={{
                delay: 0.3,
              }}
              className="px-1"
            >
              <ScheduleRideDialog
                ref={scheduleDialogRef}
                pickup={pickupLocation}
                dropoff={dropoffLocation}
                vehicleType={selectedVehicle}
                paymentMethod={paymentMethod}
                estimatedFare={fareBreakdown?.total_fare || null}
                onScheduled={() => {
                  toast({
                    title: "تم جدولة الرحلة ✅",
                    description: "سيتم تذكيرك قبل الموعد",
                  });
                  resetBooking();
                }}
              />
            </motion.div>
          </div>

          {/* Book button - Conditional positioning */}
          {!bottomNavEnabled && (
            <div className="px-4 pb-6">
              <div className="max-w-lg mx-auto">
                <Button
                  onClick={handleBookRide}
                  disabled={fareLoading}
                  className="w-full h-12 sm:h-14 text-base sm:text-lg font-bold bg-gradient-to-r from-primary via-primary to-primary/90 rounded-xl shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 transition-all duration-300 active:scale-[0.98] text-primary-foreground"
                >
                  <span className="flex items-center gap-3 justify-center">
                    <Navigation className="w-5 h-5" />
                    <span>احجز الآن</span>
                    <span className="bg-black/20 px-2.5 py-0.5 rounded-lg text-sm">
                      {fareBreakdown?.total_fare
                        ? roundFare(fareBreakdown.total_fare).toLocaleString()
                        : "---"}{" "}
                      د.ع
                    </span>
                  </span>
                </Button>
              </div>
            </div>
          )}

          {/* Book button - Fixed at bottom when nav is visible */}
          {bottomNavEnabled && (
            <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/98 backdrop-blur-md border-t border-border/20 z-40">
              <div className="max-w-lg mx-auto">
                <Button
                  onClick={handleBookRide}
                  disabled={fareLoading}
                  className="w-full h-12 sm:h-14 text-base sm:text-lg font-bold bg-gradient-to-r from-primary via-primary to-primary/90 rounded-xl shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 transition-all duration-300 active:scale-[0.98] text-primary-foreground"
                >
                  <span className="flex items-center gap-3 justify-center">
                    <Navigation className="w-5 h-5" />
                    <span>احجز الآن</span>
                    <span className="bg-black/20 px-2.5 py-0.5 rounded-lg text-sm">
                      {fareBreakdown?.total_fare
                        ? roundFare(fareBreakdown.total_fare).toLocaleString()
                        : "---"}{" "}
                      د.ع
                    </span>
                  </span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Payment Method Sheet */}
        <PaymentMethodSheet
          open={paymentSheetOpen}
          onOpenChange={setPaymentSheetOpen}
          selectedMethod={paymentMethod}
          onSelect={setPaymentMethod}
        />

        {/* Side Menu */}
        <RiderSideMenu
          user={user}
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          onLogout={async () => {
            await supabase.auth.signOut();
            if (navigate) {
              navigate("/auth");
            }
          }}
        />
      </motion.div>
    );
  }

  // Location picker screen
  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Progress indicator - Top of screen */}
      <motion.div
        initial={{
          y: -10,
          opacity: 0,
        }}
        animate={{
          y: 0,
          opacity: 1,
        }}
        className="absolute top-0 left-0 right-0 z-40 px-4 pt-2 pointer-events-none"
      >
        <div className="flex gap-2">
          <div
            className={`flex-1 h-1 rounded-full transition-colors ${isPickup || pickupLocation ? "bg-primary" : "bg-muted/30"}`}
          />
          <div
            className={`flex-1 h-1 rounded-full transition-colors ${isDropoff || dropoffLocation ? "bg-accent" : "bg-muted/30"}`}
          />
        </div>
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{
          y: -20,
          opacity: 0,
        }}
        animate={{
          y: 0,
          opacity: 1,
        }}
        className="absolute top-4 left-0 right-0 z-30 pointer-events-auto"
      >
        <div className="flex items-center justify-between p-4">
          {/* زر القائمة */}
          <button
            onClick={() => setMenuOpen(true)}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-card/95 backdrop-blur-xl shadow-lg hover:bg-card hover:scale-105 transition-all duration-200 active:scale-95 border border-border/30"
            aria-label="القائمة الرئيسية"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* الشعار في المنتصف */}
          {/* Logo removed */}

          {/* Notifications & Status Icons moved to side menu */}
          <div className="w-10" />

          {/* زر الرجوع - مُخفي (عدم عرض الزر عند اختيار الوجهة) */}
          <div className="w-11" />
        </div>
      </motion.div>

      {/* Map Container - touch-action: pan-x pan-y to enable map dragging */}
      <div
        className="flex-1 relative w-full h-full overflow-hidden"
        style={{ touchAction: "pan-x pan-y pinch-zoom" }}
      >
        {/* Memoized Map Container - isolated from ride state re-renders */}
        <MapContainer
          mapRef={mapContainer}
          isLoading={!mapToken || isLoading}
          mapToken={mapToken}
        />

        {/* Favorite Markers Layer */}
        {map.current && !isPickup && (
          <FavoriteMarkersLayer
            map={map.current}
            onMarkerClick={(id, lat, lng, address) => {
              if (map.current) {
                map.current.panTo({ lat, lng });
                map.current.setZoom(16);
              }
              setManualAddress(address);
              checkServiceArea(lat, lng);
            }}
          />
        )}

        {/* Floating manual geolocate button for main map */}
        <div className="absolute top-14 sm:top-4 left-4 z-50 safe-area-top pointer-events-auto">
          <button
            onClick={manualGeolocateMain}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-background/90 text-primary shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 active:scale-95 border border-primary/20"
            title="تحديد موقعي"
            aria-label="تحديد موقعي"
          >
            <Navigation className="w-4 h-4" />
          </button>
        </div>

        {/* Drag instruction - Top-left corner - Disappears after first drag */}
        <AnimatePresence>
          {!isDragging && centerAddress && !hasStartedDragging && (
            <motion.div
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="absolute left-4 top-4 z-30 pointer-events-none"
            >
              <div className="bg-card/95 backdrop-blur-lg px-3 py-2 rounded-full shadow-lg border border-border/50 whitespace-nowrap">
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
                  <span className="text-base">👉</span>
                  <span>اسحب الخريطة لتغيير الموقع</span>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Location pin - دبوس CSS بدون صور خارجية - pointer-events-none للسماح بتحريك الخريطة */}
        <div
          className="pointer-events-none"
          style={{
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -100%)",
            zIndex: 9999, // عالي ليظهر فوق كل شيء
          }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center"
          >
            <motion.div
              animate={{ y: isDragging ? -12 : 0 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="relative"
            >
              {/* Pin Head */}
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center border-4 border-white ${
                  isPickup ? "bg-green-500" : "bg-sky-500"
                }`}
                style={{
                  boxShadow: isPickup
                    ? "0 0 20px rgba(34, 197, 94, 0.6), 0 4px 20px rgba(0,0,0,0.3)"
                    : "0 0 20px rgba(14, 165, 233, 0.6), 0 4px 20px rgba(0,0,0,0.3)",
                }}
              >
                {isPickup ? (
                  <Navigation className="w-6 h-6 text-white" />
                ) : (
                  <MapPin className="w-6 h-6 text-white" />
                )}
              </div>

              {/* Pin Needle */}
              <div
                className={`w-0 h-0 mx-auto -mt-1 ${isPickup ? "" : ""}`}
                style={{
                  borderLeft: "10px solid transparent",
                  borderRight: "10px solid transparent",
                  borderTop: isPickup
                    ? "16px solid #22c55e"
                    : "16px solid #0ea5e9",
                  filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.3))",
                }}
              />

              {/* Shadow dot */}
              <motion.div
                animate={{
                  scale: isDragging ? 0.5 : 1,
                  opacity: isDragging ? 0.2 : 0.4,
                }}
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-2 bg-black/50 rounded-full blur-sm"
              />
            </motion.div>
          </motion.div>
        </div>

        {/* Loading overlay with static map placeholder */}
        {isLoading && (
          <StaticMapPlaceholder
            lat={userLocation?.lat || lastLocation?.lat}
            lng={userLocation?.lng || lastLocation?.lng}
            zoom={14}
            message="جاري تحميل الخريطة..."
          />
        )}

        {/* Network status bar */}
        <NetworkStatusBar />
      </div>

      {/* 🟢 Bottom panel - Glassmorphism متكاملة مع شريط التنقل + safe-area-inset */}
      <motion.div
        ref={bottomPanelRef}
        initial={{
          y: 100,
        }}
        animate={{
          y: 0,
        }}
        className={`bg-card/98 backdrop-blur-xl border-t border-border/30 shadow-[0_-10px_40px_rgba(0,0,0,0.15)] z-20 rounded-t-3xl transition-all duration-300 pointer-events-auto ${bottomNavEnabled ? "fixed left-0 right-0" : "fixed bottom-0 left-0 right-0"}`}
        style={{
          bottom: bottomNavEnabled
            ? "calc(env(safe-area-inset-bottom) + 65px)"
            : "env(safe-area-inset-bottom, 0px)",
          maxHeight: bottomNavEnabled
            ? "calc(100vh - 200px - env(safe-area-inset-bottom))"
            : "calc(100vh - 60px - env(safe-area-inset-bottom))",
          overflowY: "auto",
          WebkitBackdropFilter: "blur(12px)",
          contain: "layout style paint",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 pointer-events-auto">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/25" />
        </div>
        <div
          className={`px-4 pt-1 max-w-lg mx-auto transition-all duration-300 ${bottomNavEnabled ? "pb-12" : "pb-6"}`}
        >
          {/* Service area warning */}
          {localServiceAreaStatus && !localServiceAreaStatus.in_service && (
            <div className="flex items-center gap-3 p-3 mb-3 rounded-md bg-gradient-to-r from-destructive/10 to-destructive/5 border border-destructive/30">
              <div className="w-8 h-8 rounded-md bg-destructive/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-destructive text-sm mb-1">
                  ⚠️ خارج منطقة الخدمة
                </p>
                {localServiceAreaStatus.nearest_region && (
                  <p className="text-muted-foreground text-xs">
                    أقرب منطقة: {localServiceAreaStatus.nearest_region.name_ar}{" "}
                    ({localServiceAreaStatus.nearest_region.distance_km} كم)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Location Input Field with Heart */}
          <LocationInputField
            label={isPickup ? "موقع الانطلاق" : "الوجهة"}
            value={buildDescriptiveAddress(centerAddress || "") || ""}
            address={buildDescriptiveAddress(centerAddress || "") || ""}
            lat={centerLat}
            lng={centerLng}
            placeholder={isPickup ? "اختر موقع الانطلاق" : "اختر الوجهة"}
            onClick={() => {}} // الخريطة تتحكم بهذا
            onClear={() => {
              setCenterAddress(null);
              setCenterLat(null);
              setCenterLng(null);
              setManualAddress(null);
            }}
            isPickup={isPickup}
            className="mb-3 pointer-events-auto"
          />

          {/* Dynamic search - Google Places */}
          <div className="mb-3 relative pointer-events-auto">
            <DynamicSearchHeader
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onClear={clearSearch}
              isSearching={isSearching}
              placeholder={
                isPickup ? "ابحث عن موقع الانطلاق..." : "ابحث عن الوجهة..."
              }
            />

            {searchQuery && (
              <DynamicSearchResults
                query={searchQuery}
                results={predictions}
                isSearching={isSearching}
                isLoadingDetails={isLoadingDetails}
                onSelect={async (placeId) => {
                  const placeDetails = await getPlaceDetails(placeId);
                  if (!placeDetails) return;

                  const geofenceCheck = await checkDestinationGeofence(
                    placeDetails.lat,
                    placeDetails.lng,
                    mapToken,
                  );
                  if (!geofenceCheck.allowed) {
                    setGeofenceResult(geofenceCheck);
                    setShowGeofenceAlert(true);
                    return;
                  }

                  if (map.current) {
                    map.current.panTo({
                      lat: placeDetails.lat,
                      lng: placeDetails.lng,
                    });
                    map.current.setZoom(16);
                  }

                  // ✨ بناء عنوان ذكي = اسم المكان + المدينة (بدون Plus Code)
                  let descriptiveAddress =
                    placeDetails.name || placeDetails.address;

                  // محاولة استخراج المدينة من formatted_address
                  const addressParts = placeDetails.address
                    .split(/[،,]/)
                    .map((p) => p.trim())
                    .filter((p) => p.length > 0);

                  // حذف Plus Code إذا وجد
                  const plusCodeRegex = /^[A-Z0-9]{4}\+[A-Z0-9]{2,}/;
                  const cleanParts = addressParts.filter(
                    (p) => !plusCodeRegex.test(p),
                  );

                  // استخراج المدينة (آخر جزء عادةً، بدون "محافظة" أو "العراق")
                  const city = cleanParts
                    .reverse()
                    .find((p) => !p.includes("محافظة") && p !== "العراق");

                  // بناء العنوان النهائي
                  if (placeDetails.name && city && placeDetails.name !== city) {
                    descriptiveAddress = `${placeDetails.name}، ${city}`;
                  } else if (placeDetails.name) {
                    descriptiveAddress = placeDetails.name;
                  } else {
                    descriptiveAddress =
                      cleanParts.slice(0, 2).join("، ") || placeDetails.address;
                  }

                  console.log(
                    "✅ Built descriptive address from search:",
                    descriptiveAddress,
                  );

                  // ✨ استخدم setManualAddress بدلاً من setCenterAddress
                  setManualAddress(descriptiveAddress);

                  checkServiceArea(placeDetails.lat, placeDetails.lng);
                  setSearchQuery("");
                }}
                maxResults={6}
              />
            )}
          </div>

          {isDropoff && smartSuggestions.length > 0 && (
            <div className="mb-4 rounded-xl border border-primary/10 bg-primary/5 p-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    وجهتك الذكية
                  </p>
                  <p className="text-xs text-muted-foreground">
                    اقتراحات سريعة بناءً على مفضلاتك
                  </p>
                </div>
              </div>
              <div className="grid gap-2">
                {smartSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    onClick={() => handleSmartSuggestionSelect(suggestion)}
                    className="w-full text-right p-3 rounded-lg border border-border/40 bg-card/80 hover:bg-card transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {suggestion.label}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {suggestion.address}
                        </p>
                      </div>
                      <span className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary">
                        {suggestion.reason}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isDropoff && (
            <div className="mb-4 rounded-xl border border-border/40 bg-card/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      توقفات إضافية
                    </p>
                    <p className="text-xs text-muted-foreground">
                      اختياري (حتى 3 توقفات)
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3"
                  onClick={handleAddStop}
                  disabled={!centerLat || !centerLng || !centerAddress}
                >
                  <Plus className="w-4 h-4 ml-1" />
                  إضافة توقف
                </Button>
              </div>

              {routeStops.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  حرّك الخريطة إلى موقع التوقف ثم اضغط "إضافة توقف"
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {routeStops.map((stop, index) => (
                    <div
                      key={`${stop.lat}-${stop.lng}-${index}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/30 bg-background/80 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          توقف {index + 1}
                        </p>
                        <p className="text-sm font-semibold text-foreground truncate">
                          {stop.address}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveStop(index)}
                        className="text-xs text-destructive hover:text-destructive/80"
                      >
                        إزالة
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 🟢 المفضلة في جميع المراحل - الانطلاق والوجهة */}
          <QuickAccessChips
            onSelectLocation={(lat, lng, address) => {
              if (map.current) {
                map.current.panTo({ lat, lng });
                map.current.setZoom(16);
              }
              setManualAddress(address);
              checkServiceArea(lat, lng);
            }}
            className="mb-4 pointer-events-auto"
          />

          {/* Confirm button - Enhanced with semantic colors */}
          <Button
            onClick={handleConfirm}
            disabled={!centerAddress || isCheckingService || isConfirming}
            className={`w-full h-12 sm:h-14 text-sm sm:text-base font-bold rounded-xl shadow-lg transition-all duration-200 active:scale-[0.98] sticky bottom-4 ${
              centerAddress
                ? "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-primary/25 text-primary-foreground"
                : "bg-muted/50 text-muted-foreground cursor-not-allowed"
            }`}
          >
            {isCheckingService || isConfirming ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>
                  {isConfirming ? "جاري التأكيد..." : "جاري التحقق..."}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5" />
                <span>تأكيد {isPickup ? "موقع الانطلاق" : "الوجهة"}</span>
                {isPickup ? (
                  <Target className="w-4 h-4" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
              </div>
            )}
          </Button>
        </div>
      </motion.div>

      {/* Side Menu */}
      <RiderSideMenu
        user={user}
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onLogout={async () => {
          await supabase.auth.signOut();
          if (navigate) {
            navigate("/auth");
          }
        }}
      />

      {/* Geofencing Alert Dialog */}
      <AnimatePresence>
        {showGeofenceAlert && geofenceResult && (
          <Dialog open={showGeofenceAlert} onOpenChange={setShowGeofenceAlert}>
            <DialogContent className="sm:max-w-md">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              >
                <DialogHeader>
                  <DialogTitle className="text-center text-xl">
                    {geofenceResult.isIran
                      ? "🙏"
                      : geofenceResult.isIsland
                        ? "✈️🚢"
                        : geofenceResult.isFar
                          ? "✈️"
                          : "🚗✨"}
                  </DialogTitle>
                  <DialogDescription className="text-center text-base leading-relaxed pt-2">
                    {geofenceResult.message}
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-6">
                  <Button
                    onClick={() => {
                      setShowGeofenceAlert(false);
                      setGeofenceResult(null);
                    }}
                    className="w-full h-12 text-base font-bold rounded-xl"
                  >
                    فهمت 👌
                  </Button>
                </div>
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
};

const GoPage: React.FC<{ scheduleMode?: boolean }> = ({
  scheduleMode = false,
}) => {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-full bg-background flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">جاري التحميل...</p>
          </div>
        </div>
      }
    >
      <GoPageContent scheduleMode={scheduleMode} />
    </Suspense>
  );
};

export default GoPage;
