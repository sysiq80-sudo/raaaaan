import { useState, useEffect, useCallback, useRef } from "react";
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
import { RideRequestCard } from "@/components/driver/RideRequestCard";
import { ActiveRideCard } from "@/components/driver/ActiveRideCard";
import { DriverMap } from "@/components/driver/DriverMap";
import { DemandHeatMap } from "@/components/driver/DemandHeatMap";
import DriverQuickStats from "@/components/driver/DriverQuickStats";
import { RecentRides } from "@/components/driver/RecentRides";
import { NotificationSetup } from "@/components/driver/NotificationSetup";
import { NotificationsBell } from "@/components/driver/NotificationsBell";
import DutyToggle from "@/components/driver/DutyToggle";
import { NewRideAlert } from "@/components/driver/NewRideAlert";
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
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showNavigationModal, setShowNavigationModal] = useState(false);
  const [navigationDestination, setNavigationDestination] = useState<{ lat: number; lng: number } | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [activeRideData, setActiveRideData] = useState<any>(null);
  const [riderName, setRiderName] = useState<string>("الراكب");
  const [riderRating, setRiderRating] = useState<number | undefined>(undefined);
  const [riderPhone, setRiderPhone] = useState<string | null>(null);
  const [locationTracking, setLocationTracking] = useState(false);
  const [onlineToggleLoading, setOnlineToggleLoading] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [hasActiveRide, setHasActiveRide] = useState(false);
  const [showNewRideAlert, setShowNewRideAlert] = useState(false);
  const [newRideData, setNewRideData] = useState<any>(null);
  const [rideAcceptedTrigger, setRideAcceptedTrigger] = useState(0);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancellingRide, setIsCancellingRide] = useState(false);
  const [highlightRideId, setHighlightRideId] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const locationUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const [rating, setRating] = useState(5.0);
  const [isProfileComplete, setIsProfileComplete] = useState(true);
  const [adminActivated, setAdminActivated] = useState(true);
  const [maxPickupRadius, setMaxPickupRadius] = useState(10);
  const [hasRideRequest, setHasRideRequest] = useState(false);

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
  // إيقاف الإشعارات عند وضع الإيقاف المؤقت
  const { notificationPermission, requestNotificationPermission } =
    useDriverNotifications(isOnline && !isPaused ? driverId : null, vehicleType);

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
      if (typeof window === "undefined" || !("Notification" in window)) return;
      
      // Check if already asked (not default)
      if (Notification.permission !== "default") return;

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

    // Watch position changes with throttle (تحديث كل 10 ثوان كحد أدنى)
    // هذا يوفر استهلاك البطارية ويقلل كتابات قاعدة البيانات بنسبة 60%
    let lastUpdateTime = 0;
    const MIN_UPDATE_INTERVAL = 10000; // 10 ثوان

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation = { lat: latitude, lng: longitude };
        setCurrentLocation(newLocation);
        latestLocationRef.current = newLocation;
        
        // Throttle: أرسل التحديث فقط إذا مرت 10 ثوان
        const now = Date.now();
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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchDriverData(session.user.id);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
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

  // 🚪 beforeunload — ضبط offline عند إغلاق التبويب
  useEffect(() => {
    if (!driverId) return;

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
  useEffect(() => {
    const store = useDriverStore.getState();
    store.setOnline(isOnline);
    store.setAvailable(isOnline && !isPaused);
    if (currentLocation) {
      store.setLocation(currentLocation);
    }
  }, [isOnline, isPaused, currentLocation]);

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

      setHasActiveRide(!!(data && data.length > 0));
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
          } else {
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
      // Debug: Log all driver data
      console.log("📋 Driver Data Debug:", {
        id: data.id,
        full_name: data.full_name,
        phone: data.phone,
        status: data.status,
        rating: data.rating,
        vehicle_type: data.vehicle_type,
        profile_image_url: data.profile_image_url,
        is_online: data.is_online,
        max_pickup_radius: data.max_pickup_radius,
        admin_activated: data.admin_activated,
      });

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

      console.log("🎯 Max Pickup Radius set to:", data.max_pickup_radius || 10);

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
  const handleOnlineToggle = async (online: boolean) => {
    if (!driverId) return;

    // Check driver status
    if (online && driverStatus !== "approved") {
      toast({
        title: "لا يمكن الاتصال",
        description: "حسابك قيد المراجعة أو غير معتمد بعد",
        variant: "destructive",
      });
      return;
    }

    setOnlineToggleLoading(true);

    try {
      // ✅ التحقق من GPS قبل الاتصال - يجب تحديد الموقع أولاً
      if (online && !currentLocation) {
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
        } catch (gpsError) {
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

      const { error } = await supabase
        .from("drivers")
        .update({
          is_online: online,
          is_available: online,
          current_location: online ? currentLocation : hasActiveRide ? currentLocation : null,
        })
        .eq("id", driverId);

      if (error) throw error;

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
  };

  // تبديل وضع الإيقاف المؤقت (Pause/Resume)
  // is_online يبقى true، لكن is_available يتبدل
  const handlePauseToggle = async () => {
    if (!driverId || !isOnline) return;

    const newPaused = !isPaused;
    
    try {
      const { error } = await supabase
        .from("drivers")
        .update({
          is_available: !newPaused, // إذا مشغول: is_available = false
        })
        .eq("id", driverId);

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
  };

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
    <div className="h-[100dvh] bg-[#0b1326] flex flex-col overflow-hidden font-sans" dir="rtl">
      {/* ═══ Header — Dark Luxury with emerald glow ═══ */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0b1326] border-b border-[#5bdda6]/10 shadow-[0_4px_30px_rgba(91,221,166,0.05)]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="container relative flex items-center justify-between h-16">
          {/* ═══ Left: Notification Icons ═══ */}
          <div className="flex items-center gap-3 z-10">
            <NotificationsBell driverId={driverId} isOpen={notificationsOpen} onToggle={() => { setNotificationsOpen(!notificationsOpen); setRewardsOpen(false); setMenuOpen(false); }} />
          </div>

          {/* ═══ Center: Logo ═══ */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
            <img src={logo} alt="RAAN" className="w-11 h-11 rounded-xl shadow-[0_0_12px_rgba(91,221,166,0.3)]" />
          </div>

          {/* Menu Button — Right side */}
          <button
            onClick={() => { setMenuOpen(!menuOpen); setNotificationsOpen(false); setRewardsOpen(false); }}
            className="relative bg-slate-800/40 border border-slate-700/50 hover:bg-slate-700/50 p-3 rounded-xl active:scale-90 transition-all z-10 outline-none focus:outline-none select-none tap-highlight-transparent"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {menuOpen ? (
              <X className="w-6 h-6 text-slate-300" />
            ) : (
              <Menu className="w-6 h-6 text-slate-300" />
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
      <main className="flex-1 flex flex-col relative overflow-hidden" style={{ paddingTop: 'calc(56px + env(safe-area-inset-top, 0px))' }}>
        <div className="driver-stepper-shell">
          <div className="driver-stepper" dir="ltr" role="list" aria-label="مراحل تشغيل السائق">
            {driverFlowSteps.map((step, index) => (
              <div key={step} className="flex items-center gap-2" role="listitem">
                <div
                  className={`driver-stepper-node ${index <= driverFlowStepIndex ? "driver-stepper-node-active" : ""}`}
                  aria-hidden="true"
                >
                  {index + 1}
                </div>
                <span className={`text-[11px] font-bold ${index <= driverFlowStepIndex ? "text-[#5bdda6]" : "text-slate-500"}`}>
                  {step}
                </span>
                {index < driverFlowSteps.length - 1 ? <span className="driver-stepper-link" aria-hidden="true" /> : null}
              </div>
            ))}
          </div>
        </div>

        {driverId && adminActivated && driverStatus === "approved" && (
          <>
            {/* Dashboard — الخريطة تظهر دائماً مع تأثيرات مختلفة حسب الحالة */}
            <div className="flex-1 relative min-h-0">
              {/* الخريطة دائماً مُهيَّأة لتجنب التأخير عند بدء الرحلة */}
              <DriverMap
                driverLocation={currentLocation}
                isOnline={isOnline}
              />

              {hasActiveRide ? (
                /* تأثير التدرج فوق الخريطة أثناء الرحلة */
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at center, transparent 0%, rgba(11,19,38,0.7) 85%)' }} />
              ) : (
                /* تأثيرات محيطية فوق الخريطة عند الانتظار — pointer-events-none لا تمنع التفاعل مع الخريطة */
                <div className="absolute inset-0 pointer-events-none">
                  {/* نقطة نبض — موقع السائق */}
                  {isOnline && currentLocation && (
                    <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div className="relative flex items-center justify-center">
                        <div className="absolute w-32 h-32 bg-[#5bdda6]/20 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
                        <div className="absolute w-16 h-16 bg-[#5bdda6]/25 rounded-full animate-pulse" />
                        <div className="w-5 h-5 bg-[#5bdda6] rounded-full border-4 border-[#0b1326] shadow-[0_0_20px_rgba(91,221,166,0.8)] z-10" />
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* خريطة مناطق الطلب الحرارية */}
              <DemandHeatMap isOnline={isOnline} />
            </div>

            {/* ═══ Driver Control Center — Centered DutyToggle ═══ */}
            {!hasRideRequest && !hasActiveRide && (
              <div className="absolute inset-x-0 bottom-[22vh] z-20 pointer-events-none flex justify-center">
                <div className="relative flex flex-col items-center gap-3 w-full max-w-2xl px-4">
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
              </div>
            )}

            {/* ═══ Bottom Sheet Cards — positioned absolutely within map area ═══ */}
            {!isMinimized && (
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
                onRideRequestVisible={setHasRideRequest}
                onRideAccepted={() => {
                  console.log(
                    "[DriverHome] Ride accepted — triggering ActiveRideCard refresh"
                  );
                  setIsPaused(false);
                  setHasActiveRide(true); // إخفاء DutyToggle فوراً
                  setRideAcceptedTrigger(prev => prev + 1);
                }}
              />
            )}

            {/* ═══ Dashboard Stats Summary — Floating top cards (just below header) ═══ */}
            {!hasRideRequest && !hasActiveRide && isOnline && driverId && (
              <div className="absolute top-[calc(3.5rem+env(safe-area-inset-top))] left-0 right-0 z-30 pointer-events-auto transition-all duration-300 ease-in-out">
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
                // Maximize map and focus on navigation
              }}
              destinationLabel="الوجهة"
            />
          </>
        )}

        {/* New Ride Alert Modal */}
        <NewRideAlert
          isVisible={showNewRideAlert}
          onClose={() => setShowNewRideAlert(false)}
          onAccept={() => {
            // Logic for accepting ride will be handled by RideRequestCard
          }}
          rideData={newRideData}
        />

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
