import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import SplashScreen from "@/components/common/SplashScreen";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { User, Session } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { useDriverNotifications } from "@/hooks/useDriverNotifications";
import { isNativePlatform } from "@/lib/capacitorBridge";
import { RideRequestCard } from "@/components/driver/RideRequestCard";
import { ActiveRideCard } from "@/components/driver/ActiveRideCard";
import { DriverMap } from "@/components/driver/DriverMap";
import { DemandHeatMap } from "@/components/driver/DemandHeatMap";
import DriverQuickStats from "@/components/driver/DriverQuickStats";
import { RecentRides } from "@/components/driver/RecentRides";
import { NotificationSetup } from "@/components/driver/NotificationSetup";
import { NotificationsBell } from "@/components/driver/NotificationsBell";
import DutyToggle from "@/components/driver/DutyToggle";
import { FloatingTripBubble } from "@/components/driver/FloatingTripBubble";
import { RewardsSidePanel } from "@/components/driver/RewardsSidePanel";
import { ExternalNavigationModal } from "@/components/driver/ExternalNavigationModal";
import DriverSideMenu from "@/components/driver/DriverSideMenu";
import { initAudioContext, cleanupAudioContext } from "@/lib/audioContext";
import { useDriverStore } from "@/stores/driverStore";
import logo from "@/assets/logo.png";
import { useWakeLock } from "@/hooks/useWakeLock";
import { startRideAlert, stopRideAlert } from "@/lib/loudAlerts";
import { acceptRideFromNotification } from "@/services/driverNotificationService";
import { saveLastKnownLocation, getLastKnownLocation } from "@/services/lastKnownLocationService";
import { MapNetworkOverlay } from "@/components/common/MapNetworkOverlay";
import { useNotificationRouter } from "@/hooks/useNotificationRouter";
import { useRealtimeRideEvents } from "@/hooks/useRealtimeRideEvents";
import {
  Menu,
  X,
  LogOut,
  Gift,
  Bell,
  Smartphone,
  Lock,
  LockOpen,
} from "lucide-react";

// ✅ حساب المسافة بين نقطتين — يمنع re-render إذا لم يتحرك السائق
const hasMoved = (
  prev: { lat: number; lng: number } | null,
  next: { lat: number; lng: number },
  thresholdMeters: number
): boolean => {
  if (!prev) return true; // أول موقع
  const R = 6371000; // نصف قطر الأرض بالمتر
  const dLat = ((next.lat - prev.lat) * Math.PI) / 180;
  const dLng = ((next.lng - prev.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((prev.lat * Math.PI) / 180) *
      Math.cos((next.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return distance >= thresholdMeters;
};

const DriverHome = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [vehicleType, setVehicleType] = useState<string | null>(null);
  const [driverStatus, setDriverStatus] = useState<string | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [driverPhone, setDriverPhone] = useState<string | null>(null);
  const [driverProfileImage, setDriverProfileImage] = useState<string | null>(
    null
  );
  const [isDriverRegistered, setIsDriverRegistered] = useState<boolean | null>(
    null
  );
  // ✅ تهيئة من آخر موقع مخزن لعرض فوري بدون انتظار GPS
  const cachedLoc = getLastKnownLocation();
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(cachedLoc ? { lat: cachedLoc.lat, lng: cachedLoc.lng } : null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showNavigationModal, setShowNavigationModal] = useState(false);
  const [navigationDestination, setNavigationDestination] = useState<{ lat: number; lng: number } | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [riderName, setRiderName] = useState<string>("الراكب");
  const [riderRating, setRiderRating] = useState<number | undefined>(undefined);
  const [riderPhone, setRiderPhone] = useState<string | null>(null);
  const [locationTracking, setLocationTracking] = useState(false);
  const [onlineToggleLoading, setOnlineToggleLoading] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [hasActiveRide, setHasActiveRide] = useState(false);
  // Phase 7: تتبع معرّف الرحلة النشطة لـ useRealtimeRideEvents
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [hasRideRequest, setHasRideRequest] = useState(false);
  const [rideAcceptedTrigger, setRideAcceptedTrigger] = useState(0);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancellingRide, setIsCancellingRide] = useState(false);
  const [highlightRideId, setHighlightRideId] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const locationUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const lastRenderedLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const [rating, setRating] = useState(5.0);
  const [isProfileComplete, setIsProfileComplete] = useState(true);
  const [adminActivated, setAdminActivated] = useState(true);
  const [maxPickupRadius, setMaxPickupRadius] = useState(10);
  const lastRideRequestNotifiedAtRef = useRef<number>(0);

  const { routeNotification } = useNotificationRouter({
    nodeId: "driver",
  });

  // Phase 7: deduplication للرحلة النشطة عبر Lamport timestamps
  useRealtimeRideEvents({
    rideId: activeRideId,
    nodeId: "driver",
    onRideCompleted: () => {
      setHasActiveRide(false);
      setActiveRideId(null);
      routeNotification("ride-completed", { driverId, occurredAt: Date.now() });
    },
    onRideCancelled: () => {
      setHasActiveRide(false);
      setActiveRideId(null);
    },
  });
  // Stable callback لمنع إعادة إنشاء subscriptions في RideRequestCard
  const handleRideRequestVisible = useCallback((visible: boolean) => {
    setHasRideRequest(visible);
  }, []);
  const handleRideAccepted = useCallback(() => {
    console.log("[DriverHome] Ride accepted — triggering ActiveRideCard refresh");
    setIsPaused(false);
    setHasActiveRide(true);
    setRideAcceptedTrigger(prev => prev + 1);
  }, []);

  // 🔒 Driver Mode — منع التمرير على مستوى الصفحة
  useEffect(() => {
    document.body.classList.add('driver-mode');
    return () => document.body.classList.remove('driver-mode');
  }, []);

  // 🔊 تهيئة AudioContext عند أول تفاعل مستخدم (click/tap)
  // هذا يضمن جاهزية الصوت حتى قبل ضغط "Go Online"
  useEffect(() => {
    const handleFirstInteraction = () => {
      initAudioContext();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
    document.addEventListener('click', handleFirstInteraction, { once: true });
    document.addEventListener('touchstart', handleFirstInteraction, { once: true });
    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  // تحديث حالة البحث بناءً على حالة السائق
  useEffect(() => {
    // السائق يبحث عن طلبات عندما يكون متصلاً وغير مشغول وليس لديه رحلة نشطة
    setIsSearching(isOnline && !isPaused && !hasActiveRide);
  }, [isOnline, isPaused, hasActiveRide]);

  // دمج المرحلة 7: إشعار ذكي عند ظهور طلب رحلة جديد
  useEffect(() => {
    if (!hasRideRequest || !isOnline || isPaused) return;

    // حماية إضافية لمنع إعادة الإشعار بشكل متكرر خلال فترة قصيرة.
    const now = Date.now();
    if (now - lastRideRequestNotifiedAtRef.current < 5000) return;
    lastRideRequestNotifiedAtRef.current = now;

    routeNotification("new-ride-request", {
      driverId,
      occurredAt: now,
    });
  }, [hasRideRequest, isOnline, isPaused, driverId, routeNotification]);

  // إلغاء الرحلة من FloatingTripBubble
  const handleCancelRideFromBubble = async () => {
    if (!driverId || isCancellingRide) return;
    setIsCancellingRide(true);
    try {
      const { data: rides } = await supabase
        .from("rides")
        .select("id, status")
        .eq("driver_id", driverId)
        .in("status", ["accepted", "arrived", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (!rides || rides.length === 0) {
        toast({ title: "لا توجد رحلة نشطة", variant: "destructive" });
        setShowCancelConfirm(false);
        return;
      }

      // منع إلغاء رحلة قيد التنفيذ
      if (rides[0].status === 'in_progress') {
        toast({ title: "لا يمكن إلغاء رحلة قيد التنفيذ", description: "يجب إكمال الرحلة أولاً", variant: "destructive" });
        setShowCancelConfirm(false);
        return;
      }

      const { error } = await supabase
        .from("rides" as any)
        .update({
          status: "cancelled",
          cancelled_by: "driver",
          cancellation_reason: "ألغى السائق الرحلة",
        } as any)
        .eq("id", rides[0].id);

      if (error) throw error;

      setHasActiveRide(false);
      setIsMinimized(false);
      toast({ title: "تم إلغاء الرحلة", variant: "destructive" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setIsCancellingRide(false);
      setShowCancelConfirm(false);
    }
  };

  // 🔒 قفل الشاشة — يمنع إطفاء الشاشة أثناء القيادة
  const { isWakeLockActive, requestWakeLock, releaseWakeLock } = useWakeLock();

  // Enable real-time notifications for new rides
  // إيقاف الإشعارات عند وضع الإيقاف المؤقت، وتمرير الموقع ونصف القطر للفلترة المحلية
  const { notificationPermission, requestNotificationPermission } =
    useDriverNotifications(
      isOnline && !isPaused ? driverId : null, 
      vehicleType,
      currentLocation,
      maxPickupRadius
    );

  const clearDriverNotificationParams = useCallback(() => {
    const params = new URLSearchParams(location.search);
    const hadNotificationParams = params.has("ride_id") || params.has("accept_ride") || params.has("action");
    if (!hadNotificationParams) return;

    params.delete("ride_id");
    params.delete("accept_ride");
    params.delete("action");

    const nextSearch = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true }
    );
  }, [location.pathname, location.search, navigate]);

  const handleDeepLinkResolved = useCallback((rideId: string, found: boolean) => {
    if (highlightRideId !== rideId) return;

    if (!found) {
      toast({
        title: "⚠️ الطلب لم يعد متاحاً",
        description: "ربما تم قبوله من سائق آخر",
        variant: "destructive",
      });
    }

    setHighlightRideId(null);
  }, [highlightRideId, toast]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const rideId = params.get("ride_id") || params.get("accept_ride");
    const actionParam = params.get("action");

    if (!rideId || !driverId) return;

    let isCancelled = false;
    const action = actionParam || (params.get("accept_ride") ? "accept" : "open_request");

    const run = async () => {
      if (action === "accept") {
        const accepted = await acceptRideFromNotification(rideId, driverId);
        if (isCancelled) return;

        if (accepted) {
          try {
            stopRideAlert();
          } catch {
            // noop
          }

          toast({
            title: "✅ تم قبول الرحلة",
            description: "تم تحويل الطلب إليك بنجاح",
          });
          setRideAcceptedTrigger((prev) => prev + 1);
          setIsPaused(false);
        } else {
          toast({
            title: "⚠️ الطلب لم يعد متاحاً",
            description: "ربما تم قبوله من سائق آخر",
            variant: "destructive",
          });
        }

        clearDriverNotificationParams();
        setHighlightRideId(null);
        return;
      }

      const { data: ride, error } = await supabase
        .from("rides")
        .select("id, status")
        .eq("id", rideId)
        .maybeSingle();

      if (isCancelled) return;

      if (!error && ride?.status === "pending") {
        setHighlightRideId(rideId);
      } else {
        toast({
          title: "⚠️ الطلب لم يعد متاحاً",
          description: "تم إغلاق الطلب أو قبوله من سائق آخر",
          variant: "destructive",
        });
        setHighlightRideId(null);
      }

      clearDriverNotificationParams();
    };

    run().catch((error) => {
      console.error("Driver deep link handling error:", error);
      if (!isCancelled) {
        toast({
          title: "خطأ في فتح الطلب",
          description: "تعذر معالجة رابط الإشعار",
          variant: "destructive",
        });
        clearDriverNotificationParams();
        setHighlightRideId(null);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [location.search, driverId, clearDriverNotificationParams, toast]);

  // Auto-request notification permission on first load for approved drivers
  useEffect(() => {
    const autoRequestNotifications = async () => {
      // Only for approved drivers who haven't been asked yet
      if (!driverId || driverStatus !== "approved") return;
      if (typeof window === "undefined") return;
      try {
        if (typeof Notification === 'undefined' || Notification.permission !== "default") return;
      } catch { return; }

      // Check if already shown before (using localStorage)
      const hasAskedBefore = localStorage.getItem(`notification_asked_${driverId}`);
      if (hasAskedBefore) return;

      // Wait a bit for better UX (2 seconds after load)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mark as asked
      localStorage.setItem(`notification_asked_${driverId}`, "true");

      // Request permission
      try {
        await requestNotificationPermission();
      } catch (error) {
        console.error("Auto notification request error:", error);
      }
    };

    autoRequestNotifications();
  }, [driverId, driverStatus, requestNotificationPermission]);

  // Location ref for stable reference in interval
  const latestLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  const driverIdRef = useRef(driverId);
  driverIdRef.current = driverId;
  const driverStatusRef = useRef(driverStatus);
  driverStatusRef.current = driverStatus;
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const hasActiveRideRef = useRef(hasActiveRide);
  hasActiveRideRef.current = hasActiveRide;

  // Update driver location in database with retry
  const updateDriverLocation = useCallback(
    async (lat: number, lng: number) => {
      if (!driverId || (!isOnline && !hasActiveRide)) return;

      // Round to 6 decimal places (precision: ~0.1 meters)
      // Higher precision than usual for accurate location tracking
      const preciseLat = Math.round(lat * 1000000) / 1000000;
      const preciseLng = Math.round(lng * 1000000) / 1000000;

      let retries = 3;
      while (retries > 0) {
        try {
          const { error } = await supabase
            .from("drivers")
            .update({
              current_location: { lat: preciseLat, lng: preciseLng },
              // لا نعدل is_available هنا - يتم التحكم بها عبر handlePauseToggle فقط
              updated_at: new Date().toISOString(),
            })
            .eq("id", driverId);

          if (error) throw error;
          console.log("📍 Location updated (Real-time):", { lat: preciseLat, lng: preciseLng });
          // ⚡ البث للراكب يتم عبر ActiveRideCard (قناة مشتركة subscribed)
          // لا نبث هنا لأنه ينتج قناة غير مشتركة وتسبب تحذير REST fallback
          return;
        } catch (error) {
          console.error(
            `Location update failed, retries left: ${retries - 1}`,
            error
          );
          retries--;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    },
    [driverId, isOnline, hasActiveRide]
  );

  // Start location tracking with fixed closure
  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      toast({
        title: "تحديد الموقع غير متاح",
        description: "يرجى تفعيل GPS من إعدادات الجهاز",
        variant: "destructive",
      });
      return;
    }

    // Get initial position and update immediately
    // إعدادات GPS صارمة مع fallback لدقة أقل
    const gpsOptions = { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation = { lat: latitude, lng: longitude };
        setCurrentLocation(newLocation);
        latestLocationRef.current = newLocation;
        updateDriverLocation(latitude, longitude);
      },
      (error) => {
        console.error("Geolocation error (high accuracy):", error);
        // إذا فشل الـ GPS الدقيق، نحاول بدقة أقل لضمان عمل التطبيق
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const newLocation = { lat: latitude, lng: longitude };
            setCurrentLocation(newLocation);
            latestLocationRef.current = newLocation;
            updateDriverLocation(latitude, longitude);
            console.log('GPS fallback (low accuracy) succeeded');
          },
          (fallbackError) => {
            console.error("Geolocation fallback also failed:", fallbackError);
            toast({
              title: "⚠️ خطأ GPS",
              description: "تفعيل الموقع مطلوب",
              variant: "locationError" as any,
              duration: 3000,
            });
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 }
        );
      },
      gpsOptions
    );

    // Watch position changes with throttle
    let lastUpdateTime = 0;
    let lastUiUpdateTime = 0;
    const MIN_UPDATE_INTERVAL = 10000; // 10 ثوان
    const UI_UPDATE_INTERVAL = 5000; // تحديث الواجهة كل 5 ثوانٍ كحد أقصى — مع شرط التحرك > 10 متر

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading, speed } = position.coords;
        const newLocation = { lat: latitude, lng: longitude, heading, speed };
        
        latestLocationRef.current = newLocation as any;
        
        // ✅ تحديث driverStore مباشرة عبر ref — بدون setState = بدون re-render
        useDriverStore.getState().setLocation(newLocation as any);
        
        const now = Date.now();
        
        // 1. Throttle + Distance gate: تحديث الواجهة فقط إذا تحرك > 10 متر أو كل 5 ثوان
        const moved = hasMoved(lastRenderedLocationRef.current, newLocation, 10);
        if (moved && now - lastUiUpdateTime >= UI_UPDATE_INTERVAL) {
          lastUiUpdateTime = now;
          lastRenderedLocationRef.current = newLocation;
          setCurrentLocation(newLocation as any);
          // ✅ حفظ آخر موقع معروف للاستخدام عند فقدان النت
          saveLastKnownLocation(latitude, longitude);
        }
        
        // 2. Throttle: تحديث قاعدة البيانات (الأساسي الموجود سابقاً)
        if (now - lastUpdateTime >= MIN_UPDATE_INTERVAL) {
          lastUpdateTime = now;
          updateDriverLocation(latitude, longitude);
        }
      },
      (error) => console.error("Watch position error:", error),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 } as any
    );

    watchIdRef.current = watchId;

    // Fallback: تحديث كل 15 ثانية كحد أدنى للحالات التي لا يتحرك فيها GPS
    const intervalId = setInterval(() => {
      if (latestLocationRef.current) {
        updateDriverLocation(
          latestLocationRef.current.lat,
          latestLocationRef.current.lng
        );
      }
    }, 15000);

    locationUpdateIntervalRef.current = intervalId;
    setLocationTracking(true);
  }, [updateDriverLocation, toast]);

  // Stop location tracking
  const stopLocationTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (locationUpdateIntervalRef.current) {
      clearInterval(locationUpdateIntervalRef.current);
      locationUpdateIntervalRef.current = null;
    }
    setLocationTracking(false);
  }, []);

  useEffect(() => {
    let initialized = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      // فقط عند SIGNED_IN أو TOKEN_REFRESHED — لا نكرر عند INITIAL_SESSION
      if (session?.user && event !== "INITIAL_SESSION") {
        fetchDriverData(session.user.id);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user && !initialized) {
        initialized = true;
        fetchDriverData(session.user.id);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      stopLocationTracking();
      cleanupAudioContext();
    };
  }, [stopLocationTracking]);

  // Start/stop tracking based on online status
  useEffect(() => {
    if ((isOnline || hasActiveRide) && driverId) {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }
  }, [isOnline, hasActiveRide, driverId, startLocationTracking, stopLocationTracking]);

  // 💓 Heartbeat — نبض كل 30 ثانية لمنع الجلسات الشبحية
  useEffect(() => {
    if (!isOnline || !driverId) {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      return;
    }

    const sendHeartbeat = async () => {
      try {
        await supabase
          .from("drivers")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", driverId);
      } catch (err) {
        console.error("Heartbeat error:", err);
      }
    };

    // نبضة فورية عند الاتصال
    sendHeartbeat();

    heartbeatRef.current = setInterval(sendHeartbeat, 30000);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [isOnline, driverId]);

  // 🚪 beforeunload — ضبط offline عند إغلاق التبويب (ويب فقط)
  // على المنصات الأصلية (Android/iOS) لا نريد هذا — السائق يبقى online
  // ليتلقى إشعارات FCM حتى مع إغلاق الشاشة
  useEffect(() => {
    if (!driverId || isNativePlatform) return;

    const handleBeforeUnload = () => {
      if (!isOnline) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!supabaseUrl || !supabaseKey) return;

      const url = `${supabaseUrl}/rest/v1/drivers?id=eq.${driverId}`;
      const body = JSON.stringify({
        is_online: false,
        is_available: false,
        updated_at: new Date().toISOString(),
      });

      // sendBeacon with anon key (best-effort on tab close, user token may be expired)
      try {
        const sent = navigator.sendBeacon?.(
          url,
          new Blob([body], { type: 'application/json' })
        );
        if (!sent) {
          fetch(url, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Prefer": "return=minimal",
            },
            body,
            keepalive: true,
          });
        }
      } catch {
        // صامت — أفضل جهد
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [driverId, isOnline]);

  // 🔄 مزامنة driverStore مع الحالة المحلية
  // ✅ currentLocation أُزيل من الـ deps — setLocation يتم عبر ref في watchPosition
  useEffect(() => {
    const store = useDriverStore.getState();
    store.setOnline(isOnline);
    store.setAvailable(isOnline && !isPaused);
  }, [isOnline, isPaused]);

  // عند وجود رحلة نشطة: إلغاء وضع "مشغول" تلقائياً
  // يُعالج حالة التعارض بين تحميل بيانات السائق (is_available=false) وتحميل الرحلة النشطة
  useEffect(() => {
    if (hasActiveRide && isPaused) {
      setIsPaused(false);
    }
  }, [hasActiveRide, isPaused]);

  // Track active ride status to keep location updates while on trip
  useEffect(() => {
    if (!driverId) return;

    const fetchActiveRideStatus = async () => {
      const { data } = await supabase
        .from("rides")
        .select("id, status")
        .eq("driver_id", driverId)
        .in("status", ["accepted", "arrived", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1);

      const hasRide = !!(data && data.length > 0);
      setHasActiveRide(hasRide);
      // Phase 7: حفظ معرّف الرحلة النشطة لـ useRealtimeRideEvents
      setActiveRideId(hasRide ? (data![0].id as string) : null);
    };

    fetchActiveRideStatus();

    const channel = supabase
      .channel(`driver_active_ride_${driverId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rides",
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          const status = (payload.new as any)?.status || (payload.old as any)?.status;
          if (["accepted", "arrived", "in_progress"].includes(status)) {
            setHasActiveRide(true);
            // Phase 7: استخراج معرّف الرحلة من الـ payload
            const rideId = (payload.new as any)?.id as string | undefined;
            if (rideId) setActiveRideId(rideId);
          } else {
            setActiveRideId(null);
            fetchActiveRideStatus();
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [driverId]);

  const fetchDriverData = async (userId: string) => {
    const { data, error } = await supabase
      .from("drivers")
      .select(
        "id, vehicle_type, is_online, is_available, rating, status, full_name, phone, current_location, vehicle_image_url, license_image_url, profile_image_url, vehicle_model, vehicle_plate, admin_activated, max_pickup_radius"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching driver data:", error);
      setIsDriverRegistered(false);
      return;
    }

    if (data) {
      setIsDriverRegistered(true);
      setDriverId(data.id);
      setVehicleType(data.vehicle_type);
      setRating(data.rating || 5.0);
      setDriverStatus(data.status);
      setDriverName(data.full_name);
      setDriverPhone(data.phone ?? null);
      setDriverProfileImage(data.profile_image_url ?? null);
      setAdminActivated(data.admin_activated !== false);
      setMaxPickupRadius(data.max_pickup_radius || 10);

      // Check if profile is complete
      const profileComplete = !!(
        data.vehicle_image_url &&
        data.license_image_url &&
        data.profile_image_url &&
        data.vehicle_model &&
        data.vehicle_plate
      );
      setIsProfileComplete(profileComplete);

      // Restore online status from database
      const wasOnline = data.is_online || false;
      setIsOnline(wasOnline);
      
      // استعادة حالة الإيقاف المؤقت: متصل لكن غير متاح = مشغول
      // فقط إذا لم تكن هناك رحلة نشطة (is_available يُضبط false تلقائياً عند قبول الرحلة)
      if (wasOnline && data.is_available === false) {
        // نتحقق من وجود رحلة نشطة قبل اعتبار السائق "مشغولاً يدوياً"
        const { data: activeRides } = await supabase
          .from("rides")
          .select("id")
          .eq("driver_id", data.id)
          .in("status", ["accepted", "arrived", "in_progress"])
          .limit(1);
        if (!activeRides || activeRides.length === 0) {
          setIsPaused(true);
        }
        // إذا كانت هناك رحلة نشطة، لا نضبط isPaused — السائق في رحلة وليس متوقفاً
      }

      // Restore location if available
      if (data.current_location && typeof data.current_location === "object") {
        const loc = data.current_location as { lat: number; lng: number };
        if (loc.lat && loc.lng) {
          setCurrentLocation(loc);
          latestLocationRef.current = loc;
        }
      }

      // If driver was online, auto-start location tracking
      if (wasOnline) {
        toast({
          title: "تم استعادة حالة الاتصال",
          description: "أنت متصل ويمكنك استقبال الطلبات",
        });
      }
    } else {
      // User exists but not registered as driver
      setIsDriverRegistered(false);
    }
  };

  // Improved online toggle with proper error handling
  const handleOnlineToggle = useCallback(async (online: boolean) => {
    console.log('🔄 handleOnlineToggle called:', { online, driverId: driverIdRef.current, driverStatus: driverStatusRef.current, currentLocation: latestLocationRef.current });
    if (!driverIdRef.current) {
      console.log('❌ handleOnlineToggle: No driverId');
      return;
    }

    // Check driver status
    if (online && driverStatusRef.current !== "approved") {
      console.log('❌ handleOnlineToggle: Driver not approved:', driverStatusRef.current);
      toast({
        title: "لا يمكن الاتصال",
        description: "حسابك قيد المراجعة أو غير معتمد بعد",
        variant: "destructive",
      });
      return;
    }

    if (online) {
      // التحقق من الرصيد والحد الأدنى المسموح للعمل (سقف الديون)
      // ✅ المصدر الصحيح: driver_wallets.balance (وليس profiles أو drivers اللذان لا يُحدَّثان)
      if (driverIdRef.current) {
        const [settingsRes, walletRes] = await Promise.all([
          supabase.from("app_settings").select("value").eq("key", "commission").maybeSingle(),
          supabase.from("driver_wallets").select("balance").eq("driver_id", driverIdRef.current).maybeSingle()
        ]);
        
        // @ts-ignore (تجنب أخطاء JSON parsing)
        const minBalance = settingsRes.data?.value?.min_driver_balance ?? -10000;
        const currentBalance = Number(walletRes.data?.balance ?? 0);
        
        if (currentBalance < minBalance) {
          toast({
            title: "لا يمكنك العمل بسبب الرصيد",
            description: `رصيدك الحالي (${currentBalance.toLocaleString()} د.ع) أقل من الحد المسموح للعمل (${minBalance.toLocaleString()} د.ع). يرجى شحن محفظتك أولاً.`,
            variant: "destructive",
            duration: 8000,
          });
          return;
        }
      }
    }

    setOnlineToggleLoading(true);

    try {
      // ✅ التحقق من GPS قبل الاتصال - يجب تحديد الموقع أولاً
      if (online && !latestLocationRef.current) {
        console.log('📍 handleOnlineToggle: Requesting GPS...');
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 30000,
            });
          });
          const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
          setCurrentLocation(loc);
          latestLocationRef.current = loc;
          console.log('✅ handleOnlineToggle: GPS success:', loc);
        } catch (gpsError: any) {
          console.warn('⚠️ handleOnlineToggle: GPS failed:', gpsError?.message);
          // في المتصفح: استخدم إحداثيات بغداد الافتراضية للتطوير
          const isBrowser = !window.hasOwnProperty('Capacitor') || !(window as any).Capacitor?.isNativePlatform?.();
          if (isBrowser) {
            console.log('🌐 handleOnlineToggle: Browser mode — using Baghdad fallback coordinates');
            const fallbackLoc = { lat: 33.3152, lng: 44.3661 }; // بغداد
            setCurrentLocation(fallbackLoc);
            latestLocationRef.current = fallbackLoc;
            toast({
              title: "⚠️ موقع تقريبي (تطوير)",
              description: "تم استخدام إحداثيات بغداد — GPS غير متاح في المتصفح",
              duration: 4000,
            });
          } else {
            setOnlineToggleLoading(false);
            toast({
              title: "تعذر تحديد الموقع",
              description: "يجب تفعيل GPS وتحديد موقعك قبل الاتصال",
              variant: "destructive",
              duration: 6000,
            });
            return;
          }
        }
      }

      // تهيئة AudioContext + Wake Lock عند الاتصال (تفاعل مستخدم حقيقي)
      if (online) {
        initAudioContext();
        requestWakeLock();
        // ✅ طلب إذن الإشعارات المحلية عند الاتصال (تفاعل المستخدم يضمن القبول)
        import("@/lib/capacitorBridge").then(({ isNativePlatform }) => {
          if (isNativePlatform) {
            import("@capacitor/local-notifications").then(({ LocalNotifications }) => {
              LocalNotifications.requestPermissions().then(perm => {
                if (perm.display === 'granted') {
                  console.log('✅ إذن الإشعارات ممنوح عند الاتصال');
                } else {
                  console.warn('⚠️ إذن الإشعارات مرفوض:', perm.display);
                  toast({
                    title: "تحذير: الإشعارات محظورة",
                    description: "فعّل إشعارات التطبيق من إعدادات الهاتف لاستقبال طلبات الرحلات",
                    variant: "destructive",
                    duration: 8000,
                  });
                }
              }).catch(() => {});
            }).catch(() => {});
          }
        }).catch(() => {});
      } else {
        releaseWakeLock();
      }

      const currentLoc = latestLocationRef.current;
      console.log('📤 handleOnlineToggle: Updating Supabase...', { online, driverId: driverIdRef.current });
      const { error } = await supabase
        .from("drivers")
        .update({
          is_online: online,
          is_available: online,
          current_location: online ? currentLoc : hasActiveRideRef.current ? currentLoc : null,
        })
        .eq("id", driverIdRef.current);

      if (error) throw error;
      console.log('✅ handleOnlineToggle: Supabase update successful!');

      // Only update local state after successful DB update
      setIsOnline(online);
      // إعادة تعيين حالة الإيقاف المؤقت عند قطع الاتصال
      if (!online) setIsPaused(false);

      toast({
        title: online ? "أنت متصل الآن ✅" : "تم قطع الاتصال",
        description: online
          ? "ستظهر لك الطلبات القريبة منك"
          : "لن تتلقى طلبات جديدة",
      });
    } catch (error: any) {
      console.error("Online toggle error:", error);
      toast({
        title: "خطأ في تغيير الحالة",
        description: "حدث خطأ، حاول مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setOnlineToggleLoading(false);
    }
  }, [toast, requestWakeLock, releaseWakeLock]);

  // تبديل وضع الإيقاف المؤقت (Pause/Resume)
  // is_online يبقى true، لكن is_available يتبدل
  const handlePauseToggle = useCallback(async () => {
    if (!driverIdRef.current || !isOnlineRef.current) return;

    const newPaused = !isPausedRef.current;
    
    try {
      const { error } = await supabase
        .from("drivers")
        .update({
          is_available: !newPaused, // إذا مشغول: is_available = false
        })
        .eq("id", driverIdRef.current);

      if (error) throw error;

      setIsPaused(newPaused);
      
      toast({
        title: newPaused ? "☕ إيقاف مؤقت" : "✅ تم الاستئناف",
        description: newPaused
          ? "لن تصلك طلبات جديدة - اضغط استئناف عندما تكون جاهزاً"
          : "أنت جاهز لاستقبال الطلبات مجدداً",
      });
    } catch (error: any) {
      console.error("Pause toggle error:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ، حاول مرة أخرى",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleLogout = async () => {
    // Set offline before logout
    if (driverId) {
      await supabase
        .from("drivers")
        .update({ is_online: false, is_available: false })
        .eq("id", driverId);
    }
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  const getVehicleTypeName = (type: string | null) => {
    const types: Record<string, string> = {
      economy: "اقتصادي",
      comfort: "مريح",
      premium: "فاخر",
      women_only: "نسائي",
    };
    return types[type || ""] || "اقتصادي";
  };

  if (loading) {
    return <SplashScreen />;
  }

  if (!user) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-[#0a0f1c] flex flex-col items-center justify-center font-sans" dir="rtl">
        <div className="flex flex-col items-center gap-6 px-8 w-full max-w-sm">
          <div className="w-20 h-20 bg-[#111827] rounded-2xl flex items-center justify-center border border-slate-800/80 shadow-lg">
            <img src={logo} alt="RAAN" className="w-12 h-12" />
          </div>
          <div className="text-center">
            <h2 className="text-[24px] font-bold text-white mb-2">مرحباً كابتن!</h2>
            <p className="text-[14px] text-slate-400">سجل دخولك للوصول للوحة التحكم</p>
          </div>
          <div className="flex flex-col gap-3 w-full">
            <Link to="/auth">
              <button className="w-full h-14 bg-[#34d399] hover:bg-[#10b981] text-[#064e3b] text-[16px] font-bold rounded-full shadow-[0_0_24px_rgba(52,211,153,0.3)] transition-all">
                تسجيل الدخول
              </button>
            </Link>
            <Link to="/driver/register">
              <button className="w-full h-12 rounded-full border border-slate-700 text-slate-200 text-[15px] font-medium hover:bg-slate-800 transition-colors">
                التسجيل كسائق جديد
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Show registration prompt if user is not registered as driver
  if (user && isDriverRegistered === false) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-[#0a0f1c] flex flex-col items-center justify-center font-sans" dir="rtl">
        <div className="flex flex-col items-center gap-6 px-8 w-full max-w-sm">
          {/* Icon */}
          <div className="w-24 h-24 bg-[#111827] rounded-3xl flex items-center justify-center border border-emerald-500/20 shadow-[0_0_30px_rgba(52,211,153,0.1)]">
            <img src={logo} alt="RAAN" className="w-14 h-14" />
          </div>

          {/* Text */}
          <div className="text-center">
            <h2 className="text-[24px] font-bold text-white mb-2">انضم لفريق ران! 🚗</h2>
            <p className="text-[14px] text-slate-400 leading-relaxed">
              أنت مسجل الدخول لكنك لست سائقاً بعد.<br />أكمل تسجيلك للبدء في استقبال الطلبات والربح معنا.
            </p>
          </div>

          {/* Benefits */}
          <div className="w-full bg-[#151f30] rounded-2xl px-5 py-4 border border-slate-700/50 space-y-3">
            {['استقبل طلبات يومية واربح بشكل ثابت', 'جدول عمل مرن حسب وقتك', 'دعم على مدار الساعة'].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-400 text-[10px] font-bold">✓</span>
                </div>
                <p className="text-slate-300 text-[13px]">{item}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 w-full">
            <Link to="/driver/complete-registration" className="w-full">
              <button className="w-full h-14 bg-[#34d399] hover:bg-[#10b981] text-[#064e3b] text-[16px] font-bold rounded-full shadow-[0_0_24px_rgba(52,211,153,0.3)] transition-all">
                أكمل التسجيل كسائق
              </button>
            </Link>
            <button onClick={handleLogout} className="w-full h-12 rounded-full border border-slate-700 text-slate-400 text-[14px] hover:bg-slate-800 transition-colors">
              تسجيل الخروج
            </button>
          </div>
        </div>
      </div>
    );
  }

  const driverFlowSteps = ["اتصال", "استقبال", "انطلاق", "إكمال"];
  const driverFlowStepIndex = hasActiveRide
    ? 2
    : (rideAcceptedTrigger > 0 && !isSearching && !hasRideRequest)
      ? 3
      : (isOnline && !isPaused)
        ? 1
        : isOnline
          ? 0
          : -1;

  return (
    <div 
      className="h-[100dvh] w-screen bg-[#0a0f1c] flex flex-col overflow-hidden font-sans relative" 
      dir="rtl"
    >
      {/* ═══ Header — Futuristic Glassmorphism ═══ */}
      <header className="absolute top-0 left-0 right-0 z-50 bg-[#0a0f1c]/40 backdrop-blur-2xl border-b border-transparent shadow-[0_10px_40px_rgba(0,0,0,0.5)] w-full transition-all">
        {/* Thin cyan separator line */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
        
        <div className="container relative flex items-center justify-between h-[max(env(safe-area-inset-top,64px),64px)] w-full pt-[env(safe-area-inset-top,0px)] px-4">
          {/* ═══ Left: Notification Icons ═══ */}
          <div className="flex items-center gap-3 z-10">
            <NotificationsBell driverId={driverId} isOpen={notificationsOpen} onToggle={() => { setNotificationsOpen(!notificationsOpen); setRewardsOpen(false); setMenuOpen(false); }} />
          </div>

          {/* ═══ Center: Logo ═══ */}
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center mt-1">
            <img src={logo} alt="RAAN" className="w-9 h-9 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.4)]" />
          </div>

          {/* ═══ Menu Button — Right side ═══ */}
          <button
            onClick={() => { setMenuOpen(!menuOpen); setNotificationsOpen(false); setRewardsOpen(false); }}
            className="relative bg-white/5 border border-white/10 hover:bg-white/10 p-2.5 rounded-xl active:scale-95 transition-all z-10 outline-none focus:outline-none select-none tap-highlight-transparent shadow-lg backdrop-blur-md"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {menuOpen ? (
              <X className="w-5 h-5 text-cyan-50" />
            ) : (
              <Menu className="w-5 h-5 text-cyan-50" />
            )}
          </button>
        </div>
      </header>

      {/* Sidebar Menu */}
      <DriverSideMenu
        user={user}
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onLogout={handleLogout}
        driverName={driverName}
        driverPhone={driverPhone}
        driverProfileImage={driverProfileImage}
        driverStatus={driverStatus}
        vehicleType={vehicleType}
        rating={rating}
        driverId={driverId}
      />

      {/* Rewards Side Panel — from LEFT */}
      <RewardsSidePanel
        isOpen={rewardsOpen}
        onClose={() => setRewardsOpen(false)}
        driverId={driverId}
      />

      {/* Main Content - Full Screen Map Layout */}
      <main className="flex-1 flex flex-col relative overflow-hidden w-full">
    
        {driverId && adminActivated && driverStatus === "approved" && (
          <>
            {/* Dashboard — الخريطة تظهر دائماً مع تأثيرات مختلفة حسب الحالة */}
            <div className="absolute inset-0 z-0">
              {/* الخريطة دائماً مُهيَّأة لتجنب التأخير عند بدء الرحلة */}
              <DriverMap
                driverLocation={currentLocation}
                isOnline={isOnline}
                hasActiveRide={hasActiveRide}
              />
              {/* ✅ مؤشر حالة الشبكة فوق الخريطة */}
              <MapNetworkOverlay />

              {/* Cinematic Vignette Overlay */}
              <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(10,15,28,0.9)] z-10" />

              {hasActiveRide ? (
                /* تأثير التدرج فوق الخريطة أثناء الرحلة (Deep Navy Tone) */
                <div className="absolute inset-0 pointer-events-none z-10" style={{ background: 'radial-gradient(circle at center, transparent 10%, rgba(10,15,28,0.85) 90%)' }} />
              ) : (
                /* تأثيرات محيطية فوق الخريطة عند الانتظار */
                <div className="absolute inset-0 pointer-events-none bg-black/10 z-10" />
              )}
              {/* خريطة مناطق الطلب الحرارية */}
              <DemandHeatMap isOnline={isOnline} />
            </div>

            {/* ═══ Driver Control Center — Bottom Action Bar (Baly-style) ═══ */}
            {!hasRideRequest && !hasActiveRide && (
              <div className="absolute inset-x-0 bottom-0 z-30 pointer-events-none">
                <div className="pointer-events-auto w-full">
                    <DutyToggle
                      isOnline={isOnline}
                      isPaused={isPaused}
                      isLoading={onlineToggleLoading}
                      isSearching={isSearching}
                      driverStatus={driverStatus}
                      locationTracking={locationTracking}
                      onToggle={handleOnlineToggle}
                      onPauseToggle={handlePauseToggle}
                      hasRideRequest={hasRideRequest}
                      driverLocation={currentLocation}
                      maxPickupRadius={maxPickupRadius}
                    />
                </div>
              </div>
            )}

            {/* ═══ Bottom Sheet Cards — positioned absolutely over the full main area ═══ */}
            {!isMinimized && hasActiveRide && (
              <ActiveRideCard
                driverId={driverId}
                driverLocation={currentLocation}
                refreshTrigger={rideAcceptedTrigger}
                onMinimize={() => setIsMinimized(true)}
                onNavigationClick={(lat, lng, label) => {
                  setNavigationDestination({ lat, lng });
                  setShowNavigationModal(true);
                }}
              />
            )}

            {!isMinimized && (
              <RideRequestCard
                driverId={driverId}
                vehicleType={vehicleType}
                isOnline={isOnline}
                isPaused={isPaused}
                driverLocation={currentLocation}
                maxPickupRadius={maxPickupRadius}
                highlightRideId={highlightRideId}
                onDeepLinkResolved={handleDeepLinkResolved}
                onRideRequestVisible={handleRideRequestVisible}
                onRideAccepted={handleRideAccepted}
              />
            )}

            {/* ═══ Dashboard Stats Summary — Floating top cards (just below header) ═══ */}
            {!hasRideRequest && !hasActiveRide && isOnline && driverId && (
              <div className="absolute top-0 left-0 right-0 z-30 pointer-events-auto transition-all duration-300 ease-in-out">
                <DriverQuickStats driverId={driverId} />
              </div>
            )}

            {/* Navigation Modal */}
            <ExternalNavigationModal
              isOpen={showNavigationModal}
              onClose={() => setShowNavigationModal(false)}
              lat={navigationDestination?.lat || 0}
              lng={navigationDestination?.lng || 0}
              onInternalNavigation={() => {
                setIsMinimized(true);
              }}
              destinationLabel="الوجهة"
            />
          </>
        )}

        {/* تأكيد إلغاء الرحلة */}
        <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>إلغاء الرحلة</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد أنك تريد إلغاء الرحلة؟ سيتم إشعار الراكب فوراً.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogCancel>تراجع</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={handleCancelRideFromBubble}
                disabled={isCancellingRide}
              >
                {isCancellingRide ? "جاري الإلغاء..." : "نعم، إلغاء الرحلة"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Loading State */}
        {loading && <SplashScreen />}
      </main>
    </div>
  );
};

export default DriverHome;
