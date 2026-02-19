import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import SplashScreen from "@/components/common/SplashScreen";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { User, Session } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { useDriverNotifications } from "@/hooks/useDriverNotifications";
import { RideRequestCard } from "@/components/driver/RideRequestCard";
import { ActiveRideCard } from "@/components/driver/ActiveRideCard";
import { DriverMap } from "@/components/driver/DriverMap";
import { DriverStats } from "@/components/driver/DriverStats";
import { RecentRides } from "@/components/driver/RecentRides";
import { NotificationSetup } from "@/components/driver/NotificationSetup";
import { NotificationsBell } from "@/components/driver/NotificationsBell";
import { StatusSearchBar } from "@/components/driver/StatusSearchBar";
import DutyToggle from "@/components/driver/DutyToggle";
import { NewRideAlert } from "@/components/driver/NewRideAlert";
import { FloatingTripBubble } from "@/components/driver/FloatingTripBubble";
import { ExternalNavigationModal } from "@/components/driver/ExternalNavigationModal";
import DriverSideMenu from "@/components/driver/DriverSideMenu";
import { initAudioContext, cleanupAudioContext } from "@/lib/audioContext";
import logo from "@/assets/logo.png";
import {
  Menu,
  X,
  LogOut,
  Gift,
  Bell,
} from "lucide-react";

const DriverHome = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
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
  const [locationTracking, setLocationTracking] = useState(false);
  const [onlineToggleLoading, setOnlineToggleLoading] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [hasActiveRide, setHasActiveRide] = useState(false);
  const [showNewRideAlert, setShowNewRideAlert] = useState(false);
  const [newRideData, setNewRideData] = useState<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const locationUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [rating, setRating] = useState(5.0);
  const [isProfileComplete, setIsProfileComplete] = useState(true);
  const [adminActivated, setAdminActivated] = useState(true);
  const [maxPickupRadius, setMaxPickupRadius] = useState(10);

  // Enable real-time notifications for new rides
  // إيقاف الإشعارات عند وضع الإيقاف المؤقت
  const { notificationPermission, requestNotificationPermission } =
    useDriverNotifications(isOnline && !isPaused ? driverId : null, vehicleType);

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
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000, distanceFilter: 10 }
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
      if (wasOnline && data.is_available === false) {
        setIsPaused(true);
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
      // تهيئة AudioContext عند الاتصال (تفاعل مستخدم حقيقي)
      if (online) {
        initAudioContext();
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
    navigate("/");
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

  const getStatusBadge = () => {
    switch (driverStatus) {
      case "approved":
        return { label: "✅ معتمد", color: "bg-green-500" };
      case "pending":
        return { label: "⏳ قيد المراجعة", color: "bg-amber-500" };
      case "rejected":
        return { label: "❌ مرفوض", color: "bg-destructive" };
      case "suspended":
        return { label: "⛔ موقوف", color: "bg-destructive" };
      default:
        return { label: "❓ غير معروف", color: "bg-muted" };
    }
  };

  if (loading) {
    return <SplashScreen />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <img
              src={logo}
              alt="RAAN"
              className="w-16 h-16 mx-auto rounded-2xl mb-4"
            />
            <h2 className="text-2xl font-bold mb-2">مرحباً كابتن!</h2>
            <p className="text-muted-foreground mb-6">
              سجل دخولك للوصول للوحة التحكم
            </p>
            <div className="space-y-3">
              <Link to="/auth">
                <Button className="w-full">تسجيل الدخول</Button>
              </Link>
              <Link to="/driver/register">
                <Button variant="outline" className="w-full">
                  التسجيل كسائق جديد
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show registration prompt if user is not registered as driver
  if (user && isDriverRegistered === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <img
              src={logo}
              alt="RAAN"
              className="w-20 h-20 mx-auto rounded-2xl mb-6"
            />
            <h2 className="text-2xl font-bold mb-2">انضم لفريق ران! 🚗</h2>
            <p className="text-muted-foreground mb-6">
              أنت مسجل الدخول لكنك لست سائقاً بعد.
              <br />
              أكمل تسجيلك للبدء في استقبال الطلبات والربح معنا.
            </p>
            <Link to="/driver/complete-registration">
              <Button className="w-full" size="lg">
                أكمل التسجيل كسائق
              </Button>
            </Link>
            <div className="mt-4 pt-4 border-t border-border">
              <button
                onClick={handleLogout}
                className="text-sm text-muted-foreground hover:text-destructive transition-colors"
              >
                تسجيل الخروج
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusBadge = getStatusBadge();

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* ═══ Header — Glassmorphism floating bar ═══ */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5">
        <div className="container flex items-center justify-between h-14">
          {/* Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="relative bg-white/10 backdrop-blur-md p-2.5 rounded-full border border-white/10 active:scale-95 transition-transform"
          >
            {menuOpen ? (
              <X className="w-5 h-5 text-white" />
            ) : (
              <Menu className="w-5 h-5 text-white" />
            )}
          </button>

          {/* Logo */}
          <div className="flex items-center gap-2">
            <img src={logo} alt="RAAN" className="w-8 h-8 rounded-lg" />
            <span className="font-bold text-white">ران</span>
          </div>

          {/* ═══ Dual Notification Icons ═══ */}
          <div className="flex items-center gap-2.5">
            {/* Icon 1: Rewards & Company Alerts — Golden Gift */}
            <button
              onClick={() => navigate('/driver/incentives')}
              className="relative bg-black/40 backdrop-blur-md p-2.5 rounded-full border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)] active:scale-95 transition-transform"
            >
              <Gift className="w-5 h-5 text-amber-400" />
              {/* Pulse ring when there are alerts */}
              {(!isProfileComplete || !adminActivated || driverStatus === 'pending') && (
                <span className="absolute inset-0 rounded-full border-2 border-amber-400/60 animate-ping" />
              )}
              {/* Orange count badge */}
              {(!isProfileComplete || !adminActivated || driverStatus === 'pending') && (
                <span className="absolute -top-1 -right-1 w-4.5 h-4.5 min-w-[18px] bg-amber-500 text-black font-bold rounded-full text-[10px] flex items-center justify-center border-2 border-black">
                  !
                </span>
              )}
            </button>

            {/* Icon 2: General Notifications — Bell */}
            <NotificationsBell driverId={driverId} />
          </div>
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

      {/* Main Content - Full Screen Map Layout */}
      <main className="flex-1 relative overflow-hidden">
        {driverId && adminActivated && driverStatus === "approved" && (
          <>
            {/* Dashboard — Map + Controls (always visible) */}
            {/* Full Screen Map - Absolute background */}
            <div className="absolute inset-0 top-14">
              <DriverMap
                driverLocation={currentLocation}
                isOnline={isOnline}
              />
            </div>

            {/* ═══ Driver Control Center — Vertical stack at bottom center ═══ */}
            <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none flex flex-col items-center pb-4">
              {/* Gradient backdrop for readability over map */}
              <div className="absolute bottom-0 left-0 right-0 h-72 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
              
              <div className="relative flex flex-col items-center gap-3 w-full max-w-sm px-4">
                {/* 1️⃣ Top: DutyToggle — Large circular power button */}
                <div className="pointer-events-auto">
                  <DutyToggle
                    isOnline={isOnline}
                    isPaused={isPaused}
                    isLoading={onlineToggleLoading}
                    isSearching={isSearching}
                    driverStatus={driverStatus}
                    locationTracking={locationTracking}
                    onToggle={handleOnlineToggle}
                    onPauseToggle={handlePauseToggle}
                  />
                </div>

                {/* 2️⃣ Middle: StatusSearchBar — Pause icon + status text (only when online) */}
                {isOnline && (
                  <div className="w-full pointer-events-auto">
                    <StatusSearchBar
                      isOnline={isOnline}
                      isPaused={isPaused}
                      isSearching={isSearching}
                      onToggleOnline={handleOnlineToggle}
                      onTogglePause={handlePauseToggle}
                      isLoading={onlineToggleLoading}
                      locationTracking={locationTracking}
                      driverStatus={driverStatus}
                    />
                  </div>
                )}

                {/* 3️⃣ Bottom: Action cards — Searching indicator / Active ride / Ride request */}
                <div className="w-full pointer-events-auto flex flex-col gap-2">
                  {/* Active Ride Card */}
                  {!isMinimized && (
                    <ActiveRideCard
                      driverId={driverId}
                      driverLocation={currentLocation}
                      onMinimize={() => setIsMinimized(true)}
                      onNavigationClick={(lat, lng, label) => {
                        setNavigationDestination({ lat, lng });
                        setShowNavigationModal(true);
                      }}
                    />
                  )}

                  {/* Ride Request Card — "جاري البحث عن الطلبات" or ride details */}
                  {!isMinimized && (
                    <RideRequestCard
                      driverId={driverId}
                      vehicleType={vehicleType}
                      isOnline={isOnline}
                      isPaused={isPaused}
                      driverLocation={currentLocation}
                      maxPickupRadius={maxPickupRadius}
                      onRideAccepted={() => {
                        console.log(
                          "[DriverHome] Ride accepted, ActiveRideCard will update via subscription"
                        );
                      }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Floating Trip Bubble - shown when minimized */}
            {isMinimized && (
              <FloatingTripBubble
                isMinimized={isMinimized}
                onToggleMinimize={() => setIsMinimized(false)}
                notificationCount={notificationCount}
                onCallClick={() => {
                  toast({
                    title: "اتصال",
                    description: "يمكنك الاتصال بالراكب"
                  });
                }}
                onChatClick={() => {
                  toast({
                    title: "محادثة",
                    description: "فتح الدردشة"
                  });
                }}
                onCancelClick={() => {
                  toast({
                    title: "إلغاء",
                    description: "هل تريد إلغاء الرحلة؟"
                  });
                }}
                passengerName={riderName}
                passengerRating={riderRating}
              >
                <div className="text-sm text-slate-300 space-y-2">
                  {/* Content will show here when expanded */}
                  <p>الرحلة نشطة - اسحب الأيقونة لنقلها</p>
                </div>
              </FloatingTripBubble>
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

        {/* Loading State */}
        {loading && <SplashScreen />}
      </main>
    </div>
  );
};

export default DriverHome;
