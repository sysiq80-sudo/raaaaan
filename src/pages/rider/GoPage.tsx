import React, { useEffect, useState, useCallback, lazy, Suspense, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import SplashScreen from "@/components/common/SplashScreen";
import { Navigation, Loader2, MapPin, AlertTriangle, AlertCircle, Menu, Rocket, Bookmark, ArrowRight } from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import useRiderStore from "@/stores/riderStore";
import { useFareCalculation } from "@/hooks/useFareCalculation";
import { useOptimizedNearbyDrivers } from "@/hooks/useOptimizedNearbyDrivers";

import RiderSideMenu from "@/components/rider/RiderSideMenu";
import NetworkStatusBar from "@/components/common/NetworkStatusBar";
import StaticMapPlaceholder from "@/components/common/StaticMapPlaceholder";
import { motion, AnimatePresence } from "framer-motion";
import { roundFare } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { showErrorToast } from "@/lib/toastHelpers";

import { checkDestinationGeofence, type GeofenceResult } from "@/lib/geofencing";
import { getGeocoder } from "@/lib/googleMapService";
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
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { useRideTracking } from "@/hooks/useRideTracking";
import { useLastLocation } from "@/hooks/useLastLocation";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { DynamicSearchHeader, DynamicSearchResults, SEARCH_CATEGORIES, type CategoryFilter } from "@/components/rider/DynamicSearchResults";
import { LocationPermissionPrompt } from "@/components/rider/LocationPermissionPrompt";
import { useVoiceSearch } from "@/hooks/useVoiceSearch";
import { useUnifiedSearch } from "@/hooks/useUnifiedSearch";

import FavoriteMarkersLayer from "@/components/rider/FavoriteMarkersLayer";
import { useFavoritesStore } from "@/stores/useFavoritesStore";
import SaveLocationModal from "@/components/rider/SaveLocationModal";
import BookingConfirmationView from "@/components/rider/BookingConfirmationView";

// Performance & Enhancement hooks
import { usePerformanceMonitoring, useOperationTiming } from "@/hooks/usePerformanceMonitoring";
import { useLastRide, useRiderPreferences } from "@/hooks/useLocalStorage";
import { useOfflineMode } from "@/hooks/useOfflineMode";

// Lazy load heavy components
const RideWaitingScreen = lazy(() => import("@/components/rider/RideWaitingScreen"));
const LiveRideTracker = lazy(() => import("@/components/rider/LiveRideTracker"));
const RideCompletedScreen = lazy(() => import("@/components/rider/RideCompletedScreen"));
// ✅ Removed: OnboardingFlow is now handled by AppRoutes routing

// Loading skeleton — uses premium SplashScreen
const ScreenSkeleton = () => <SplashScreen />;
interface LocationType {
  lat: number;
  lng: number;
  address: string;
}
type VehicleType = "economy" | "comfort" | "premium" | "women_only";
// أنواع الدفع المبسطة - 3 خيارات فقط
import type { PaymentMethod as PaymentMethodType } from "@/types/savedCards";
import { mapPaymentToDb } from "@/types/savedCards";

// Wrapper component to ensure GoPage is rendered safely within Router context
const GoPageContent: React.FC<{ scheduleMode?: boolean }> = ({ scheduleMode = false }) => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();

  const {
    saveLastRide
  } = useLastRide();
  const {
    lastLocation,
    saveLocation
  } = useLastLocation();
  // ✅ Removed: hasSeenOnboarding - handled by AppRoutes routing
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [mapReloadKey, setMapReloadKey] = useState(0);

  // Offline support
  const {
    isOnline
  } = useOfflineMode();

  // ✅ دالة متقدمة لبناء عنوان وصفي بمنطق أولويات
  const buildDescriptiveAddress = useCallback((address: string): string => {
    if (!address || !address.trim()) return "";
    if (address.includes("جاري تحديد العنوان")) return "";
    
    const parts = address
      .split(/[،,]/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
    if (parts.length === 0) return "";
    
    // فحص Plus Code وحذفه إذا وُجد
    const plusCodeRegex = /^[A-Z0-9]{4}\+[A-Z0-9]{2,}/;
    const cleanParts = parts.filter(p => !plusCodeRegex.test(p));
    if (cleanParts.length === 0) return "";
    
    const isGovernorate = (value: string) => value.includes("محافظة");
    const isCountry = (value: string) => value === "العراق";
    
    const filteredParts = cleanParts.filter(p => !isCountry(p) && !isGovernorate(p));
    if (filteredParts.length === 0) return cleanParts[0] || "";
    
    // اجعل المدينة في نهاية العنوان قدر الإمكان
    const cityCandidate = [...filteredParts].reverse().find(p => !isCountry(p) && !isGovernorate(p));
    const headParts = filteredParts.filter(p => p !== cityCandidate);
    
    const ordered = cityCandidate
      ? [...headParts, cityCandidate]
      : filteredParts;
    
    // أولوية العرض: معلم > شارع + حي > مدينة (نهاية)
    if (ordered.length >= 3) return ordered.slice(0, 3).join('، ');
    if (ordered.length === 2) return ordered.join('، ');
    return ordered[0];
  }, []);

  // Core data hooks
  const {
    userId,
    user,
    mapToken,
    userLocation,
    menuOpen,
    setMenuOpen
  } = useRiderData();

  // Get bottom nav state from store
  const bottomNavEnabled = useRiderStore((state) => state.bottomNavEnabled);

  // Core state - must be defined before useLocationPicker
  const [currentMode, setCurrentMode] = useState<"pickup" | "dropoff" | "booking">("pickup");

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
    mapError, // ✨ خطأ تحميل الخريطة
    setCenterAddress,
    setManualAddress, // ✨ NEW
    checkServiceArea,
    reverseGeocode,
    setIsLoading,
  } = useLocationPicker(mapToken, userLocation, mapReloadKey, currentMode);

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
    cleanup: cleanupBooking
  } = useBookingFlow();

  // Search and places
  const {
    searchQuery,
    setSearchQuery,
    predictions,
    isSearching,
    isLoadingDetails,
    isOffline: searchOffline,
    getPlaceDetails,
    clearSearch
  } = useSearchAndPlaces(userLocation);

  // Voice search
  const { isSupported: voiceSupported, voiceState, transcript: voiceTranscript, toggleListening } = useVoiceSearch({
    onResult: (text) => {
      setLocationSearchQuery(text);
      setSearchQuery(text);
      setIsLocationFocused(true);
    },
  });

  // Unified search (merged sources)
  const unified = useUnifiedSearch(userLocation, userId || undefined);

  // Active search category filter
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Recent searches
  const {
    recentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearAllSearches
  } = useRecentSearches();

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
    setIgnorePolling,
  } = useRideTracking(userId);

  // Local state
  const setStoreUserLocation = useRiderStore((s) => s.setUserLocation);
  const refineWatchIdRef = useRef<number | null>(null);
  const getBestPosition = useCallback((onRefine?: (pos: GeolocationPosition) => void) => {
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
          if (wp.coords.accuracy <= 30 || Date.now() - startedAt > stopRefineAfterMs) {
            navigator.geolocation.clearWatch(watchId);
            refineWatchIdRef.current = null;
          }
        },
        () => {
          navigator.geolocation.clearWatch(watchId);
          refineWatchIdRef.current = null;
        },
        refineOptions
      );
      refineWatchIdRef.current = watchId;

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
            quickOptions
          );
        },
        refineOptions
      );
    });
  }, []);

  // Cleanup watchPosition on unmount
  useEffect(() => {
    return () => {
      if (refineWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(refineWatchIdRef.current);
        refineWatchIdRef.current = null;
      }
    };
  }, []);

  const getDistanceMeters = useCallback((a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const R = 6371000;
    const dLat = (b.lat - a.lat) * (Math.PI / 180);
    const dLng = (b.lng - a.lng) * (Math.PI / 180);
    const lat1 = a.lat * (Math.PI / 180);
    const lat2 = b.lat * (Math.PI / 180);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const aVal = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
    return R * c;
  }, []);

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
    [getDistanceMeters, userLocation]
  );

  // دالة موحدة لتحديد الموقع - تعمل مع أي خريطة
  const handleGeolocate = useCallback((targetMap: React.MutableRefObject<google.maps.Map | null>, updateStore = false) => {
    if (updateStore) setIsLoading(true);
    getBestPosition((refined) => {
      if (!shouldAcceptLocation(refined)) return;
      const refinedLoc = { lat: refined.coords.latitude, lng: refined.coords.longitude };
      if (updateStore) setStoreUserLocation(refinedLoc as any);
      if (targetMap.current) {
        targetMap.current.panTo(refinedLoc);
      }
      if (updateStore) reverseGeocode(refinedLoc.lat, refinedLoc.lng);
    })
      .then((pos) => {
        if (!shouldAcceptLocation(pos)) {
          if (updateStore && userLocation && targetMap.current) {
            targetMap.current.panTo({ lat: userLocation.lat, lng: userLocation.lng });
            targetMap.current.setZoom(16);
          }
          toast({ title: "دقة الموقع منخفضة", description: "حاول الاقتراب من نافذة أو تفعيل GPS", variant: "destructive" });
          return;
        }
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (updateStore) setStoreUserLocation(loc as any);

        if (targetMap.current) {
          targetMap.current.panTo(loc);
          targetMap.current.setZoom(updateStore ? 17 : 16);
        }

        if (updateStore) reverseGeocode(loc.lat, loc.lng);
      })
      .catch((err) => {
        if (updateStore && userLocation) {
          if (targetMap.current) {
            targetMap.current.panTo({ lat: userLocation.lat, lng: userLocation.lng });
            targetMap.current.setZoom(16);
          }
          reverseGeocode(userLocation.lat, userLocation.lng);
        } else {
          const errorMsg = (err?.code === 1 || err?.message === "NO_GEOLOCATION")
            ? "يرجى منح صلاحية الوصول للموقع"
            : "فشل تحديد الموقع";
          toast({ title: errorMsg, variant: "destructive" });
        }
      })
      .finally(() => { if (updateStore) setIsLoading(false); });
  }, [getBestPosition, reverseGeocode, setIsLoading, setStoreUserLocation, shouldAcceptLocation, toast, userLocation]);

  // panToUserLocation: يسحب الخريطة للموقع الفعلي فقط — بدون setIsLoading أو قراءة store
  const smoothZoomTo = useCallback((targetMap: google.maps.Map, targetZoom: number) => {
    const currentZoom = targetMap.getZoom() ?? 14;
    if (Math.abs(currentZoom - targetZoom) < 1) return;
    const step = currentZoom < targetZoom ? 1 : -1;
    const tick = () => {
      const z = targetMap.getZoom() ?? currentZoom;
      if ((step > 0 && z >= targetZoom) || (step < 0 && z <= targetZoom)) return;
      targetMap.setZoom(z + step);
      setTimeout(tick, 120);
    };
    setTimeout(tick, 350); // انتظر انتهاء panTo أولاً
  }, []);

  const manualGeolocateMain = useCallback(async (forceHardRequest = false) => {
    // إذا كان userLocation معروفاً بالفعل ولم يُطلب طلب قاسي، انتقل إليه بسلاسة
    if (userLocation && map.current && !forceHardRequest) {
      map.current.panTo({ lat: userLocation.lat, lng: userLocation.lng });
      smoothZoomTo(map.current, 17);
      reverseGeocode(userLocation.lat, userLocation.lng);
      return;
    }

    // محاولة استخدام Capacitor Geolocation الأصلي (أسرع وأدق على الجوال)
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Geolocation } = await import('@capacitor/geolocation');
        
        // طلب الإذن أولاً
        const perm = await Geolocation.requestPermissions();
        if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
          toast({
            title: '⚠️ إذن الموقع مرفوض',
            description: 'يرجى منح التطبيق صلاحية الوصول للموقع من الإعدادات',
            variant: 'destructive',
          });
          return;
        }

        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0, // دائماً طلب موقع جديد
        });

        const { latitude, longitude } = position.coords;
        if (map.current) {
          map.current.panTo({ lat: latitude, lng: longitude });
          smoothZoomTo(map.current, 17);
          reverseGeocode(latitude, longitude);
        }
        setStoreUserLocation({ lat: latitude, lng: longitude } as any);
        return; // نجح — لا حاجة للـ fallback
      }
    } catch (capErr) {
      console.warn('Capacitor Geolocation failed, falling back to Web API:', capErr);
    }

    // Fallback: استخدام Web Geolocation API (للمتصفح)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          if (map.current) {
            map.current.panTo({ lat: latitude, lng: longitude });
            smoothZoomTo(map.current, 17);
            reverseGeocode(latitude, longitude);
          }
          setStoreUserLocation({ lat: latitude, lng: longitude } as any);
        },
        (error) => {
          console.warn('⚠️ Geolocation error:', error.message);
          toast({
            title: '⚠️ لا يمكن تحديد موقعك',
            description: 'يرجى تفعيل خدمة الموقع من إعدادات المتصفح',
            variant: 'destructive',
          });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      toast({
        title: '⚠️ الموقع الجغرافي غير مدعوم',
        description: 'متصفحك لا يدعم خدمة الموقع',
        variant: 'destructive',
      });
    }
  }, [handleGeolocate, map, reverseGeocode, smoothZoomTo, toast, userLocation, setStoreUserLocation]);
  const manualGeolocateBooking = useCallback(() => handleGeolocate(bookingMap, false), [handleGeolocate, bookingMap]);
  
  // Layout management - Bottom panel height tracking
  const bottomPanelRef = useRef<HTMLDivElement>(null);
  const scheduleDialogRef = useRef<{ openDialog: () => void }>(null);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(0);
  const [hasStartedDragging, setHasStartedDragging] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(true); // القائمة السفلية مفتوحة افتراضياً
  
  const [pickupLocation, setPickupLocation] = useState<LocationType | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<LocationType | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [localServiceAreaStatus, setLocalServiceAreaStatus] = useState<any>(null);
  const [geofenceResult, setGeofenceResult] = useState<GeofenceResult | null>(null);
  const [showGeofenceAlert, setShowGeofenceAlert] = useState(false);

  // ═══ استقبال البيانات من AIVoiceHome عبر navigation state ═══
  const routerLocation = useLocation();
  const navStateProcessed = useRef(false);
  useEffect(() => {
    if (navStateProcessed.current) return;
    const state = routerLocation.state as { fromSavedPlace?: boolean; savedPickup?: LocationType; savedDropoff?: LocationType; preferredMode?: string } | null;
    if (!state) return;
    // إذا فيه preferredMode أو fromSavedPlace — نعالج الـ state
    if (!state.fromSavedPlace && !state.preferredMode) return;
    navStateProcessed.current = true;
    if (state.savedPickup) {
      setPickupLocation(state.savedPickup);
      // نقل الخريطة لموقع الانطلاق
      if (map.current) {
        map.current.panTo({ lat: state.savedPickup.lat, lng: state.savedPickup.lng });
        map.current.setZoom(16);
      }
    }
    if (state.savedDropoff) {
      setDropoffLocation(state.savedDropoff);
    }
    if (state.preferredMode === 'dropoff' || state.preferredMode === 'pickup' || state.preferredMode === 'booking') {
      setCurrentMode(state.preferredMode as 'pickup' | 'dropoff' | 'booking');
    }
    // مسح الـ state حتى لا يتكرر عند الـ refresh
    window.history.replaceState({}, '');
  }, [routerLocation.state, map]);
  const [showRatingScreen, setShowRatingScreen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  // حقل البحث الأول (موقع الانطلاق / الوجهة من الخريطة)
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [isLocationFocused, setIsLocationFocused] = useState(false);
  // حفظ الموقع
  const [showSaveModal, setShowSaveModal] = useState(false);
  const { isFavorite, addFavorite, removeFavorite } = useFavoritesStore();
  const isFav = centerLat && centerLng ? isFavorite(centerLat, centerLng) : false;
  const [showSavedPlacesDropdown, setShowSavedPlacesDropdown] = useState(false);
  const [supabaseSavedPlaces, setSupabaseSavedPlaces] = useState<Array<{
    id: string; name: string; address: string; lat: number; lng: number; icon: string; label: string;
  }>>([]);
  const [loadingSavedPlaces, setLoadingSavedPlaces] = useState(false);

  // جلب الأماكن المحفوظة من Supabase
  const fetchSavedPlaces = useCallback(async () => {
    if (!userId) return;
    setLoadingSavedPlaces(true);
    try {
      const { data, error } = await supabase
        .from('saved_places')
        .select('*')
        .eq('user_id', userId as string)
        .order('created_at', { ascending: true });
      if (!error && data) {
        setSupabaseSavedPlaces(data as unknown as Array<{ id: string; name: string; address: string; lat: number; lng: number; icon: string; label: string; }>);
      }
    } catch (e) {
      console.error('Error fetching saved places:', e);
    } finally {
      setLoadingSavedPlaces(false);
    }
  }, [userId]);

  // Fare calculation
  const {
    fareBreakdown,
    fareLoading,
    fareError
  } = useFareCalculation(pickupLocation, dropoffLocation, selectedVehicle, routeDistance);

  // Show fare calculation error
  useEffect(() => {
    if (fareError) {
      toast({
        title: "خطأ في حساب السعر ❌",
        description: "تحقق من الاتصال أو حاول مرة أخرى",
        variant: "destructive"
      });
    }
  }, [fareError, toast]);

  // Debug fare calculation (dev only — logger skips in production)
  useEffect(() => {
    if (pickupLocation && dropoffLocation && routeDistance && import.meta.env.DEV) {
      logger.debug("GoPage", "Fare state", { routeDistance, selectedVehicle, fareLoading: !!fareBreakdown });
    }
  }, [pickupLocation, dropoffLocation, routeDistance, selectedVehicle, fareLoading, fareError, fareBreakdown]);

  // Nearby drivers
  const {
    availableDriversByType
  } = useOptimizedNearbyDrivers(pickupLocation, selectedVehicle, {
    enableRealtime: !!pickupLocation,
    debounceMs: 1000
  });

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
      window.google.maps.event.trigger(map.current, 'resize');
    }
  }, [bottomPanelHeight]);

  // فتح dialog الحجز المتقدم تلقائياً عند الدخول عبر /rider/schedule
  useEffect(() => {
    if (scheduleMode && scheduleDialogRef.current && pickupLocation && dropoffLocation) {
      // تأخير صغير للسماح بتحميل Dialog تماماً
      const timer = setTimeout(() => {
        scheduleDialogRef.current?.openDialog();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [scheduleMode, pickupLocation, dropoffLocation]);

  // 🔄 فحص الرحلة النشطة عند التحميل + عند العودة للتطبيق
  // ✅ FIX: تمت إزالة الاشتراك المكرر في Realtime - useActiveRide يتولى ذلك
  useEffect(() => {
    if (!userId) return;

    // فحص أولي عند التحميل
    const checkRide = async () => {
      const { data } = await supabase
        .from('rides')
        .select('*')
        .eq('rider_id', userId)
        .in('status', ['pending', 'accepted', 'arrived', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) {
        setShowWaitingScreen(false);
        setShowLiveTracker(false);
      }
    };

    checkRide();

    // فحص عند العودة للـ tab فقط (بدون interval أو Realtime مكرر)
    const handleVisibilityChange = () => {
      if (!document.hidden) checkRide();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId, setShowWaitingScreen, setShowLiveTracker]);

  // Check if user should see onboarding (first time)
  // ✅ DISABLED: Onboarding is now handled by AppRoutes in App.tsx
  // This prevents conflicts with the top-level routing
  // useEffect(() => {
  //   if (!hasSeenOnboarding && userId) {
  //     setShowOnboarding(true);
  //   }
  // }, [hasSeenOnboarding, userId]);

  // عرض طلب صلاحية الموقع عند أول دخول (بعد Onboarding)
  // ✅ If user reaches GoPage, they've completed onboarding via AppRoutes
  // ✅ تخطي المودال إذا تم منح الصلاحية سابقاً
  useEffect(() => {
    const hasGrantedBefore = localStorage.getItem('location_permission_granted') === 'true';
    const hasRequestedBefore = localStorage.getItem('location_permission_requested');
    
    // إذا تم منح الصلاحية سابقاً، لا حاجة لعرض المودال
    if (hasGrantedBefore) {
      return;
    }
    
    if (!hasRequestedBefore && userId) {
      // تأخير قليل لإعطاء فرصة للـ UI بالتحميل
      setTimeout(() => {
        setShowLocationPrompt(true);
      }, 1000);
    }
  }, [userId]);

  const handleLocationPermissionGranted = (location: { lat: number; lng: number }) => {
    console.log('✅ Location permission granted:', location);
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
        address: "موقعك الحالي"
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation?.lat, userLocation?.lng]);

  // Initialize booking mode map
  useEffect(() => {
    if (currentMode !== "booking" || !pickupLocation || !dropoffLocation) return;
    initializeBookingMap(pickupLocation, dropoffLocation);
  }, [currentMode, pickupLocation, dropoffLocation, initializeBookingMap]);

  // تحذير المستخدم قبل مغادرة الصفحة أثناء الحجز
  useEffect(() => {
    if (currentMode === "booking" && dropoffLocation) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = "هل أنت متأكد من مغادرة الصفحة؟ سيتم إلغاء الحجز الحالي.";
        return e.returnValue;
      };
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }
  }, [currentMode, dropoffLocation]);

  // Local helper: center map on user location
  const centerOnUser = useCallback(() => {
    if (!map.current) return;

    // Get fresh location when button is clicked
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(position => {
        const freshLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        if (map.current) {
          map.current.panTo(freshLocation);
          map.current.setZoom(16);
        }
        toast({
          title: "تم التحديث",
          description: "تم تحديث موقعك الحالي"
        });
      }, error => {
        console.error("Location error:", error);
        toast({
          title: "خطأ",
          description: "تعذر الحصول على موقعك الحالي",
          variant: "destructive"
        });
      }, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    } else {
      toast({
        title: "خطأ",
        description: "متصفحك لا يدعم تحديد الموقع",
        variant: "destructive"
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
          variant: "destructive"
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
            const geocoder = await getGeocoder();
            if (!geocoder) throw new Error('Geocoder not available');
            const result = await geocoder.geocode({ 
              location: { lat: actualLat, lng: actualLng },
              language: 'ar'
            });
            
            if (result.results && result.results.length > 0) {
              const finalAddress = result.results[0].formatted_address;
              let poiName: string | null = null;
              
              // Step 2: 🚫 SearchNearby معطّل — تكلفة $32/1000 طلب
              // POI يُستخرج من نتائج Geocoding بدلاً (Step 3 أدناه)

              // Step 3: Look for POI in geocoding results if not found
              if (!poiName) {
                const poiResult = result.results.find(r => 
                  r.types.includes('point_of_interest') && 
                  r.name &&
                  !r.types.includes('route') &&
                  !r.types.includes('neighborhood')
                );
                
                if (poiResult && poiResult.name) {
                  poiName = poiResult.name;
                  console.log("✅ POI name from geocoding:", poiName);
                }
              }

              // Step 4: Build descriptive final address with priority logic
              const components = result.results[0]?.address_components || [];
              const getComponent = (type: string) =>
                components.find(c => c.types.includes(type))?.long_name;

              const streetNumber = getComponent('street_number');
              const route = getComponent('route');
              const neighborhood =
                getComponent('neighborhood') ||
                getComponent('sublocality') ||
                getComponent('sublocality_level_1') ||
                getComponent('sublocality_level_2');
              const locality = getComponent('locality') || getComponent('administrative_area_level_2');
              const admin1 = getComponent('administrative_area_level_1');

              const street = [route, streetNumber].filter(Boolean).join(' ').trim();
              const city = locality || admin1;

              const plusCodeRegex = /^[A-Z0-9]{4}\+[A-Z0-9]{2,}/;
              let mainPart = poiName?.trim() || "";
              if (!mainPart || plusCodeRegex.test(mainPart)) {
                mainPart = street || neighborhood || city || "";
              }

              const detailParts = [mainPart, neighborhood || "", city || ""]
                .filter(p => p && p.length > 0)
                .filter((p, idx, arr) => arr.indexOf(p) === idx);

              let priorityAddress = detailParts.join('، ');
              if (priorityAddress) {
                console.log("✅ Priority 1 - Address components:", priorityAddress);
              }

              // بديل: تنظيف formatted_address عند الحاجة
              if (!priorityAddress) {
                const addressParts = finalAddress
                  .split(/[،,]/)
                  .map(p => p.trim())
                  .filter(p => p.length > 0 && !plusCodeRegex.test(p));
                priorityAddress = addressParts.slice(0, 3).join('، ');
                if (priorityAddress) {
                  console.log("✅ Priority 2 - Multiple address parts:", priorityAddress);
                }
              }

              // البديل الأخير
              if (!priorityAddress) {
                priorityAddress = finalAddress || `${actualLat.toFixed(4)}, ${actualLng.toFixed(4)}`;
                console.log("✅ Fallback - Using original or coordinates:", priorityAddress);
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

      // إذا الموقع خارج منطقة الخدمة — إظهار إشعار واضح
      if (serviceCheck && serviceCheck.in_service === false) {
        const modeLabel = currentMode === 'pickup' ? 'موقع الانطلاق' : 'الوجهة';
        toast({
          title: `⚠️ ${modeLabel} خارج نطاق الخدمة`,
          description: serviceCheck.nearest_city
            ? `أقرب مدينة مغطاة: ${serviceCheck.nearest_city}. حرّك الخريطة لاختيار موقع داخل منطقة الخدمة.`
            : 'هذا الموقع غير مشمول بالخدمة حالياً. حرّك الخريطة لاختيار موقع آخر.',
          variant: 'destructive',
        });
        setIsConfirming(false);
        return;
      }

      const location: LocationType = {
        lat: actualLat,
        lng: actualLng,
        address: address
      };
      if (currentMode === "pickup") {
        // فحص Geofencing لموقع الانطلاق
        const geofenceCheck = await checkDestinationGeofence(actualLat, actualLng, mapToken);
        
        if (!geofenceCheck.allowed) {
          // موقع الانطلاق خارج العراق - عرض رسالة
          setGeofenceResult(geofenceCheck);
          setShowGeofenceAlert(true);
          return; // إيقاف العملية
        }
        
        setPickupLocation(location);
        // إذا كانت الوجهة موجودة مسبقاً (تعديل من شاشة الحجز)، ارجع مباشرة للحجز
        if (dropoffLocation) {
          setCurrentMode("booking");
        } else {
          setCurrentMode("dropoff");
        }
        setCenterAddress("");
        setSearchQuery("");
        toast({
          title: pickupLocation ? "تم تحديث موقع الانطلاق ✅" : "تم تحديد موقع الانطلاق ✅",
          description: address
        });
      } else if (currentMode === "dropoff") {
        // فحص Geofencing قبل تحديد الوجهة
        const geofenceCheck = await checkDestinationGeofence(actualLat, actualLng, mapToken);
        
        if (!geofenceCheck.allowed) {
          // الوجهة خارج العراق - عرض رسالة
          setGeofenceResult(geofenceCheck);
          setShowGeofenceAlert(true);
          return; // إيقاف العملية
        }
        
        // الوجهة داخل العراق - متابعة الحجز
        setDropoffLocation(location);
        setCurrentMode("booking");
        toast({
          title: dropoffLocation ? "تم تحديث الوجهة ✅" : "تم تحديد الوجهة ✅",
          description: address
        });
      }
    } catch (error) {
      console.error("Confirm error:", error);
      toast({
        title: "خطأ",
        description: "فشل تأكيد الموقع",
        variant: "destructive"
      });
    } finally {
      setIsConfirming(false);
    }
  }, [currentMode, centerAddress, isConfirming, map, checkServiceArea, toast, pickupLocation, dropoffLocation, setCurrentMode, setSearchQuery, setMapReloadKey]);

  // Track first drag to hide tooltip permanently
  useEffect(() => {
    if (isDragging && !hasStartedDragging) {
      setHasStartedDragging(true);
    }
  }, [isDragging, hasStartedDragging]);

  // Reset booking state
  const resetBooking = useCallback(() => {
    logger.debug("GoPage", "resetBooking: starting");
    
    // Clear all booking-related state
    setPickupLocation(null);
    setDropoffLocation(null);
    setRouteDistance(null);
    setRouteDuration(null);
    setShowWaitingScreen(false);
    setShowLiveTracker(false);
    setActiveRide(null);
    setSearchQuery("");
    setLocalServiceAreaStatus(null);
    setIsBooking(false); // Fix Book Now button getting stuck
    cleanupBooking(); // Important! Cleans up the previous BookingConfirmationView map
    // ✔️ ملاحظة: لا نمسح showCompletedScreen / completedRide هنا لتجنب إخفاء شاشة التقييم قبل ظهورها
    
    // Reset to pickup mode to allow user to start fresh
    setCurrentMode("pickup");

    // Force map reinitialization — mapReloadKey increment triggers useLocationPicker to recreate the map
    setIsLoading(true);
    setMapReloadKey((prev) => prev + 1);

    // إظهار toast بعد تأخير قصير
    setTimeout(() => {
      toast({
        title: "جاهز لرحلة جديدة",
        description: "يمكنك الآن طلب رحلة جديدة",
      });
    }, 300);
    
  }, [toast, setIsLoading, setMapReloadKey, cleanupBooking, setIsBooking]);

  // الانتقال لتعديل نقطة الانطلاق/الوجهة من شاشة الحجز بدون إعادة العملية من الصفر
  const startLocationEdit = useCallback((mode: "pickup" | "dropoff") => {
    // تنظيف خريطة الحجز الحالية حتى لا تتداخل مع خريطة اختيار الموقع
    cleanupBooking();

    // إعادة تهيئة خريطة اختيار الموقع بعد العودة من شاشة الحجز
    setIsLoading(true);
    setMapReloadKey((prev) => prev + 1);

    // انتقال إلى وضع التعديل المطلوب
    setCurrentMode(mode);
    setSearchQuery("");
    setCenterAddress("");
  }, [cleanupBooking, setIsLoading, setMapReloadKey, setSearchQuery, setCenterAddress]);

  // Handle booking submission
  const handleBookRide = async () => {
    if (isBooking) {
      console.log('⏳ Booking already in progress, ignoring duplicate click');
      return;
    }
    console.log('✅ handleBookRide clicked!');
    setIsBooking(true);

    // ✅ ضمان تحرير الزر إذا تجاوزت العملية 20 ثانية
    const bookingTimeout = setTimeout(() => {
      console.warn('⏰ handleBookRide: global timeout reached, resetting isBooking');
      setIsBooking(false);
    }, 20000);

    try {
      const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
        return await Promise.race([
          promise,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`انتهت مهلة ${label}`)), ms)
          ),
        ]);
      };

      // التحقق من الاتصال بالإنترنت
      if (!isOnline) {
        console.warn('🚫 handleBookRide: no internet');
        toast({
          title: "لا يوجد اتصال بالإنترنت",
          description: "تحقق من اتصالك بالإنترنت وحاول مرة أخرى",
          variant: "destructive"
        });
        setIsBooking(false);
        return;
      }

      // ✅ إصلاح: استخدام getUser() مع timeout صريح — أكثر موثوقية من getSession() التي قد تتعلق
      let resolvedUserId = userId;
      if (!resolvedUserId) {
        try {
          const userResult = await Promise.race([
            supabase.auth.getUser(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('auth_timeout')), 5000))
          ]);
          resolvedUserId = (userResult as { data: { user: { id: string } | null } }).data?.user?.id || null;
          if (resolvedUserId) {
            console.log("✅ User resolved via getUser() — proceeding with booking");
          } else {
            toast({
              title: "يجب تسجيل الدخول",
              description: "الرجاء تسجيل الدخول للحجز",
              variant: "destructive"
            });
            setIsBooking(false);
            if (navigate) navigate("/auth?redirect=/rider/go");
            return;
          }
        } catch (err) {
          const isTimeout = err instanceof Error && err.message === 'auth_timeout';
          console.warn('⚠️ Auth check failed:', isTimeout ? 'timeout' : err);
          toast({
            title: "يجب تسجيل الدخول",
            description: "الرجاء تسجيل الدخول للحجز",
            variant: "destructive"
          });
          setIsBooking(false);
          if (navigate) navigate("/auth?redirect=/rider/go");
          return;
        }
      }

      if (activeRide && activeRide.status !== "completed" && activeRide.status !== "cancelled") {
        toast({
          title: "لديك رحلة نشطة",
          description: "الرجاء إنهاء الرحلة الحالية قبل حجز رحلة جديدة",
          variant: "destructive"
        });
        setShowWaitingScreen(true);
        setIsBooking(false);
        return;
      }

      if (!pickupLocation || !dropoffLocation) {
        console.warn('🚫 handleBookRide: missing pickup/dropoff');
        toast({
          title: "معلومات ناقصة",
          description: "الرجاء تحديد نقطة الانطلاق والوجهة",
          variant: "destructive"
        });
        setIsBooking(false);
        return;
      }

      // ✅ التحقق من أن نقطة الانطلاق ≠ الوجهة (مسافة أقل من 100 متر)
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const R = 6371000; // نصف قطر الأرض بالأمتار
      const dLat = toRad(dropoffLocation.lat - pickupLocation.lat);
      const dLng = toRad(dropoffLocation.lng - pickupLocation.lng);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(pickupLocation.lat)) * Math.cos(toRad(dropoffLocation.lat)) * Math.sin(dLng / 2) ** 2;
      const pickupDropoffDistance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (pickupDropoffDistance < 100) {
        console.warn('🚫 handleBookRide: pickup ≈ dropoff');
        toast({
          title: "الوجهة قريبة جداً",
          description: "الرجاء اختيار وجهة مختلفة عن نقطة الانطلاق (100 متر على الأقل)",
          variant: "destructive"
        });
        setIsBooking(false);
        return;
      }

      // ✅ التحقق من أن الإحداثيات ضمن حدود العراق
      const isInIraq = (lat: number, lng: number) => lat >= 29 && lat <= 37.5 && lng >= 38 && lng <= 49;
      if (!isInIraq(pickupLocation.lat, pickupLocation.lng) || !isInIraq(dropoffLocation.lat, dropoffLocation.lng)) {
        console.warn('🚫 handleBookRide: coordinates outside Iraq');
        toast({
          title: "موقع خارج العراق",
          description: "الخدمة متاحة فقط داخل العراق",
          variant: "destructive"
        });
        setIsBooking(false);
        return;
      }

      console.log('✅ handleBookRide: locations OK, checking service area...');
      try {
        const checkServiceAreaWithRetry = async (
          lat: number,
          lng: number,
          timeoutLabel: string
        ) => {
          const firstCheck = await withTimeout(
            checkServiceArea(lat, lng),
            3000,
            timeoutLabel
          );

          // بعض الاستجابات تكون متذبذبة لحظياً (network jitter),
          // لذا نعيد الفحص مرة واحدة قبل الرفض النهائي.
          if (firstCheck && !firstCheck.in_service) {
            await new Promise((r) => setTimeout(r, 350));
            const secondCheck = await withTimeout(
              checkServiceArea(lat, lng),
              3000,
              `${timeoutLabel} (إعادة محاولة)`
            );
            return secondCheck || firstCheck;
          }

          return firstCheck;
        };

        const pickupServiceCheck = await checkServiceAreaWithRetry(
          pickupLocation.lat,
          pickupLocation.lng,
          "التحقق من منطقة خدمة موقع الانطلاق"
        );
        setLocalServiceAreaStatus(pickupServiceCheck);

        if (pickupServiceCheck && !pickupServiceCheck.in_service) {
          console.warn('🚫 handleBookRide: pickup outside service area');
          toast({
            title: "⚠️ موقع الانطلاق خارج منطقة الخدمة",
            description: pickupServiceCheck.nearest_region 
              ? `أقرب منطقة خدمة: ${pickupServiceCheck.nearest_region.name_ar} (${pickupServiceCheck.nearest_region.distance_km} كم)`
              : "الرجاء اختيار موقع داخل مناطق الخدمة المتاحة",
            variant: "destructive"
          });
          return;
        }

        const dropoffServiceCheck = await checkServiceAreaWithRetry(
          dropoffLocation.lat,
          dropoffLocation.lng,
          "التحقق من منطقة خدمة الوجهة"
        );
        if (dropoffServiceCheck && !dropoffServiceCheck.in_service) {
          console.warn('🚫 handleBookRide: dropoff outside service area');
          toast({
            title: "⚠️ الوجهة خارج منطقة الخدمة",
            description: dropoffServiceCheck.nearest_region 
              ? `أقرب منطقة خدمة: ${dropoffServiceCheck.nearest_region.name_ar} (${dropoffServiceCheck.nearest_region.distance_km} كم)`
              : "الرجاء اختيار وجهة داخل مناطق الخدمة المتاحة",
            variant: "destructive"
          });
          return;
        }
      } catch (error) {
        console.error("Service area check error:", error);
        // Continue with booking if service check fails
      }

      // Check fare — استخدم التقدير المحلي إذا لم يأتِ السيرفر
      const totalFare = fareBreakdown?.total_fare || 0;
      console.log('💰 handleBookRide: fare check', { totalFare, fareBreakdown: !!fareBreakdown, fareLoading });
      if (totalFare <= 0) {
        console.warn('🚫 handleBookRide: totalFare is 0');
        toast({
          title: "خطأ في حساب السعر",
          description: "الرجاء إعادة المحاولة",
          variant: "destructive"
        });
        setIsBooking(false);
        return;
      }
      console.log('✅ handleBookRide: fare OK, proceeding to create ride...');

      // Wallet balance check
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
              variant: "destructive"
            });
            setPaymentSheetOpen(true);
            setIsBooking(false);
            return;
          }
        } catch (error) {
          console.error("Wallet balance check error:", error);
        }
      }

      // Save last ride
      saveLastRide({
        pickupAddress: pickupLocation.address,
        pickupLat: pickupLocation.lat,
        pickupLng: pickupLocation.lng,
        dropoffAddress: dropoffLocation.address,
        dropoffLat: dropoffLocation.lat,
        dropoffLng: dropoffLocation.lng,
        vehicleType: selectedVehicle,
        timestamp: Date.now()
      });
      
      // Ride limits check
      try {
        const { data: secData } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "security_settings")
          .maybeSingle();

        const maxActive = (secData?.value as any)?.max_active_rides_per_user ?? 3;
        const cooldown = (secData?.value as any)?.ride_creation_cooldown_seconds ?? 60;

        const { data: activeRidesRaw } = await supabase
          .from("rides")
          .select("id, status, created_at")
          .eq("rider_id", userId)
          .in("status", ["pending", "accepted", "in_progress", "arrived"])
          .order("created_at", { ascending: false })
          .limit(20);

        const now = Date.now();
        const activeCount = (activeRidesRaw || []).filter((ride: any) => {
          if (ride.status === "pending") {
            const ageMinutes = (now - new Date(ride.created_at).getTime()) / 60000;
            return ageMinutes <= 10;
          }
          return true;
        }).length;

        if (activeCount >= maxActive) {
          toast({
            title: "لديك رحلات نشطة بالفعل",
            description: `الحد الأقصى ${maxActive} رحلات نشطة في وقت واحد`,
            variant: "destructive",
          });
          setIsBooking(false);
          return;
        }

        const { data: lastRide } = await supabase
          .from("rides")
          .select("created_at")
          .eq("rider_id", userId)
          .not("status", "in", '("cancelled","completed")')
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastRide) {
          const elapsed = (Date.now() - new Date(lastRide.created_at).getTime()) / 1000;
          if (elapsed < cooldown) {
            toast({
              title: "يرجى الانتظار",
              description: `انتظر ${Math.ceil(cooldown - elapsed)} ثانية قبل إنشاء رحلة جديدة`,
              variant: "destructive",
            });
            setIsBooking(false);
            return;
          }
        }
      } catch (e) {
        console.warn("⚠️ Failed to check ride limits, continuing:", e);
      }

      // Create the ride
      setIgnorePolling?.(true);
      try {
        const {
          data: ride,
          error
        } = await supabase.from("rides").insert([{
          rider_id: userId,
          pickup_location: { lat: pickupLocation.lat, lng: pickupLocation.lng },
          dropoff_location: { lat: dropoffLocation.lat, lng: dropoffLocation.lng },
          pickup_address: pickupLocation.address,
          dropoff_address: dropoffLocation.address,
          vehicle_type: selectedVehicle,
          payment_method: mapPaymentToDb(paymentMethod),
          estimated_fare: roundFare(fareBreakdown?.total_fare || 0),
          distance_km: routeDistance ? Number(routeDistance.toFixed(2)) : null,
          duration_minutes: routeDuration ? Math.round(routeDuration) : null,
          status: "pending" as const,
          trip_type: "app" as const,
          region_id: fareBreakdown?.region_id || null,
        }]).select().single();
        if (error) throw error;

        setIgnorePolling?.(false);

        const pickupLoc = ride.pickup_location as unknown as { lat: number; lng: number };
        const dropoffLoc = ride.dropoff_location as unknown as { lat: number; lng: number };
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
          payment_method: ride.payment_method
        });

        setShowWaitingScreen(true);

        withTimeout(
          supabase.functions.invoke("match-ride", { body: { rideId: ride.id } }),
          8000,
          "مطابقة السائق"
        ).catch(async (matchErr) => {
          console.warn("⚠️ match-ride first attempt failed:", matchErr);
          // إعادة محاولة واحدة بعد 2 ثانية
          try {
            await new Promise(r => setTimeout(r, 2000));
            await withTimeout(
              supabase.functions.invoke("match-ride", { body: { rideId: ride.id } }),
              10000,
              "مطابقة السائق (إعادة محاولة)"
            );
          } catch (retryErr) {
            console.error("❌ match-ride retry also failed:", retryErr);
            toast({
              title: "⚠️ جارٍ البحث عن سائق",
              description: "تأخر في البحث عن سائق مناسب، سيتم المحاولة تلقائياً",
            });
          }
        });

      } catch (error: any) {
        setIgnorePolling?.(false);

        const errorMessage = String(error?.message || "");
        if (errorMessage.includes("انتهت مهلة إنشاء الرحلة")) {
          try {
            const { data: fallbackRide } = await supabase
              .from("rides")
              .select("*")
              .eq("rider_id", userId)
              .eq("status", "pending")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (fallbackRide) {
              const pickupLoc = fallbackRide.pickup_location as unknown as { lat: number; lng: number };
              const dropoffLoc = fallbackRide.dropoff_location as unknown as { lat: number; lng: number };
              setActiveRide({
                id: fallbackRide.id,
                pickup_location: pickupLoc,
                dropoff_location: dropoffLoc,
                pickup_address: fallbackRide.pickup_address,
                dropoff_address: fallbackRide.dropoff_address,
                status: fallbackRide.status,
                estimated_fare: fallbackRide.estimated_fare,
                final_fare: fallbackRide.final_fare,
                distance_km: fallbackRide.distance_km,
                duration_minutes: fallbackRide.duration_minutes,
                vehicle_type: fallbackRide.vehicle_type,
                driver_id: fallbackRide.driver_id,
                created_at: fallbackRide.created_at,
                completed_at: fallbackRide.completed_at,
                payment_method: fallbackRide.payment_method,
              });
              setShowWaitingScreen(true);
              return;
            }
          } catch (fallbackError) {
            console.warn("⚠️ Fallback pending ride check failed:", fallbackError);
          }
        }

        logger.error("GoPage", "Booking failed", error);
        showErrorToast(toast, "فشل الحجز", error?.message || "حدث خطأ غير متوقع");
      }
    } finally {
      // ✅ دائماً نُعيد تفعيل الزر بغض النظر عن أي return مبكر
      clearTimeout(bookingTimeout);
      setIsBooking(false);
    }
  };


  const isPickup = currentMode === "pickup";
  const isDropoff = currentMode === "dropoff";
  const isBookingMode = currentMode === "booking";

  // Show location permission prompt
  if (showLocationPrompt) {
    return <LocationPermissionPrompt 
      onPermissionGranted={handleLocationPermissionGranted}
      onSkip={() => setShowLocationPrompt(false)}
    />;
  }

  // ✅ DISABLED: Show onboarding is handled by AppRoutes
  // if (showOnboarding) {
  //   return <Suspense fallback={<ScreenSkeleton />}>
  //       <OnboardingFlow onComplete={() => setShowOnboarding(false)} />
  //     </Suspense>;
  // }

  // ✅ عرض شاشة الإكمال مع التقييم المدمج (SmartRatingFlow) عند إتمام الرحلة
  if (showCompletedScreen && completedRide) {
    return <Suspense fallback={<ScreenSkeleton />}>
        <RideCompletedScreen ride={{
        id: completedRide.id,
        pickup_address: completedRide.pickup_address,
        dropoff_address: completedRide.dropoff_address,
        final_fare: completedRide.final_fare,
        estimated_fare: completedRide.estimated_fare,
        distance_km: completedRide.distance_km,
        duration_minutes: completedRide.duration_minutes,
        driver_id: completedRide.driver_id,
        payment_method: completedRide.payment_method
      }} driverName={completedRide.driver_name || "السائق"} onClose={() => {
        console.log('🎉 [RideCompleted] onClose -> clearing completed ride and resetting booking/map');
        setShowRatingScreen(false);
        setShowCompletedScreen(false);
        handleRideCompletion();
        resetBooking();
      }} />
      </Suspense>;
  }

  // Show waiting screen if ride is pending or accepted
  if (showWaitingScreen && activeRide) {
    return <Suspense fallback={<ScreenSkeleton />}>
        <RideWaitingScreen rideId={activeRide.id} pickupAddress={activeRide.pickup_address || pickupLocation?.address || "موقعي الحالي"} dropoffAddress={activeRide.dropoff_address || dropoffLocation?.address || ""} estimatedFare={activeRide.estimated_fare || fareBreakdown?.total_fare || 0} onCancel={resetBooking} onDriverFound={() => {
        setShowWaitingScreen(false);
        setShowLiveTracker(true);
      }} />
      </Suspense>;
  }

  // Show live tracker if ride is in progress
  if (showLiveTracker && activeRide) {
    return <Suspense fallback={<ScreenSkeleton />}>
        <LiveRideTracker ride={activeRide} onClose={resetBooking} onRebook={() => {
        // ✅ إعادة الحجز: إغلاق التتبع والعودة لنفس التفاصيل ثم محاولة حجز تلقائي
        resetBooking();
        // الموقع والوجهة محفوظين في الـ store - الراكب يحتاج فقط ضغط "اطلب" مرة أخرى
      }} onRideUpdate={updatedRide => {
        // ✔️ إصلاح race condition: عند completed لا نستدعي resetBooking لأن useActiveRide يكتشف الإتمام
        // ويضبط شاشة التقييم تلقائياً — نستدعيها فقط عند الإلغاء
        if (updatedRide.status === "cancelled") {
          resetBooking();
        }
      }} />
      </Suspense>;
  }

  // Booking confirmation screen
  if (isBookingMode && pickupLocation && dropoffLocation) {
    return (
      <BookingConfirmationView
        pickupLocation={pickupLocation}
        dropoffLocation={dropoffLocation}
        routeDistance={routeDistance}
        routeDuration={routeDuration}
        bookingMapContainerRef={bookingMapContainer}
        onGeolocate={manualGeolocateBooking}
        fareBreakdown={fareBreakdown}
        fareLoading={fareLoading}
        selectedVehicle={selectedVehicle}
        onVehicleChange={setSelectedVehicle}
        paymentMethod={paymentMethod}
        onPaymentChange={setPaymentMethod}
        isBooking={isBooking}
        onBookRide={handleBookRide}
        onEditLocation={startLocationEdit}
        onSwapLocations={() => {
          const temp = pickupLocation;
          setPickupLocation(dropoffLocation);
          setDropoffLocation(temp);
          toast({
            title: "تم عكس الاتجاه ✅",
            description: "تم تبديل موقع الانطلاق مع الوجهة",
            duration: 2000,
          });
        }}
        scheduleDialogRef={scheduleDialogRef}
        onScheduled={() => {
          toast({ title: "تم جدولة الرحلة ✅", description: "سيتم تذكيرك قبل الموعد" });
          resetBooking();
        }}
        isOnline={isOnline}
        bottomNavEnabled={bottomNavEnabled}
        buildDescriptiveAddress={buildDescriptiveAddress}
        availableDriversByType={availableDriversByType}
        user={user}
        menuOpen={menuOpen}
        onMenuToggle={setMenuOpen}
        onLogout={async () => {
          await supabase.auth.signOut();
          if (navigate) navigate("/auth");
        }}
      />
    );
  }

  // Location picker screen
  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Map Container - لا نضع touchAction هنا حتى لا يتعارض مع Google Maps */}
      <div 
        className="flex-1 relative w-full h-full overflow-hidden"
      >
        {/* Enhanced map loading placeholder - pointer-events-none when map is ready */}
        {(!mapToken || isLoading) && !mapError && (
          <div className="absolute inset-0 bg-background flex items-center justify-center z-50 pointer-events-none">
            <div className="text-center space-y-4 px-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-primary/40" />
                </div>
              </div>
              <div>
                <p className="text-foreground text-lg font-semibold">جاري تحميل الخريطة...</p>
                <p className="text-muted-foreground text-sm mt-2">
                  {!mapToken ? "جاري الاتصال بخادم الخرائط..." : "جاري تحديد موقعك..."}
                </p>
              </div>
              {(isLoading && mapToken) && (
                <div className="text-xs text-muted-foreground/70 mt-4">
                  💡 تلميح: تأكد من تفعيل الموقع في متصفحك
                </div>
              )}
            </div>
          </div>
        )}

        {/* خطأ تحميل الخريطة - بدلاً من شاشة سوداء */}
        {mapError && (
          <div className="absolute inset-0 bg-background flex items-center justify-center z-50">
            <div className="text-center p-6 max-w-sm">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">خطأ في الخريطة</h3>
              <p className="text-sm text-muted-foreground mb-4">{mapError}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                إعادة المحاولة
              </button>
            </div>
          </div>
        )}

        {/* Map container - touch-action:none يسمح لـ Google Maps بالتحكم الكامل بالسحب */}
        <div 
          ref={mapContainer} 
          className="absolute inset-0 z-0"
          style={{ 
            touchAction: 'none',
            pointerEvents: 'auto',
            cursor: 'grab'
          }}
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

        {/* Header — نفس أسلوب السائق مع خلفية شفافة */}
        <header
          className="fixed top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top)] transition-colors duration-300"
          style={{
            background: 'rgba(11, 19, 38, 0.4)',
            borderBottom: '1px solid rgba(91, 221, 166, 0.2)',
            backdropFilter: 'blur(20px) saturate(150%)',
            WebkitBackdropFilter: 'blur(20px) saturate(150%)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          }}
          dir="rtl"
        >
          <div className="flex items-center justify-between h-14 px-4">
            {/* يسار: مساحة موازنة مثل هيدر الصفحات الجانبية */}
            <div className="flex items-center gap-2.5">
              <div className="w-8" aria-hidden="true" />
            </div>

            {/* وسط: الشعار (نفس نمط RiderPageHeader) */}
            <div className="flex items-center gap-2">

            {/* الشعار في الوسط */}
            <div className="pointer-events-none">
              <img
                src={logo}
                alt="RAAN"
                className="w-9 h-9 rounded-xl shadow-[0_0_12px_rgba(91,221,166,0.3)]"
              />
            </div>
            </div>

            {/* يمين: زر القائمة (نفس نمط RiderPageHeader) */}
            <button
              onClick={() => setMenuOpen(true)}
              className="bg-[#5bdda6]/10 border border-[#5bdda6]/30 hover:bg-[#5bdda6]/20 p-2.5 rounded-xl active:scale-95 transition-all shadow-[0_0_15px_rgba(91,221,166,0.15)] group backdrop-blur-md"
              aria-label="القائمة الرئيسية"
              title="القائمة الرئيسية"
            >
              <Menu className="w-5 h-5 text-[#5bdda6] group-hover:drop-shadow-[0_0_8px_rgba(91,221,166,0.5)] transition-all" />
            </button>
          </div>
        </header>

        {/* زر تحديد موقعي (ملتصق تحت الهيدر مباشرة) */}
        <div 
          className="fixed right-6 z-40 pointer-events-auto flex flex-col items-center"
          style={{ top: 'calc(3.5rem + env(safe-area-inset-top))' }}
        >
          <button
            onClick={manualGeolocateMain}
            className="w-12 h-12 flex items-center justify-center rounded-b-xl bg-[rgba(11,19,38,0.7)] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] border-b border-x border-[#5bdda6]/30 hover:bg-[rgba(11,19,38,0.9)] transition-colors duration-200 group"
            title="تحديد موقعي"
            aria-label="تحديد موقعي"
          >
            <Navigation className="w-5 h-5 text-[#5bdda6] group-active:scale-90 transition-transform" />
          </button>
        </div>

        {/* Drag instruction — أسفل الهيدر على اليمين (left في CSS = يمين في RTL) */}
        <AnimatePresence>
          {!isDragging && centerAddress && !hasStartedDragging && <motion.div 
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="absolute left-4 top-20 z-30 pointer-events-none"
          >
            <div className="bg-card/95 backdrop-blur-lg px-3 py-2 rounded-full shadow-lg border border-border/50 whitespace-nowrap">
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
                <span className="text-base">👉</span>
                <span>اسحب الخريطة لتغيير الموقع</span>
              </p>
            </div>
          </motion.div>}
        </AnimatePresence>

        {/* Location pin - دبوس CSS بدون صور خارجية - pointer-events-none للسماح بتحريك الخريطة */}
        <div 
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full z-[70]"
        >
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-1"
          >
            {/* Location Name Label - يظهر أعلى الدبوس */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-lg border border-border/50 whitespace-nowrap max-w-xs"
            >
              <div className="flex items-center gap-2">
                {/* نوع الموقع */}
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0 ${
                  isPickup ? 'bg-green-500' : 'bg-sky-500'
                }`}>
                  {isPickup ? '🚀 انطلاق' : '📍 وصول'}
                </span>
                {/* العنوان الديناميكي */}
                {centerAddress && (
                  <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                    {buildDescriptiveAddress(centerAddress)}
                  </p>
                )}
              </div>
            </motion.div>
            
            <motion.div 
              animate={{ y: isDragging ? -12 : 0 }} 
              transition={{ type: "spring", stiffness: 300 }}
              className="relative"
            >
              {/* Pin Head */}
              <div 
                className={`w-14 h-14 rounded-full flex items-center justify-center border-4 border-white ${
                  isPickup ? 'bg-green-500' : 'bg-sky-500'
                }`}
                style={{
                  boxShadow: isPickup 
                    ? '0 0 20px rgba(34, 197, 94, 0.6), 0 4px 20px rgba(0,0,0,0.3)' 
                    : '0 0 20px rgba(14, 165, 233, 0.6), 0 4px 20px rgba(0,0,0,0.3)',
                }}
              >
                {isPickup ? (
                  <Navigation className="w-6 h-6 text-white" />
                ) : (
                  <MapPin className="w-6 h-6 text-white" />
                )}
              </div>
              
              {/* Pin Needle - النقطة السفلية من الدبوس */}
              <div 
                className={`w-0 h-0 mx-auto -mt-1`}
                style={{
                  borderLeft: '10px solid transparent',
                  borderRight: '10px solid transparent',
                  borderTop: isPickup ? '16px solid #22c55e' : '16px solid #0ea5e9',
                  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))',
                }}
              />
              
              {/* Shadow dot - للتأثير البصري */}
              <motion.div 
                animate={{ scale: isDragging ? 0.5 : 1, opacity: isDragging ? 0.2 : 0.4 }} 
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-2 bg-black/50 rounded-full blur-sm" 
              />
            </motion.div>
          </motion.div>
        </div>

        {/* Loading overlay with static map placeholder */}
        {isLoading && <StaticMapPlaceholder lat={userLocation?.lat || lastLocation?.lat} lng={userLocation?.lng || lastLocation?.lng} zoom={14} message="جاري تحميل الخريطة..." />}



      </div>

      {/* 🟢 Bottom panel - Premium Dark Glassmorphism — drag="y" like ActiveRideCard */}
      <motion.div 
        ref={bottomPanelRef}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        initial={{ y: 100 }}
        animate={{ y: 0, height: panelExpanded ? 'auto' : 'auto' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 50) {
            // سحب للأسفل: تصغير بالكامل للحالتين
            setPanelExpanded(false);
            setShowSavedPlacesDropdown(false);
          } else if (info.offset.y < -50) {
            // سحب للأعلى
            if (!panelExpanded) {
              // إذا كانت اللوحة مصغرة، افتح شريط البحث فقط
              setPanelExpanded(true);
              setShowSavedPlacesDropdown(false);
            } else if (panelExpanded && !showSavedPlacesDropdown) {
              // إذا كان شريط البحث معروضاً، ابدأ بعرض الأماكن المحفوظة
              setShowSavedPlacesDropdown(true);
              fetchSavedPlaces();
            }
          }
        }}
        className={`bg-[#0b1326]/98 backdrop-blur-xl border-t border-[#5bdda6]/10 shadow-[0_-10px_40px_rgba(11,19,38,0.6)] z-20 rounded-t-3xl pointer-events-auto fixed left-0 right-0 ${panelExpanded ? 'overflow-visible' : 'overflow-hidden'} flex flex-col`}
        style={{
          bottom: 0,
          WebkitBackdropFilter: 'blur(20px)',
          maxHeight: panelExpanded ? '72vh' : 'auto',
        }}
      >
        {/* خط توهج أعلى البانل */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#5bdda6]/30 to-transparent blur-sm" />

        {/* Drag Handle — قابل للسحب */}
        <div
          className="flex flex-col items-center justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none select-none"
          onClick={() => setPanelExpanded(prev => !prev)}
        >
          {/* مؤشر السحب */}
          <motion.div
            className="rounded-full"
            animate={{
              width: 48,
              height: 4,
              backgroundColor: panelExpanded ? '#5bdda6' : '#475569',
            }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* ═══ الحالة المصغّرة — ملخص العنوان + زر التأكيد ═══ */}
        {!panelExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-4 flex flex-col gap-2"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 16px), 16px)' }}
          >
            {/* عرض العنوان المحدد */}
            <div 
              className="flex items-center gap-3 p-3 rounded-2xl bg-[#131d35] border border-[#5bdda6]/10 cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => setPanelExpanded(true)}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isPickup 
                  ? 'bg-green-500/20 border border-green-500/30' 
                  : 'bg-sky-500/20 border border-sky-500/30'
              }`}>
                {isPickup 
                  ? <Navigation className="w-4 h-4 text-green-400" /> 
                  : <MapPin className="w-4 h-4 text-sky-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold tracking-wider text-[#5bdda6]/50 uppercase mb-0.5">
                  {isPickup ? 'الموقع المحدد' : 'الوجهة المحددة'}
                </p>
                <p className="text-sm font-semibold text-slate-200 truncate leading-snug">
                  {centerAddress ? buildDescriptiveAddress(centerAddress) : 'جاري تحديد العنوان...'}
                </p>
              </div>

            </div>

            {/* زر التأكيد المصغّر */}
            <motion.button
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(50);
                handleConfirm();
              }}
              disabled={!centerAddress || isCheckingService || isConfirming}
              whileTap={(!centerAddress || isCheckingService || isConfirming) ? {} : { scale: 0.95 }}
              className={`w-full py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all duration-300 ${
                centerAddress && !isCheckingService && !isConfirming
                  ? isPickup
                    ? 'bg-gradient-to-r from-[#5bdda6] to-[#27b481] text-[#003825] shadow-[0_8px_24px_rgba(39,180,129,0.25)]'
                    : 'bg-gradient-to-r from-[#38bdf8] to-[#0ea5e9] text-white shadow-[0_8px_24px_rgba(14,165,233,0.25)]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isCheckingService || isConfirming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isConfirming ? 'جاري التأكيد...' : 'جاري التحقق...'}</span>
                </>
              ) : !centerAddress ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                  <span>جاري تحديد العنوان...</span>
                </>
              ) : (
                <>
                  <span>تأكيد {isPickup ? 'موقع الانطلاق' : 'الوجهة'}</span>
                  <Navigation className="w-4 h-4 -rotate-90" />
                </>
              )}
            </motion.button>
          </motion.div>
        )}

        {/* المحتوى القابل للتمرير — يظهر/يختفي حسب حالة التوسيع */}
        <AnimatePresence>
          {panelExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              style={{ overflow: 'visible' }}
            >
              <div className="px-4 pb-[120px] flex flex-col gap-3 overflow-visible" style={{ maxHeight: 'calc(72vh - 80px)' }}>
          {/* Service area warning */}
          {localServiceAreaStatus && !localServiceAreaStatus.in_service && <div className="flex items-center gap-3 p-3 mb-1 rounded-2xl bg-red-500/10 border border-red-500/20">
              <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-red-400 text-sm mb-1">
                  ⚠️ خارج منطقة الخدمة
                </p>
                {localServiceAreaStatus.nearest_region && <p className="text-slate-400 text-xs">
                    أقرب منطقة: {localServiceAreaStatus.nearest_region.name_ar}{" "}
                    ({localServiceAreaStatus.nearest_region.distance_km} كم)
                  </p>}
              </div>
            </div>}

          {/* حقل البحث — تصميم فاخر مطابق للصورة */}
          <div className="relative pointer-events-auto -mx-4 overflow-visible z-50">
            <DynamicSearchHeader
              headerLabel={
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <p className="text-[13px] font-bold tracking-widest text-[#5bdda6]/80 uppercase">
                    {isPickup ? 'موقع الانطلاق' : 'الوجهة'}
                  </p>
                </div>
              }
              query={locationSearchQuery}
              onQueryChange={(v) => {
                setLocationSearchQuery(v);
                setSearchQuery(v);
                if (v) setIsLocationFocused(true);
                // إذا اختار المستخدم تصنيف سريع والآن يعدل النص يدوياً
                if (!v) setActiveCategory(null);
              }}
              onClear={() => {
                setLocationSearchQuery('');
                clearSearch();
                setIsLocationFocused(false);
                setCenterAddress(null);
                setManualAddress(null);
                setActiveCategory(null);
              }}
              isSearching={isSearching}
              isOffline={searchOffline}
              placeholder={isPickup ? 'اختر موقع الانطلاق ....' : 'اختر جهة الوصول ....'}
              onFocus={() => setIsLocationFocused(true)}
              showAddress={!locationSearchQuery && centerAddress ? buildDescriptiveAddress(centerAddress) : undefined}
              onAddressClick={() => {
                if (!centerAddress || centerAddress.includes('بدون اسم') || centerAddress.includes('غير مفعل')) {
                  manualGeolocateMain(true);
                } else {
                  setIsLocationFocused(true);
                }
              }}
              onCurrentLocation={() => manualGeolocateMain(true)}
              onSaveLocation={() => {
                if (centerAddress && centerLat && centerLng) setShowSaveModal(true);
              }}
              isFavorite={!!isFav}
              onClearAddress={() => {
                setCenterAddress(null);
                setManualAddress(null);
                setLocationSearchQuery('');
                setSearchQuery('');
                setLocalServiceAreaStatus(null);
              }}
              voiceSupported={voiceSupported}
              voiceState={voiceState}
              onVoiceToggle={toggleListening}
              voiceTranscript={voiceTranscript}
            />

            <DynamicSearchResults
              query={locationSearchQuery}
              results={predictions}
              unifiedResults={locationSearchQuery
                ? unified.mergeResults(
                    unified.searchLocal(locationSearchQuery, recentSearches),
                    predictions ?? []
                  )
                : undefined}
              recentSearches={recentSearches}
              smartSuggestions={unified.getSmartSuggestions()}
              nearbyLandmarks={unified.getNearbyLandmarks(5)}
              savedPlaces={supabaseSavedPlaces}
              isSearching={isSearching}
              isLoadingDetails={isLoadingDetails}
              isOffline={searchOffline}
              isOpen={isLocationFocused}
              activeCategory={activeCategory}
              onCategorySelect={(cat: CategoryFilter) => {
                if (activeCategory === cat.id) {
                  setActiveCategory(null);
                  setLocationSearchQuery('');
                  setSearchQuery('');
                } else {
                  setActiveCategory(cat.id);
                  setLocationSearchQuery(cat.keyword);
                  setSearchQuery(cat.keyword);
                }
              }}
              onSelect={async (placeId) => {
                const placeDetails = await getPlaceDetails(placeId);
                if (!placeDetails) return;
                addRecentSearch({
                  mainText: placeDetails.name,
                  secondaryText: placeDetails.address,
                  address: placeDetails.address,
                  lat: placeDetails.lat,
                  lng: placeDetails.lng,
                });
                const geofenceCheck = await checkDestinationGeofence(placeDetails.lat, placeDetails.lng, mapToken);
                if (!geofenceCheck.allowed) {
                  setGeofenceResult(geofenceCheck);
                  setShowGeofenceAlert(true);
                  return;
                }
                // ✅ حفظ مباشر كموقع انطلاق أو وجهة والانتقال للخطوة التالية
                const location: LocationType = {
                  lat: placeDetails.lat,
                  lng: placeDetails.lng,
                  address: placeDetails.name || placeDetails.address,
                };
                if (isPickup) {
                  setPickupLocation(location);
                  if (dropoffLocation) {
                    setCurrentMode('booking');
                  } else {
                    setCurrentMode('dropoff');
                  }
                  toast({ title: 'تم تحديد موقع الانطلاق ✅', description: location.address });
                } else {
                  setDropoffLocation(location);
                  if (pickupLocation) {
                    setCurrentMode('booking');
                  } else {
                    setCurrentMode('pickup');
                  }
                  toast({ title: 'تم تحديد الوجهة ✅', description: location.address });
                }
                if (map.current) {
                  map.current.panTo({ lat: placeDetails.lat, lng: placeDetails.lng });
                  map.current.setZoom(16);
                }
                setCenterAddress('');
                setLocationSearchQuery('');
                setSearchQuery('');
                setIsLocationFocused(false);
                setActiveCategory(null);
              }}
              onSelectUnified={async (result) => {
                let selectedLat: number | undefined;
                let selectedLng: number | undefined;
                let selectedAddress: string = result.main_text;

                if (result.lat && result.lng) {
                  selectedLat = result.lat;
                  selectedLng = result.lng;
                  selectedAddress = result.main_text;
                  addRecentSearch({
                    mainText: result.main_text,
                    secondaryText: result.secondary_text || '',
                    address: result.secondary_text || result.main_text,
                    lat: result.lat,
                    lng: result.lng,
                  });
                } else if (result.place_id) {
                  const placeDetails = await getPlaceDetails(result.place_id);
                  if (!placeDetails) return;
                  selectedLat = placeDetails.lat;
                  selectedLng = placeDetails.lng;
                  selectedAddress = placeDetails.name || placeDetails.address;
                  addRecentSearch({
                    mainText: placeDetails.name,
                    secondaryText: placeDetails.address,
                    address: placeDetails.address,
                    lat: placeDetails.lat,
                    lng: placeDetails.lng,
                  });
                }

                if (!selectedLat || !selectedLng) return;

                const geofenceCheck = await checkDestinationGeofence(selectedLat, selectedLng, mapToken);
                if (!geofenceCheck.allowed) {
                  setGeofenceResult(geofenceCheck);
                  setShowGeofenceAlert(true);
                  return;
                }

                // ✅ حفظ مباشر كموقع انطلاق أو وجهة
                const location: LocationType = { lat: selectedLat, lng: selectedLng, address: selectedAddress };
                if (isPickup) {
                  setPickupLocation(location);
                  setCurrentMode(dropoffLocation ? 'booking' : 'dropoff');
                  toast({ title: 'تم تحديد موقع الانطلاق ✅', description: location.address });
                } else {
                  setDropoffLocation(location);
                  setCurrentMode(pickupLocation ? 'booking' : 'pickup');
                  toast({ title: 'تم تحديد الوجهة ✅', description: location.address });
                }
                if (map.current) {
                  map.current.panTo({ lat: selectedLat, lng: selectedLng });
                  map.current.setZoom(16);
                }
                setCenterAddress('');
                setLocationSearchQuery('');
                setSearchQuery('');
                setIsLocationFocused(false);
                setActiveCategory(null);
              }}
              onSelectRecent={async (search) => {
                const geofenceCheck = await checkDestinationGeofence(search.lat, search.lng, mapToken);
                if (!geofenceCheck.allowed) {
                  setGeofenceResult(geofenceCheck);
                  setShowGeofenceAlert(true);
                  return;
                }
                // ✅ حفظ مباشر
                const location: LocationType = { lat: search.lat, lng: search.lng, address: search.address };
                if (isPickup) {
                  setPickupLocation(location);
                  setCurrentMode(dropoffLocation ? 'booking' : 'dropoff');
                  toast({ title: 'تم تحديد موقع الانطلاق ✅', description: location.address });
                } else {
                  setDropoffLocation(location);
                  setCurrentMode(pickupLocation ? 'booking' : 'pickup');
                  toast({ title: 'تم تحديد الوجهة ✅', description: location.address });
                }
                if (map.current) {
                  map.current.panTo({ lat: search.lat, lng: search.lng });
                  map.current.setZoom(16);
                }
                setCenterAddress('');
                setLocationSearchQuery('');
                setSearchQuery('');
                setIsLocationFocused(false);
              }}
              onSelectSmart={async (suggestion) => {
                if (suggestion.lat && suggestion.lng) {
                  const geofenceCheck = await checkDestinationGeofence(suggestion.lat, suggestion.lng, mapToken);
                  if (!geofenceCheck.allowed) {
                    setGeofenceResult(geofenceCheck);
                    setShowGeofenceAlert(true);
                    return;
                  }
                  // ✅ حفظ مباشر
                  const location: LocationType = { lat: suggestion.lat, lng: suggestion.lng, address: suggestion.title };
                  if (isPickup) {
                    setPickupLocation(location);
                    setCurrentMode(dropoffLocation ? 'booking' : 'dropoff');
                    toast({ title: 'تم تحديد موقع الانطلاق ✅', description: location.address });
                  } else {
                    setDropoffLocation(location);
                    setCurrentMode(pickupLocation ? 'booking' : 'pickup');
                    toast({ title: 'تم تحديد الوجهة ✅', description: location.address });
                  }
                  if (map.current) {
                    map.current.panTo({ lat: suggestion.lat, lng: suggestion.lng });
                    map.current.setZoom(16);
                  }
                  setCenterAddress('');
                  setLocationSearchQuery('');
                  setSearchQuery('');
                  setIsLocationFocused(false);
                }
              }}
              onSelectSavedPlace={async (place) => {
                const geofenceCheck = await checkDestinationGeofence(place.lat, place.lng, mapToken);
                if (!geofenceCheck.allowed) {
                  setGeofenceResult(geofenceCheck);
                  setShowGeofenceAlert(true);
                  return;
                }
                // ✅ حفظ مباشر
                const location: LocationType = { lat: place.lat, lng: place.lng, address: place.name || place.address };
                if (isPickup) {
                  setPickupLocation(location);
                  setCurrentMode(dropoffLocation ? 'booking' : 'dropoff');
                  toast({ title: 'تم تحديد موقع الانطلاق ✅', description: location.address });
                } else {
                  setDropoffLocation(location);
                  setCurrentMode(pickupLocation ? 'booking' : 'pickup');
                  toast({ title: 'تم تحديد الوجهة ✅', description: location.address });
                }
                if (map.current) {
                  map.current.panTo({ lat: place.lat, lng: place.lng });
                  map.current.setZoom(16);
                }
                setCenterAddress('');
                setLocationSearchQuery('');
                setSearchQuery('');
                setIsLocationFocused(false);
              }}
              onRemoveRecent={removeRecentSearch}
              maxResults={6}
              maxRecentResults={3}
              onClose={() => setIsLocationFocused(false)}
            />
          </div>



          {/* ═══ الأماكن المحفوظة — سلايدر أفقي ═══ */}
          <AnimatePresence>
            {showSavedPlacesDropdown && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="w-[calc(100%+2rem)] -mx-4 bg-[#0b1326]/95 border-t border-[#5bdda6]/10"
              >
                {loadingSavedPlaces ? (
                  <div className="flex items-center justify-center py-4 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#5bdda6]" />
                    <span className="text-xs text-slate-400">جاري التحميل...</span>
                  </div>
                ) : supabaseSavedPlaces.length === 0 ? (
                  <div className="flex items-center justify-center py-4 gap-2">
                    <Bookmark className="w-4 h-4 text-[#5bdda6]/30" />
                    <span className="text-xs text-slate-500">لا توجد أماكن محفوظة</span>
                  </div>
                ) : (
                  <div
                    className="flex gap-2.5 overflow-x-auto px-4 py-3 scrollbar-none"
                    style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
                  >
                    {supabaseSavedPlaces.map((place) => {
                      const iconMap: Record<string, string> = {
                        '🏠': '🏠', '💼': '💼', '⭐': '⭐', '❤️': '❤️',
                        '🎓': '🎓', '💪': '💪', '🍽️': '🍽️', '🏥': '🏥',
                        '🛍️': '🛍️', '🏢': '🏢', '📍': '📍',
                        home: '🏠', work: '💼', cafe: '☕', gym: '🏋️',
                        diwaniya: '🏛️', carwash: '🚗', other: '📍',
                        favorite: '⭐', loved: '❤️', school: '🎓',
                        restaurant: '🍽️', hospital: '🏥', shopping: '🛍️', office: '🏢',
                      };
                      const displayIcon = iconMap[place.icon] || iconMap[place.label] || '📍';
                      return (
                        <motion.button
                          key={place.id}
                          whileTap={{ scale: 0.93 }}
                          onClick={() => {
                            const location = { lat: place.lat, lng: place.lng, address: place.address || place.name };
                            if (isPickup) {
                              // وضع الانطلاق: تعيين كموقع انطلاق + التحول لاختيار الوجهة
                              setPickupLocation(location);
                              setCurrentMode('dropoff');
                              toast({ title: 'تم تحديد موقع الانطلاق ✅', description: place.name });
                            } else {
                              // وضع الوجهة: تعيين كوجهة وصول + التحول للحجز
                              setDropoffLocation(location);
                              setCurrentMode('booking');
                              toast({ title: 'تم تحديد الوجهة ✅', description: place.name });
                            }
                            if (map.current) {
                              map.current.panTo({ lat: place.lat, lng: place.lng });
                              map.current.setZoom(16);
                            }
                            setCenterAddress('');
                            setSearchQuery('');
                            setLocationSearchQuery('');
                            setIsLocationFocused(false);
                            setShowSavedPlacesDropdown(false);
                          }}
                          className="shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-[#151f30] border border-slate-700/50 hover:border-[#5bdda6]/30 hover:bg-[#5bdda6]/5 active:bg-[#5bdda6]/15 transition-all"
                        >
                          <span className="text-lg leading-none">{displayIcon}</span>
                          <div className="text-right min-w-0 max-w-[120px]">
                            <p className="text-[13px] font-bold text-slate-200 truncate leading-tight">{place.name}</p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* زر التأكيد + زر الأماكن المحفوظة */}
          {/* زر التأكيد + زر الأماكن المحفوظة */}
          <div className="absolute bottom-0 left-0 right-0 flex z-[100] bg-[#163d30]" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 32px), 32px)' }}>
            {/* زر الأماكن المحفوظة */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                const willOpen = !showSavedPlacesDropdown;
                setShowSavedPlacesDropdown(willOpen);
                setIsLocationFocused(false);
                if (willOpen) fetchSavedPlaces();
              }}
              className="w-16 shrink-0 flex items-center justify-center bg-[#0f2922] border-r border-t border-[#34d399]/20 transition-all hover:bg-[#5bdda6]/10 h-[72px] rounded-none"
              title="الأماكن المحفوظة"
              aria-label="عرض الأماكن المحفوظة"
            >
              <Bookmark className={`w-6 h-6 transition-colors ${showSavedPlacesDropdown ? 'text-[#5bdda6] fill-[#5bdda6]/30' : 'text-[#5bdda6]/70'}`} />
            </motion.button>

            {/* زر التأكيد */}
            <motion.button
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(50);
                handleConfirm();
              }}
              disabled={!centerAddress || isCheckingService || isConfirming}
              whileTap={(!centerAddress || isCheckingService || isConfirming) ? {} : { scale: 0.98 }}
              style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
              className={`flex-auto h-[72px] rounded-none border-t border-emerald-500/20 flex items-center justify-center gap-2 text-lg font-black transition-all duration-300 touch-manipulation ${
                centerAddress && !isCheckingService && !isConfirming
                  ? 'bg-[#34d399] text-[#064e3b] hover:bg-[#2dd392] active:bg-[#10b981]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isCheckingService || isConfirming ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin ml-1" />
                  <span>{isConfirming ? 'جاري التأكيد...' : 'جاري التحقق...'}</span>
                </>
              ) : !centerAddress ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin ml-1 text-slate-500" />
                  <span>جاري تحديد العنوان...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-6 h-6 ml-1" />
                  <span className="tracking-tight">تأكيد {isPickup ? 'موقع الانطلاق' : 'الوجهة'}</span>
                </>
              )}
            </motion.button>
          </div>

        </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* نافذة حفظ الموقع */}
      <SaveLocationModal
        open={showSaveModal}
        onOpenChange={setShowSaveModal}
        address={centerAddress ? buildDescriptiveAddress(centerAddress) : ''}
        onSave={async (name, icon) => {
          if (!centerLat || !centerLng || !centerAddress) return;
          try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) return;
            const addr = buildDescriptiveAddress(centerAddress);
            if (isFav) {
              // حذف من المفضلة
              const { favorites } = useFavoritesStore.getState();
              const fav = favorites.find(f => Math.abs(f.lat - centerLat) < 0.001 && Math.abs(f.lng - centerLng) < 0.001);
              if (fav) { removeFavorite(fav.id); await supabase.from('saved_places').delete().eq('id', fav.id); }
            } else {
              const { error } = await supabase.from('saved_places').insert({
                user_id: authUser.id, name: name || 'موقع محفوظ', address: addr,
                lat: centerLat, lng: centerLng, icon, label: icon
              });
              if (!error) addFavorite({ id: `${centerLat}-${centerLng}-${Date.now()}`, name: name || 'موقع محفوظ', address: addr, lat: centerLat, lng: centerLng, icon: icon as 'home' | 'work' | 'cafe' | 'gym' | 'diwaniya' | 'carwash' | 'other', createdAt: Date.now(), color: '#22c55e' });
            }
            toast({ title: isFav ? 'محذوف من المفضلة ✅' : 'تم حفظ الموقع ✅', duration: 1500 });
          } catch (e) { console.error(e); }
        }}
      />

      {/* Side Menu */}
      <RiderSideMenu user={user} isOpen={menuOpen} onClose={() => setMenuOpen(false)} onLogout={async () => {
      await supabase.auth.signOut();
      if (navigate) {
        navigate("/auth");
      }
    }} />

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
                    {geofenceResult.isIran ? "🙏" : geofenceResult.isIsland ? "✈️🚢" : geofenceResult.isFar ? "✈️" : "🚗✨"}
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

const GoPage: React.FC<{ scheduleMode?: boolean }> = ({ scheduleMode = false }) => {
  return (
    <Suspense fallback={<SplashScreen />}>
      <GoPageContent scheduleMode={scheduleMode} />
    </Suspense>
  );
};

export default GoPage;