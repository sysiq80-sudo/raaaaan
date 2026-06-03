import React, { useEffect, useState, useCallback, lazy, Suspense, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import SplashScreen from "@/components/common/SplashScreen";
import { Navigation, Loader2, MapPin, AlertTriangle, AlertCircle, Search, Bookmark, Home, Briefcase, Star, Clock, ArrowRight, Edit2, Heart, X, Crosshair, LocateFixed } from "lucide-react";
import logo from "@/assets/logo.png";
import RiderMapHeader from "@/components/rider/RiderMapHeader";
import RiderBottomSheet from "@/components/rider/RiderBottomSheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import useRiderStore from "@/stores/riderStore";
import { useFareCalculation } from "@/hooks/useFareCalculation";
import { useOptimizedNearbyDrivers } from "@/hooks/useOptimizedNearbyDrivers";

import RiderSideMenu from "@/components/rider/RiderSideMenu";
import NetworkStatusBar from "@/components/common/NetworkStatusBar";
import { MapNetworkOverlay } from "@/components/common/MapNetworkOverlay";
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
import { useUnifiedSearch, type UnifiedSearchResult } from "@/hooks/useUnifiedSearch";

import FavoriteMarkersLayer from "@/components/rider/FavoriteMarkersLayer";
import { useFavoritesStore } from "@/stores/useFavoritesStore";
import SaveLocationModal from "@/components/rider/SaveLocationModal";
import BookingConfirmationView from "@/components/rider/BookingConfirmationView";
import { cleanArabicAddress } from "@/utils/addressCleaner";

// Performance & Enhancement hooks
import { usePerformanceMonitoring, useOperationTiming } from "@/hooks/usePerformanceMonitoring";
import { useAndroidBackButton } from "@/hooks/useAndroidBackButton";
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
interface IntermediateStop {
  id: string;
  address: string;
  location: { lat: number; lng: number } | null;
  estimatedTime?: number;
  distanceFromPrevious?: number;
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
    
    // ✅ فحص الإحداثيات: إذا كان العنوان يحتوي على أرقام فقط + فاصلة (33.4186, 43.2691)
    const coordinatePattern = /^[-+]?\d+\.?\d*\s*[،,]\s*[-+]?\d+\.?\d*$/;
    if (coordinatePattern.test(address.trim())) {
      return "نقطة محددة على الخريطة";
    }
    
    // ✅ أولاً: تنظيف العنوان من النص الإنجليزي
    const arabicOnly = cleanArabicAddress(address);
    if (!arabicOnly || !arabicOnly.trim()) return "";
    
    const parts = arabicOnly
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
    userAccuracy,
    menuOpen,
    setMenuOpen
  } = useRiderData();

  // [Android] Back button handler is defined below after handleGoBack is declared

  // Get bottom nav state from store
  const bottomNavEnabled = useRiderStore((state) => state.bottomNavEnabled);

  // Core state - must be defined before useLocationPicker
  const [currentMode, setCurrentMode] = useState<"pickup" | "dropoff" | "booking" | "stop">("pickup");

  // Location picker
  const {
    mapContainer,
    mapContainerRef,
    map,
    isLoading,
    isDragging,
    centerAddress,
    centerLat,
    centerLng,
    serviceAreaStatus,
    isCheckingService,
    mapProvider,
    mapError, // ✨ خطأ تحميل الخريطة
    setCenterAddress,
    setManualAddress, // ✨ NEW
    checkServiceArea,
    reverseGeocode,
    resetGeocodeCache,
    reattachMap, // ✅ إعادة ربط الخريطة دون reload
    setIsLoading,
  } = useLocationPicker(mapToken, userLocation, mapReloadKey, currentMode, userAccuracy);

  const pickerMapRestoreInFlightRef = useRef(false);
  const restorePickerMap = useCallback(() => {
    if (pickerMapRestoreInFlightRef.current) return;
    pickerMapRestoreInFlightRef.current = true;

    let requestedReload = false;

    const restore = () => {
      reattachMap();

      const container = mapContainerRef.current;
      const hasMapDom = !!container?.firstElementChild;

      if (!hasMapDom && !requestedReload) {
        requestedReload = true;
        setIsLoading(true);
        setMapReloadKey((prev) => prev + 1);
        return;
      }

      if (hasMapDom && map.current && window.google?.maps?.event) {
        window.google.maps.event.trigger(map.current, "resize");
        const center = map.current.getCenter?.();
        if (center) map.current.setCenter(center);
      }
    };

    window.setTimeout(restore, 0);
    window.setTimeout(restore, 180);
    window.setTimeout(() => {
      pickerMapRestoreInFlightRef.current = false;
    }, 300);
  }, [mapContainerRef, map, reattachMap, setIsLoading, setMapReloadKey]);

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

  // حالة تحميل زر الموقع
  const [isLocating, setIsLocating] = useState(false);
  // هل الخريطة متمركزة على موقع المستخدم حالياً
  const [isCenteredOnUser, setIsCenteredOnUser] = useState(false);

  // تتبع هل الخريطة متمركزة على المستخدم
  useEffect(() => {
    if (!map.current || !userLocation || !centerLat || !centerLng) {
      setIsCenteredOnUser(false);
      return;
    }
    const dist = Math.abs(centerLat - userLocation.lat) + Math.abs(centerLng - userLocation.lng);
    setIsCenteredOnUser(dist < 0.0005); // ~50 متر
  }, [centerLat, centerLng, userLocation]);

  const manualGeolocateMain = useCallback(async () => {
    // ✅ المسار السريع: userLocation متوفر من watchPosition — نقل الخريطة فوراً
    if (userLocation && map.current) {
      map.current.panTo({ lat: userLocation.lat, lng: userLocation.lng });
      smoothZoomTo(map.current, 17);
      reverseGeocode(userLocation.lat, userLocation.lng);
      return;
    }

    // ⏳ لا يوجد موقع مخزن — طلب GPS جديد مع مؤشر تحميل
    setIsLocating(true);

    try {
      // محاولة Capacitor أولاً
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Geolocation } = await import('@capacitor/geolocation');
        const perm = await Geolocation.requestPermissions();
        if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
          toast({
            title: '⚠️ إذن الموقع مرفوض',
            description: 'يرجى منح التطبيق صلاحية الوصول للموقع من الإعدادات',
            variant: 'destructive',
          });
          setIsLocating(false);
          return;
        }

        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });

        const { latitude, longitude } = position.coords;
        if (map.current) {
          map.current.panTo({ lat: latitude, lng: longitude });
          smoothZoomTo(map.current, 17);
          reverseGeocode(latitude, longitude);
        }
        setStoreUserLocation({ lat: latitude, lng: longitude } as any);
        setIsLocating(false);
        return;
      }
    } catch (capErr) {
      console.warn('Capacitor Geolocation failed, falling back to Web API:', capErr);
    }

    // Fallback: Web Geolocation API
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
          setIsLocating(false);
        },
        (error) => {
          console.warn('⚠️ Geolocation error:', error.message);
          toast({
            title: '⚠️ لا يمكن تحديد موقعك',
            description: 'يرجى تفعيل خدمة الموقع من إعدادات المتصفح',
            variant: 'destructive',
          });
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      toast({
        title: '⚠️ الموقع الجغرافي غير مدعوم',
        description: 'متصفحك لا يدعم خدمة الموقع',
        variant: 'destructive',
      });
      setIsLocating(false);
    }
  }, [map, reverseGeocode, smoothZoomTo, toast, userLocation, setStoreUserLocation]);
  const manualGeolocateBooking = useCallback(() => handleGeolocate(bookingMap, false), [handleGeolocate, bookingMap]);
  
  // Layout management - Bottom panel height tracking
  const bottomPanelRef = useRef<HTMLDivElement>(null);
  const scheduleDialogRef = useRef<{ openDialog: () => void }>(null);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(0);
  const [hasStartedDragging, setHasStartedDragging] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(true); // القائمة السفلية مفتوحة افتراضياً
  
  const [pickupLocation, setPickupLocation] = useState<LocationType | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<LocationType | null>(null);
  const [intermediateStops, setIntermediateStops] = useState<IntermediateStop[]>([]);
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
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
    if (state.preferredMode === 'dropoff' || state.preferredMode === 'pickup' || state.preferredMode === 'booking' || state.preferredMode === 'stop') {
      setCurrentMode(state.preferredMode as 'pickup' | 'dropoff' | 'booking' | 'stop');
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

  // إضافة أو إزالة المكان من المفضلة
  const handleToggleFavorite = useCallback(async (result: UnifiedSearchResult) => {
    if (!userId) {
      toast({
        title: "⚠️ يرجى تسجيل الدخول",
        description: "يجب تسجيل الدخول لتتمكن من إضافة الأماكن إلى المفضلة",
        variant: "destructive"
      });
      return;
    }

    // ابحث عن المكان في قائمة الأماكن المحفوظة الحالية
    const savedItem = supabaseSavedPlaces.find(
      (place) =>
        (result.place_id && place.id === result.place_id) ||
        (result.lat && result.lng && Math.abs(place.lat - result.lat) < 0.0001 && Math.abs(place.lng - result.lng) < 0.0001) ||
        place.address === result.description ||
        place.name === result.main_text
    );

    if (savedItem) {
      // إزالة من المفضلة
      try {
        const { error } = await supabase
          .from("saved_places")
          .delete()
          .eq("id", savedItem.id);

        if (error) throw error;

        setSupabaseSavedPlaces((prev) => prev.filter((p) => p.id !== savedItem.id));
        removeFavorite(savedItem.id);
        toast({
          title: "تمت الإزالة من المفضلة 💔",
          description: `تمت إزالة ${result.main_text} من أماكنك المفضلة`,
        });
      } catch (error: any) {
        console.error("Error removing favorite:", error);
        toast({
          title: "خطأ في الإزالة ❌",
          description: error.message || "تعذر إزالة المكان من المفضلة",
          variant: "destructive"
        });
      }
    } else {
      // إضافة إلى المفضلة
      let lat = result.lat;
      let lng = result.lng;
      let address = result.secondary_text || result.description || '';
      const name = result.main_text;

      // إذا لم تتوفر إحداثيات (نتيجة من Google مثلاً)
      if ((lat === undefined || lng === undefined) && result.place_id) {
        try {
          const placeDetails = await getPlaceDetails(result.place_id);
          if (placeDetails) {
            lat = placeDetails.lat;
            lng = placeDetails.lng;
            if (!address) address = placeDetails.address;
          }
        } catch (err) {
          console.error("Error fetching place details for favorite:", err);
        }
      }

      if (lat === undefined || lng === undefined) {
        toast({
          title: "⚠️ تعذر تحديد موقع المكان",
          description: "فشل الحصول على إحداثيات المكان لحفظه",
          variant: "destructive"
        });
        return;
      }

      try {
        const { data, error } = await supabase
          .from("saved_places")
          .insert({
            user_id: userId,
            name: name,
            label: "favorite",
            address: address,
            lat: lat,
            lng: lng,
            icon: "heart",
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          const newPlace = {
            id: data.id,
            name: data.name,
            address: data.address,
            lat: data.lat,
            lng: data.lng,
            icon: data.icon || "heart",
            label: data.label || "favorite"
          };
          setSupabaseSavedPlaces((prev) => [...prev, newPlace]);
          addFavorite({
            id: data.id,
            name: data.name,
            address: data.address,
            lat: data.lat,
            lng: data.lng,
            icon: "other",
            createdAt: Date.now()
          });
        }
        toast({
          title: "تمت الإضافة للمفضلة ❤️",
          description: `تم حفظ ${name} في أماكنك المفضلة`,
        });
      } catch (error: any) {
        console.error("Error adding favorite:", error);
        toast({
          title: "خطأ في الحفظ ❌",
          description: error.message || "تعذر حفظ المكان في المفضلة",
          variant: "destructive"
        });
      }
    }
  }, [userId, supabaseSavedPlaces, getPlaceDetails, toast, removeFavorite, addFavorite]);

  // Fare calculation
  const {
    fareBreakdown,
    fareLoading,
    fareError
  } = useFareCalculation(pickupLocation, dropoffLocation, selectedVehicle, routeDistance, routeDuration);

  // Show fare calculation error
  useEffect(() => {
    if (fareError) {
      if (fareError === "المسافة قصيرة جداً") {
        return;
      }
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

  // Fetch saved places on mount
  useEffect(() => {
    if (userId) {
      fetchSavedPlaces();
    }
  }, [userId, fetchSavedPlaces]);

  // Nearby drivers
  const {
    availableDriversByType
  } = useOptimizedNearbyDrivers(pickupLocation, selectedVehicle, {
    enableRealtime: !!pickupLocation,
    debounceMs: 1000
  });

  // Reset center address when mode changes
  useEffect(() => {
    if (currentMode === "dropoff" || currentMode === "booking" || currentMode === "stop") {
      setCenterAddress("");
    }
  }, [currentMode]);

  const applySelectedLocation = useCallback((location: LocationType) => {
    let applied = true;

    if (currentMode === 'pickup') {
      setPickupLocation(location);
      setCurrentMode(dropoffLocation ? 'booking' : 'dropoff');
    } else if (currentMode === 'stop') {
      if (!activeStopId) {
        toast({
          title: 'حدد محطة أولاً',
          description: 'اضغط على محطة من شاشة الحجز ثم اختر موقعها',
          variant: 'destructive',
        });
        applied = false;
      } else {
        setIntermediateStops((prev) =>
          prev.map((stop) =>
            stop.id === activeStopId
              ? { ...stop, address: location.address, location: { lat: location.lat, lng: location.lng } }
              : stop,
          ),
        );
        setActiveStopId(null);
        setCurrentMode(dropoffLocation ? 'booking' : 'dropoff');
      }
    } else {
      setDropoffLocation(location);
      setCurrentMode(pickupLocation ? 'booking' : 'pickup');
    }

    if (!applied) return false;

    if (map.current) {
      map.current.panTo({ lat: location.lat, lng: location.lng });
      map.current.setZoom(16);
    }

    setCenterAddress('');
    setLocationSearchQuery('');
    setSearchQuery('');
    setIsLocationFocused(false);
    setActiveCategory(null);
    return true;
  }, [currentMode, dropoffLocation, pickupLocation, activeStopId, map, toast, setSearchQuery, setCenterAddress]);

  // Track bottom panel height for map padding
  useEffect(() => {
    const updatePanelHeight = () => {
      if (bottomPanelRef.current) {
        const height = bottomPanelRef.current.offsetHeight;
        setBottomPanelHeight(height);
        
        // تطبيق padding على الخريطة
        if (mapContainerRef.current) {
          mapContainerRef.current.style.paddingBottom = "0px";
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
  }, [panelExpanded, isLocationFocused]);

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

  // Initialize booking mode map — cleanup on exit
  useEffect(() => {
    if (currentMode !== "booking" || !pickupLocation || !dropoffLocation) return;
    initializeBookingMap(pickupLocation, dropoffLocation, intermediateStops);
    // Cleanup markers when leaving booking mode
    return () => {
      cleanupBooking();
    };
  }, [currentMode, pickupLocation, dropoffLocation, intermediateStops, initializeBookingMap, cleanupBooking]);

  const previousModeRef = useRef(currentMode);
  useEffect(() => {
    const previousMode = previousModeRef.current;
    previousModeRef.current = currentMode;

    if (previousMode === "booking" && currentMode !== "booking") {
      restorePickerMap();
    }
  }, [currentMode, restorePickerMap]);

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
      // ✅ Fix 1: متغير محلي ثابت — لا يعتمد على React state الذي قد لا يتحدث فوراً
      let serviceCheckForCurrentPoint: Awaited<ReturnType<typeof checkServiceArea>> | null = null;

      const addressNeedsRefresh =
        !address ||
        address.includes("جاري تحديد العنوان") ||
        !buildDescriptiveAddress(address);

      // إذا لم نحصل على عنوان، نحصل عليه من Google Geocoding
      if (addressNeedsRefresh) {
        try {
          if (window.google?.maps && map.current) {
            // Step 1: Geocoding + checkServiceArea بالتوازي
            const geocoder = await getGeocoder();
            if (!geocoder) throw new Error('Geocoder not available');

            const [result, serviceCheckParallel] = await Promise.all([
              geocoder.geocode({ location: { lat: actualLat, lng: actualLng }, language: 'ar' }),
              checkServiceArea(actualLat, actualLng),
            ]);
            
            // ✅ تخزين في المتغير المحلي الخارجي + تحديث state للعرض
            serviceCheckForCurrentPoint = serviceCheckParallel;
            setLocalServiceAreaStatus(serviceCheckParallel);

            if (result.results && result.results.length > 0) {
              const finalAddress = result.results[0].formatted_address;

              // Step 2: POI من نتائج Geocoding (SearchNearby معطّل)
              const poiResult = result.results.find(r =>
                (r.types.includes('point_of_interest') || r.types.includes('establishment')) &&
                r.name &&
                !r.types.includes('route')
              );
              const poiName = poiResult?.name || null;

              // Step 3: بناء العنوان بـ buildHumanAddress() + serviceRegionName من DB
              const { buildHumanAddress, extractGoogleComponents } = await import('@/utils/buildHumanAddress');
              const components = result.results[0]?.address_components || [];
              const comps = extractGoogleComponents(components, poiName);

              address = buildHumanAddress({
                poiName:           comps.poiName,
                neighborhood:      comps.neighborhood,
                street:            comps.street,
                city:              comps.city,
                serviceRegionName: (serviceCheckParallel as any)?.region?.name_ar || null,
                lat:               actualLat,
                lng:               actualLng,
                formattedAddress:  finalAddress,
              }) || `${actualLat.toFixed(5)}, ${actualLng.toFixed(5)}`;

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

      if (address) setCenterAddress(address);

      // ✅ Fix 1: استخدام المتغير المحلي مباشرة — إن لم يكن معيّناً (لم يدخل addressNeedsRefresh) نطلبه الآن
      if (!serviceCheckForCurrentPoint) {
        serviceCheckForCurrentPoint = await checkServiceArea(actualLat, actualLng);
        setLocalServiceAreaStatus(serviceCheckForCurrentPoint);
      }

      // إذا الموقع خارج منطقة الخدمة — إظهار إشعار واضح
      if (serviceCheckForCurrentPoint && serviceCheckForCurrentPoint.in_service === false) {
        const modeLabel = currentMode === 'pickup' ? 'موقع الانطلاق' : currentMode === 'stop' ? 'المحطة' : 'الوجهة';
        toast({
          title: `⚠️ ${modeLabel} خارج نطاق الخدمة`,
          description: serviceCheckForCurrentPoint.nearest_city
            ? `أقرب مدينة مغطاة: ${serviceCheckForCurrentPoint.nearest_city}. حرّك الخريطة لاختيار موقع داخل منطقة الخدمة.`
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
      } else if (currentMode === "dropoff" || currentMode === "stop") {
        // فحص Geofencing قبل تحديد الوجهة
        const geofenceCheck = await checkDestinationGeofence(actualLat, actualLng, mapToken);
        
        if (!geofenceCheck.allowed) {
          // الوجهة خارج العراق - عرض رسالة
          setGeofenceResult(geofenceCheck);
          setShowGeofenceAlert(true);
          return; // إيقاف العملية
        }
        
        // الوجهة أو المحطة داخل العراق - متابعة الحجز
        if (currentMode === 'stop') {
          if (!activeStopId) {
            toast({
              title: 'حدد محطة أولاً',
              description: 'اضغط على محطة من شاشة الحجز ثم اختر موقعها',
              variant: 'destructive',
            });
            return;
          }
          setIntermediateStops((prev) =>
            prev.map((stop) =>
              stop.id === activeStopId
                ? { ...stop, address, location: { lat: actualLat, lng: actualLng } }
                : stop,
            ),
          );
          setActiveStopId(null);
          setCurrentMode(dropoffLocation ? 'booking' : 'dropoff');
        } else {
          setDropoffLocation(location);
          setCurrentMode("booking");
        }
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
  }, [currentMode, centerAddress, isConfirming, map, checkServiceArea, toast, pickupLocation, dropoffLocation, activeStopId, setCurrentMode, setSearchQuery, setMapReloadKey, setCenterAddress, buildDescriptiveAddress, mapToken]);

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
    setIntermediateStops([]);
    setActiveStopId(null);
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

    restorePickerMap();

    // إظهار toast بعد تأخير قصير
    setTimeout(() => {
      toast({
        title: "جاهز لرحلة جديدة",
        description: "يمكنك الآن طلب رحلة جديدة",
      });
    }, 300);
    
  }, [toast, restorePickerMap, cleanupBooking, setIsBooking]);

  // الانتقال لتعديل نقطة الانطلاق/الوجهة من شاشة الحجز بدون إعادة العملية من الصفر
  const startLocationEdit = useCallback((mode: "pickup" | "dropoff") => {
    // تنظيف خريطة الحجز الحالية حتى لا تتداخل مع خريطة اختيار الموقع
    cleanupBooking();

    restorePickerMap();

    // انتقال إلى وضع التعديل المطلوب
    setActiveStopId(null);
    setCurrentMode(mode);
    setSearchQuery("");
    setCenterAddress("");
  }, [cleanupBooking, restorePickerMap, setSearchQuery, setCenterAddress]);

  // ═══ رجوع بين المراحل ═══
  const handleGoBack = useCallback(() => {
    if (currentMode === "dropoff" || currentMode === "stop") {
      // Going back to pickup — clear dropoff selection
      setDropoffLocation(null);
      setCenterAddress('');
      setCurrentMode("pickup");
      setIsLocationFocused(false);
      setLocationSearchQuery('');
      clearSearch();
      // Trigger fresh geocode after map re-attaches
      resetGeocodeCache();
      setTimeout(() => {
        const center = map.current?.getCenter?.();
        if (center) reverseGeocode(center.lat(), center.lng());
      }, 300);
    } else if (currentMode === "booking") {
      // Going back to dropoff — clean up booking map & reattach main map
      cleanupBooking();
      setDropoffLocation(null);
      setCenterAddress('');
      setCurrentMode("dropoff");
      setIsLocationFocused(false);
      setRouteDistance(null);
      setRouteDuration(null);

      restorePickerMap();

      // Trigger fresh geocode after map re-attaches
      resetGeocodeCache();
      setTimeout(() => {
        const center = map.current?.getCenter?.();
        if (center) reverseGeocode(center.lat(), center.lng());
      }, 300);
    }
  }, [currentMode, clearSearch, cleanupBooking, setRouteDistance, setRouteDuration, setCenterAddress, reverseGeocode, resetGeocodeCache, restorePickerMap, map]);

  // [Android] Back button — close side menu first, handle booking stages, then navigate(-1)
  useAndroidBackButton(() => {
    if (menuOpen) {
      setMenuOpen(false);
      return true;
    }
    if (currentMode !== "pickup") {
      handleGoBack();
      return true;
    }
    return false;
  });

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
              description: `رصيد المحفظة: ${walletBalance.toLocaleString()} د.ع - الأجرة المتوقعة: ${totalFare.toLocaleString()} د.ع\nاشحن رصيدك أو اختر الدفع نقداً`,
              variant: "destructive"
            });
            setPaymentSheetOpen(true);
            setIsBooking(false);
            return;
          }
        } catch (error) {
          console.error("Wallet balance check error — blocking booking:", error);
          toast({
            title: "تعذر التحقق من الرصيد",
            description: "حدث خطأ أثناء التحقق من رصيد المحفظة، حاول مرة أخرى أو اختر الدفع نقداً",
            variant: "destructive",
          });
          setIsBooking(false);
          return;
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
        } = await (supabase.from("rides" as any).insert([{
          rider_id: userId,
          pickup_location: { lat: pickupLocation.lat, lng: pickupLocation.lng },
          dropoff_location: { lat: dropoffLocation.lat, lng: dropoffLocation.lng },
          pickup_address: pickupLocation.address,
          dropoff_address: dropoffLocation.address,
          vehicle_type: selectedVehicle,
          payment_method: mapPaymentToDb(paymentMethod),
          estimated_fare: roundFare(fareBreakdown?.total_fare || 0),
          stops: intermediateStops
            .filter((stop) => stop.location)
            .map((stop) => ({
              id: stop.id,
              lat: stop.location?.lat,
              lng: stop.location?.lng,
              address: stop.address,
            })) as Record<string, unknown>[],
          metadata: {
            final_dropoff: {
              lat: dropoffLocation.lat,
              lng: dropoffLocation.lng,
              address: dropoffLocation.address,
            },
          } as Record<string, unknown>,
          distance_km: routeDistance ? Number(routeDistance.toFixed(2)) : null,
          duration_minutes: routeDuration ? Math.round(routeDuration) : null,
          status: "pending" as const,
          trip_type: "app" as const,
          region_id: fareBreakdown?.region_id || null,
        }] as any).select().single()) as { data: any; error: any };
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
          15000,
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
            const { data: fallbackRide } = await (supabase
              .from("rides" as any)
              .select("*")
              .eq("rider_id", userId as string)
              .eq("status", "pending" as any)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()) as { data: any; error: any };

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

        logger.error("GoPage", "Booking failed", {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          status: error?.status,
        });
        showErrorToast(toast, "فشل الحجز", error?.message || "حدث خطأ غير متوقع");
      }
    } finally {
      // ✅ دائماً نُعيد تفعيل الزر بغض النظر عن أي return مبكر
      clearTimeout(bookingTimeout);
      setIsBooking(false);
    }
  };


  const isPickup = currentMode === "pickup";
  const isStopMode = currentMode === "stop";
  const isDropoff = currentMode === "dropoff";
  const isBookingMode = currentMode === "booking";
  const isCenterAddressResolving = centerAddress.includes("جاري تحديد العنوان");
  const centerAddressDisplay = isCenterAddressResolving
    ? "جاري تحديد العنوان..."
    : buildDescriptiveAddress(centerAddress);
  const hasResolvedCenterAddress = Boolean(
    centerAddress && !isCenterAddressResolving && centerAddressDisplay
  );
  const currentSelectionLabel = isPickup
    ? "موقع الانطلاق"
    : isStopMode
      ? "المحطة"
      : "الوجهة";
  const currentSelectionAddress = centerAddressDisplay || "حرّك الخريطة أو ابحث عن المكان";
  const pickupPreviewAddress = pickupLocation
    ? buildDescriptiveAddress(pickupLocation.address)
    : isPickup && centerAddress
      ? currentSelectionAddress
      : "حدد نقطة الانطلاق";
  const dropoffPreviewAddress = dropoffLocation
    ? buildDescriptiveAddress(dropoffLocation.address)
    : (isDropoff || isStopMode) && centerAddress
      ? currentSelectionAddress
      : "حدد الوجهة";
  const selectionReady = Boolean(hasResolvedCenterAddress && !isCheckingService && !isConfirming);
  const flowSteps = [
    {
      key: "pickup",
      title: "الانطلاق",
      caption: pickupLocation ? pickupPreviewAddress : "حدد نقطة البداية",
      active: isPickup,
      completed: Boolean(pickupLocation) && !isPickup,
      tone: "emerald",
    },
    {
      key: "dropoff",
      title: isStopMode ? "المحطة" : "الوصول",
      caption: dropoffLocation ? dropoffPreviewAddress : isStopMode ? "أضف محطة" : "حدد الوجهة",
      active: isDropoff || isStopMode,
      completed: Boolean(dropoffLocation) && !(isDropoff || isStopMode),
      tone: "sky",
    },
  ] as const;
  const confirmButtonLabel = `تأكيد ${currentSelectionLabel}`;

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
        <RideWaitingScreen 
          rideId={activeRide.id} 
          pickupAddress={buildDescriptiveAddress(activeRide.pickup_address || pickupLocation?.address || "موقعي الحالي")} 
          dropoffAddress={buildDescriptiveAddress(activeRide.dropoff_address || dropoffLocation?.address || "")} 
          estimatedFare={activeRide.estimated_fare || fareBreakdown?.total_fare || 0} 
          onCancel={resetBooking} 
          onDriverFound={() => {
            setShowWaitingScreen(false);
            setShowLiveTracker(true);
          }} 
        />
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
      <div className="relative h-full w-full max-w-[480px] mx-auto overflow-hidden">
        <BookingConfirmationView
          pickupLocation={pickupLocation}
          dropoffLocation={dropoffLocation}
          routeDistance={routeDistance}
          routeDuration={routeDuration}
          bookingMapContainerRef={bookingMapContainer}
          onGeolocate={manualGeolocateBooking}
          fareBreakdown={fareBreakdown}
          fareLoading={fareLoading}
          fareError={fareError}
          selectedVehicle={selectedVehicle}
          onVehicleChange={setSelectedVehicle}
          paymentMethod={paymentMethod}
          onPaymentChange={setPaymentMethod}
          isBooking={isBooking}
          onBookRide={handleBookRide}
          onEditLocation={startLocationEdit}
          intermediateStops={intermediateStops}
          onStopsChange={setIntermediateStops}
          onStopSelect={(stopId) => {
            setActiveStopId(stopId);
            setCurrentMode('stop');
          }}
          onSwapLocations={() => {
            const temp = pickupLocation;
            setPickupLocation(dropoffLocation);
            setDropoffLocation(temp);
            setIntermediateStops([]);
            toast({
              title: "تم عكس الاتجاه ✅",
              description: "تم تبديل موقع الانطلاق مع الوجهة وتم مسح المحطات الوسطية",
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
          availableDriversByType={availableDriversByType || {}}
          user={user}
          menuOpen={menuOpen}
          onMenuToggle={setMenuOpen}
          onLogout={async () => {
            await supabase.auth.signOut();
            if (navigate) navigate("/auth");
          }}
          onGoBack={handleGoBack}
        />
        
        {/* Always visible geolocate button in booking mode, styled exactly like the main one */}
        <button
          onClick={() => manualGeolocateBooking()}
          disabled={isLocating}
          className="absolute left-4 z-40 w-11 h-11 flex items-center justify-center rounded-2xl bg-[#5bdda6] border border-[#5bdda6]/30 shadow-[0_0_18px_rgba(91,221,166,0.5)] hover:bg-[#4ecf99] active:scale-95 transition-all"
          style={{ bottom: "calc(55% + 16px)" }}
          aria-label="تحديد موقعي"
          title="تحديد موقعي"
        >
          {isLocating ? (
            <Loader2 className="w-4.5 h-4.5 text-[#0b1326] animate-spin" />
          ) : (
            <LocateFixed className="w-4.5 h-4.5 text-[#0b1326]" />
          )}
        </button>
      </div>
    );
  }

  // Location picker screen
  return (
    <div className="relative h-full w-full z-10 flex flex-col bg-transparent max-w-[480px] mx-auto" dir="rtl">
      {/* Map visible wrapper — extends full screen so map shows behind bottom sheet rounded corners */}
      <div 
        className="absolute inset-0 overflow-hidden z-0"
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
            cursor: 'grab',
            backgroundColor: '#eef3f8',
          }}
        />

        {/* ✅ مؤشر حالة الشبكة فوق الخريطة */}
        <MapNetworkOverlay />


        {/* Favorite Markers Layer (Google-only) */}
        {mapProvider === "google" && map.current && !isPickup && (
          <FavoriteMarkersLayer
            map={map.current}
            onMarkerClick={(_id, lat, lng, address) => {
              if (map.current) {
                map.current.panTo({ lat, lng });
                map.current.setZoom(16);
              }
              setManualAddress(address, { lat, lng });
              checkServiceArea(lat, lng);
            }}
          />
        )}

        {/* Header — Premium floating glassmorphism */}
        <RiderMapHeader
          onMenuOpen={() => setMenuOpen(true)}
          onGoBack={!isPickup ? handleGoBack : undefined}
          stepLabel={isPickup ? undefined : isDropoff ? "الوجهة" : isStopMode ? "المحطة" : undefined}
        />






        {/* Center map pin — premium 3D glassmorphic design */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[15] -translate-x-1/2">
          <div className="relative w-0 h-0">
            {/* Address label above pin — frosted glass */}
            {(centerAddress || isDragging) && (
              <div className="absolute bottom-[82px] left-1/2 -translate-x-1/2 z-20 w-max">
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="max-w-[260px] text-center"
                  style={{ fontFamily: "Cairo, sans-serif" }}
                >
                  <div
                    className="px-4 py-2.5 rounded-2xl text-[#101828]"
                    style={{
                      background: 'rgba(255,255,255,0.92)',
                      backdropFilter: 'blur(16px) saturate(1.8)',
                      WebkitBackdropFilter: 'blur(16px) saturate(1.8)',
                      boxShadow: `0 8px 32px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.6), 0 0 0 1px ${isPickup ? 'rgba(16,185,129,0.15)' : 'rgba(6,182,212,0.15)'}`,
                      border: '1px solid rgba(255,255,255,0.7)',
                    }}
                  >
                    <p className="text-[13px] font-bold truncate leading-tight">
                      {isDragging && !centerAddressDisplay ? "حرّك الخريطة لتحديد المكان" : centerAddressDisplay}
                    </p>
                  </div>
                  {/* Small triangle pointer */}
                  <div className="flex justify-center -mt-[1px]">
                    <div style={{
                      width: 0, height: 0,
                      borderLeft: '7px solid transparent',
                      borderRight: '7px solid transparent',
                      borderTop: '7px solid rgba(255,255,255,0.92)',
                      filter: 'drop-shadow(0 2px 2px rgba(15,23,42,0.06))',
                    }} />
                  </div>
                </motion.div>
              </div>
            )}
            
            {/* Pulsing ground glow dot */}
            <div className="absolute top-[-2px] left-1/2 -translate-x-1/2">
              <motion.div
                animate={{ 
                  scale: isDragging ? [1, 1.8, 1] : [1, 1.4, 1],
                  opacity: isDragging ? [0.05, 0.2, 0.05] : [0.2, 0.4, 0.2],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="w-5 h-5 rounded-full"
                style={{
                  background: isPickup 
                    ? 'radial-gradient(circle, rgba(16,185,129,0.7), transparent 70%)'
                    : 'radial-gradient(circle, rgba(6,182,212,0.7), transparent 70%)',
                  filter: 'blur(3px)',
                }}
              />
            </div>

            {/* Lollipop Pin — circle on a stick, anchor at bottom */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-10" style={{ width: '44px', height: '80px' }}>
              <motion.div 
                animate={{ y: isDragging ? -18 : 0 }} 
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
                className="w-full h-full"
              >
                <svg 
                  viewBox="0 0 44 80"
                  className="w-full h-full"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ filter: `drop-shadow(0 4px 12px ${isPickup ? 'rgba(16,185,129,0.3)' : 'rgba(6,182,212,0.3)'}) drop-shadow(0 1px 3px rgba(15,23,42,0.15))` }}
                >
                  <defs>
                    <linearGradient id={`lolliGrad-${isPickup ? 'p' : 'd'}`} x1="22" y1="2" x2="22" y2="42" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor={isPickup ? '#34d399' : '#22d3ee'} />
                      <stop offset="100%" stopColor={isPickup ? '#059669' : '#0891b2'} />
                    </linearGradient>
                  </defs>

                  {/* Stick — thin line from circle bottom to anchor point */}
                  <line 
                    x1="22" y1="38" x2="22" y2="80" 
                    stroke={isPickup ? '#059669' : '#0891b2'} 
                    strokeWidth="3" 
                    strokeLinecap="round"
                  />

                  {/* Circle — colored ring, transparent inside */}
                  <circle 
                    cx="22" cy="22" r="17" 
                    stroke={`url(#lolliGrad-${isPickup ? 'p' : 'd'})`}
                    strokeWidth="4"
                    fill="none"
                  />
                  
                  {/* Top-left glossy highlight on ring */}
                  <path 
                    d="M12 8 A17 17 0 0 1 32 8" 
                    stroke="white" strokeOpacity="0.35" strokeWidth="2" fill="none" strokeLinecap="round"
                  />
                </svg>
              </motion.div>
            </div>
            
            {/* Ground shadow — shrinks when pin lifts */}
            <div className="absolute top-[-1px] left-1/2 -translate-x-1/2 w-5 h-2">
              <motion.div 
                animate={{ 
                  scale: isDragging ? 0.3 : 1,
                  opacity: isDragging ? 0.06 : 0.2
                }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
                className="w-full h-full rounded-full"
                style={{
                  background: `radial-gradient(ellipse, ${isPickup ? 'rgba(16,185,129,0.5)' : 'rgba(6,182,212,0.5)'}, rgba(0,0,0,0.12) 60%, transparent 80%)`,
                  filter: 'blur(2px)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Loading overlay with static map placeholder */}
        {isLoading && <StaticMapPlaceholder lat={userLocation?.lat || lastLocation?.lat} lng={userLocation?.lng || lastLocation?.lng} zoom={14} message="جاري تحميل الخريطة..." />}



      </div>

      {/* Floating save location button */}
      {centerLat && centerLng && hasResolvedCenterAddress && (
        <button
          onClick={() => setShowSaveModal(true)}
          className={`absolute left-4 z-40 w-11 h-11 flex items-center justify-center rounded-2xl border shadow-md active:scale-95 transition-all ${
            isFav
              ? 'bg-pink-500/20 border-pink-500/50 shadow-[0_0_20px_rgba(244,63,94,0.4)]'
              : 'bg-[#5bdda6] border-[#5bdda6]/30 shadow-[0_0_18px_rgba(91,221,166,0.5)] hover:bg-[#4ecf99]'
          }`}
          style={{ bottom: `${bottomPanelHeight + 80}px` }}
          aria-label={isFav ? 'إزالة من المفضلة' : 'حفظ الموقع'}
          title={isFav ? 'إزالة من المفضلة' : 'حفظ الموقع'}
        >
          <Heart
            className={`w-4.5 h-4.5 transition-all ${
              isFav ? 'text-pink-500 fill-pink-500' : 'text-[#0b1326]'
            }`}
          />
        </button>
      )}

      {/* Floating geolocate button — Google Maps style My Location */}
      <button
        onClick={() => manualGeolocateMain()}
        disabled={isLocating}
        className="absolute left-4 z-40 w-11 h-11 flex items-center justify-center rounded-2xl bg-[#5bdda6] border border-[#5bdda6]/30 shadow-[0_0_18px_rgba(91,221,166,0.5)] hover:bg-[#4ecf99] active:scale-95 transition-all"
        style={{ bottom: `${bottomPanelHeight + 28}px` }}
        aria-label="تحديد موقعي"
        title="تحديد موقعي"
      >
        {isLocating ? (
          <Loader2 className="w-4.5 h-4.5 text-[#0b1326] animate-spin" />
        ) : (
          <LocateFixed className="w-4.5 h-4.5 text-[#0b1326]" />
        )}
      </button>

      {/* ═══ Bottom Sheet — Clean white design ═══ */}
      <RiderBottomSheet
        ref={bottomPanelRef}
        isFullScreen={isLocationFocused}
        className={
          isLocationFocused
            ? ""
            : panelExpanded
            ? "!max-h-[40dvh]"
            : "!max-h-[13dvh] overflow-hidden"
        }
        onClose={() => {
          if (isLocationFocused) {
            setIsLocationFocused(false);
            setPanelExpanded(true);
          } else if (panelExpanded) {
            setPanelExpanded(false);
          }
        }}
        onExpand={() => {
          if (!isLocationFocused && !panelExpanded) {
            setPanelExpanded(true);
          } else if (!isLocationFocused && panelExpanded) {
            setIsLocationFocused(true);
          }
        }}
      >
        {/* ═══ Header Section (Fixed at top) ═══ */}
        <div className="shrink-0 px-4 pt-1.5 pb-3.5 flex flex-col gap-3 border-b border-border/10 bg-card/95 backdrop-blur-md">
          {/* Pickup summary — ملخص الانطلاق في شاشة الوجهة (مضغوط) */}
          {!isLocationFocused && !isPickup && pickupLocation && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-card border border-border/30 shadow-sm">
              <div className="w-6 h-6 rounded-md bg-emerald-500/15 flex items-center justify-center shrink-0">
                <Navigation className="w-3 h-3 text-emerald-500" />
              </div>
              <p className="flex-1 min-w-0 text-sm font-semibold text-foreground truncate">
                <span className="text-emerald-500 font-bold">الانطلاق من: </span>
                {buildDescriptiveAddress(pickupLocation.address)}
              </p>
              <button
                onClick={() => {
                  setCurrentMode('pickup');
                  setIsLocationFocused(false);
                }}
                className="shrink-0 px-2 py-1 rounded-md text-xs font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 active:scale-95 transition-all"
              >
                تعديل
              </button>
            </div>
          )}

          {/* Search input + close button */}
          <div className="relative flex items-center gap-2.5">
            <div className="flex-1 min-w-0">
              <DynamicSearchHeader
                query={locationSearchQuery}
                onQueryChange={(v) => {
                  setLocationSearchQuery(v);
                  setSearchQuery(v);
                  if (v) setIsLocationFocused(true);
                  if (!v) setActiveCategory(null);
                }}
                onClear={() => {
                  setLocationSearchQuery('');
                  clearSearch();
                  setIsLocationFocused(true);
                  setActiveCategory(null);
                }}
                isSearching={isSearching}
                isOffline={searchOffline}
                placeholder={isPickup ? 'ابحث عن موقع الانطلاق...' : isStopMode ? 'ابحث عن المحطة...' : 'ابحث عن الوجهة...'}
                onFocus={() => {
                  setIsLocationFocused(true);
                  setPanelExpanded(true);
                }}
                showAddress={!locationSearchQuery && centerAddress ? currentSelectionAddress : undefined}
                onAddressClick={() => {
                  if (!centerAddress || centerAddress.includes('بدون اسم') || centerAddress.includes('غير مفعل')) {
                    manualGeolocateMain();
                  } else {
                    setIsLocationFocused(true);
                  }
                }}
                onCurrentLocation={() => manualGeolocateMain()}
                onSaveLocation={() => {
                  if (hasResolvedCenterAddress && centerLat && centerLng) setShowSaveModal(true);
                }}
                isFavorite={!!isFav}
                onClearAddress={() => {
                  setCenterAddress('');
                  setManualAddress('');
                  setLocationSearchQuery('');
                  setSearchQuery('');
                  setLocalServiceAreaStatus(null);
                }}
                voiceSupported={voiceSupported}
                voiceState={voiceState}
                onVoiceToggle={toggleListening}
                voiceTranscript={voiceTranscript}
              />
            </div>
            {/* زر الإغلاق — يظهر فقط عند البحث الكامل ومحاذي للوسط تماماً بجانب صندوق البحث الفاخر */}
            {isLocationFocused && (
              <button
                onClick={() => {
                  setIsLocationFocused(false);
                  setLocationSearchQuery('');
                  clearSearch();
                  setActiveCategory(null);
                  setPanelExpanded(true);
                }}
                className="flex-shrink-0 w-11 h-11 rounded-2xl bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.4)] hover:bg-red-600 active:bg-red-700 active:scale-90 flex items-center justify-center transition-all"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
        </div>


          {/* Search results */}
          {isLocationFocused && (
            <div className="px-4 pb-3">
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
                nearbyLandmarks={unified.getNearbyLandmarks(5).filter(lm => {
                  const isSaved = supabaseSavedPlaces.some(place =>
                    (lm.lat && lm.lng && Math.abs(place.lat - lm.lat) < 0.0001 && Math.abs(place.lng - lm.lng) < 0.0001) ||
                    place.name === lm.main_text
                  );
                  const isRecent = recentSearches.some(recent =>
                    (lm.lat && lm.lng && Math.abs(recent.lat - lm.lat) < 0.0001 && Math.abs(recent.lng - lm.lng) < 0.0001) ||
                    recent.mainText === lm.main_text
                  );
                  return !isSaved && !isRecent;
                })}
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
                  const geofenceCheck = await checkDestinationGeofence(placeDetails.lat, placeDetails.lng, mapToken ?? undefined);
                  if (!geofenceCheck.allowed) {
                    setGeofenceResult(geofenceCheck);
                    setShowGeofenceAlert(true);
                    return;
                  }
                  const location: LocationType = {
                    lat: placeDetails.lat,
                    lng: placeDetails.lng,
                    address: placeDetails.name || placeDetails.address,
                  };
                  applySelectedLocation(location);
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

                  const geofenceCheck = await checkDestinationGeofence(selectedLat, selectedLng, mapToken ?? undefined);
                  if (!geofenceCheck.allowed) {
                    setGeofenceResult(geofenceCheck);
                    setShowGeofenceAlert(true);
                    return;
                  }

                  const location: LocationType = { lat: selectedLat, lng: selectedLng, address: selectedAddress };
                  applySelectedLocation(location);
                }}
                onSelectRecent={async (search) => {
                  const geofenceCheck = await checkDestinationGeofence(search.lat, search.lng, mapToken ?? undefined);
                  if (!geofenceCheck.allowed) {
                    setGeofenceResult(geofenceCheck);
                    setShowGeofenceAlert(true);
                    return;
                  }
                  const location: LocationType = { lat: search.lat, lng: search.lng, address: search.address };
                  applySelectedLocation(location);
                }}
                onSelectSmart={async (suggestion) => {
                  if (suggestion.lat && suggestion.lng) {
                    const geofenceCheck = await checkDestinationGeofence(suggestion.lat, suggestion.lng, mapToken ?? undefined);
                    if (!geofenceCheck.allowed) {
                      setGeofenceResult(geofenceCheck);
                      setShowGeofenceAlert(true);
                      return;
                    }
                    const location: LocationType = { lat: suggestion.lat, lng: suggestion.lng, address: suggestion.title };
                    applySelectedLocation(location);
                  }
                }}
                onSelectSavedPlace={async (place) => {
                  const geofenceCheck = await checkDestinationGeofence(place.lat, place.lng, mapToken ?? undefined);
                  if (!geofenceCheck.allowed) {
                    setGeofenceResult(geofenceCheck);
                    setShowGeofenceAlert(true);
                    return;
                  }
                  const location: LocationType = { lat: place.lat, lng: place.lng, address: place.name || place.address };
                  applySelectedLocation(location);
                }}
                onRemoveRecent={removeRecentSearch}
                onClearRecent={clearAllSearches}
                maxResults={6}
                maxRecentResults={3}
                onClose={() => setIsLocationFocused(false)}
                onToggleFavorite={handleToggleFavorite}
                className="border-none shadow-none bg-transparent max-h-none mt-0 overflow-visible"
              />
            </div>
          )}

          {/* Service area warning */}
          {localServiceAreaStatus && !localServiceAreaStatus.in_service && (
            <div className="mx-4 my-3 flex items-center gap-3 p-3 rounded-2xl bg-destructive/5 border border-destructive/15">
              <div className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-destructive text-sm">خارج منطقة الخدمة</p>
                {localServiceAreaStatus.nearest_region && (
                  <p className="text-muted-foreground text-xs mt-0.5">
                    أقرب منطقة: {localServiceAreaStatus.nearest_region.name_ar} ({localServiceAreaStatus.nearest_region.distance_km} كم)
                  </p>
                )}
              </div>
            </div>
          )}


        {/* CTA Button — hidden when search focused; user confirms by selecting a suggestion */}
        {!isLocationFocused && (
        <div
          className="shrink-0 w-full pointer-events-auto bg-card border-t border-white/[0.06] relative z-[10]"
          style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}
        >
          <div className="flex items-stretch h-[58px]">
            <motion.button
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(50);
                handleConfirm();
              }}
              disabled={!hasResolvedCenterAddress || isCheckingService || isConfirming}
              whileTap={(!hasResolvedCenterAddress || isCheckingService || isConfirming) ? {} : { scale: 0.98 }}
              style={{ fontFamily: "Cairo, sans-serif" }}
              className={`flex-1 h-full flex items-center justify-center gap-2 text-[15px] font-black touch-manipulation transition-all ${
                selectionReady
                  ? isPickup
                    ? 'text-[#070b13] bg-[#5bdda6] shadow-[0_-4px_20px_rgba(91,221,166,0.2)] hover:bg-[#4ecf99] active:bg-[#34d399] border-t border-[#5bdda6]'
                    : 'text-[#083344] bg-cyan-400 shadow-[0_-4px_20px_rgba(34,211,238,0.2)] hover:bg-cyan-500 active:bg-cyan-600 border-t border-cyan-400'
                  : isPickup
                    ? 'text-white/40 bg-[#0a111c] border-t border-white/[0.07] cursor-not-allowed'
                    : 'text-white/40 bg-[#0a111c] border-t border-white/[0.07] cursor-not-allowed'
              }`}
            >
              {isCheckingService || isConfirming ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{isConfirming ? 'جاري التأكيد...' : 'جاري التحقق...'}</span>
                </>
              ) : !hasResolvedCenterAddress ? (
                <>
                  {isCenterAddressResolving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{isCenterAddressResolving ? 'جاري تحديد العنوان...' : isPickup ? 'حدد مكان الانطلاق' : 'حدد مكان الوصول'}</span>
                </>
              ) : (
                <>
                  <Navigation className="w-5 h-5" />
                  <span>{confirmButtonLabel}</span>
                </>
              )}
            </motion.button>
          </div>
        </div>
        )}
      </RiderBottomSheet>

      {/* نافذة حفظ الموقع */}
      <SaveLocationModal
        open={showSaveModal}
        onOpenChange={setShowSaveModal}
        address={hasResolvedCenterAddress ? centerAddressDisplay : ''}
        onSave={async (name, icon) => {
          if (!centerLat || !centerLng || !hasResolvedCenterAddress) return;
          try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) return;
            const addr = centerAddressDisplay;
            if (isFav) {
              const { favorites } = useFavoritesStore.getState();
              const fav = favorites.find(f => Math.abs(f.lat - centerLat) < 0.001 && Math.abs(f.lng - centerLng) < 0.001);
                if (fav) { removeFavorite(fav.id); await (supabase.from('saved_places' as any).delete().eq('id', fav.id as any)); }
            } else {
              const { error } = await (supabase.from('saved_places' as any).insert({
                user_id: authUser.id, name: name || 'موقع محفوظ', address: addr,
                lat: centerLat, lng: centerLng, icon, label: icon
              } as any) as any);
              if (!error) addFavorite({ id: `${centerLat}-${centerLng}-${Date.now()}`, name: name || 'موقع محفوظ', address: addr, lat: centerLat, lng: centerLng, icon: icon as 'home' | 'work' | 'cafe' | 'gym' | 'diwaniya' | 'carwash' | 'other', createdAt: Date.now(), color: '#22c55e' });
            }
            toast({ title: isFav ? 'محذوف من المفضلة ✅' : 'تم حفظ الموقع ✅', duration: 1500 });
          } catch (e) { console.error(e); }
        }}
      />

      {/* Side Menu */}
      <RiderSideMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} onLogout={async () => {
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
