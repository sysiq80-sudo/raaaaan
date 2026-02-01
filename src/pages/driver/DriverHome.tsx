import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { DriverAlerts } from "@/components/driver/DriverAlerts";
import { StatusSearchBar } from "@/components/driver/StatusSearchBar";
import { NewRideAlert } from "@/components/driver/NewRideAlert";
import DriverSideMenu from "@/components/driver/DriverSideMenu";
import logo from "@/assets/logo.png";
import {
  Menu,
  X,
  LogOut,
} from "lucide-react";

const DriverHome = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
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
  const [locationTracking, setLocationTracking] = useState(false);
  const [onlineToggleLoading, setOnlineToggleLoading] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [showNewRideAlert, setShowNewRideAlert] = useState(false);
  const [newRideData, setNewRideData] = useState<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const locationUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [rating, setRating] = useState(5.0);
  const [isProfileComplete, setIsProfileComplete] = useState(true);
  const [adminActivated, setAdminActivated] = useState(true);
  const [maxPickupRadius, setMaxPickupRadius] = useState(10);

  // Enable real-time notifications for new rides
  const { notificationPermission, requestNotificationPermission } =
    useDriverNotifications(isOnline ? driverId : null, vehicleType);

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
      if (!driverId || !isOnline) return;

      let retries = 3;
      while (retries > 0) {
        try {
          const { error } = await supabase
            .from("drivers")
            .update({
              current_location: { lat, lng },
              is_available: true,
            })
            .eq("id", driverId);

          if (error) throw error;
          console.log("Location updated:", { lat, lng });
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
    [driverId, isOnline]
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
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation = { lat: latitude, lng: longitude };
        setCurrentLocation(newLocation);
        latestLocationRef.current = newLocation;
        updateDriverLocation(latitude, longitude);
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast({
          title: "⚠️ خطأ GPS",
          description: "تفعيل الموقع مطلوب",
          variant: "locationError" as any,
          duration: 3000,
        });
      },
      { enableHighAccuracy: true }
    );

    // Watch position changes and update ref
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation = { lat: latitude, lng: longitude };
        setCurrentLocation(newLocation);
        latestLocationRef.current = newLocation;
        updateDriverLocation(latitude, longitude);
      },
      (error) => console.error("Watch position error:", error),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    watchIdRef.current = watchId;

    // Also update database every 30 seconds using ref
    const intervalId = setInterval(() => {
      if (latestLocationRef.current) {
        updateDriverLocation(
          latestLocationRef.current.lat,
          latestLocationRef.current.lng
        );
      }
    }, 30000);

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
    };
  }, [stopLocationTracking]);

  // Start/stop tracking based on online status
  useEffect(() => {
    if (isOnline && driverId) {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }
  }, [isOnline, driverId, startLocationTracking, stopLocationTracking]);

  const fetchDriverData = async (userId: string) => {
    const { data, error } = await supabase
      .from("drivers")
      .select(
        "id, vehicle_type, is_online, rating, status, full_name, phone, current_location, vehicle_image_url, license_image_url, profile_image_url, vehicle_model, vehicle_plate, admin_activated, max_pickup_radius"
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
      const { error } = await supabase
        .from("drivers")
        .update({
          is_online: online,
          is_available: online,
          current_location: online ? currentLocation : null,
        })
        .eq("id", driverId);

      if (error) throw error;

      // Only update local state after successful DB update
      setIsOnline(online);

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
        return { label: "معتمد", color: "bg-green-500" };
      case "pending":
        return { label: "قيد المراجعة", color: "bg-amber-500" };
      case "rejected":
        return { label: "مرفوض", color: "bg-destructive" };
      case "suspended":
        return { label: "موقوف", color: "bg-destructive" };
      default:
        return { label: "غير معروف", color: "bg-muted" };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <img
            src={logo}
            alt="RAAN"
            className="w-16 h-16 mx-auto rounded-2xl mb-4 animate-pulse"
          />
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container flex items-center justify-between h-16">
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-2">
            {menuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>

          <div className="flex items-center gap-2">
            <img src={logo} alt="RAAN" className="w-8 h-8 rounded-lg" />
            <span className="font-bold">ران</span>
          </div>

          <div className="flex items-center gap-2">
            <DriverAlerts
              isProfileComplete={isProfileComplete}
              notificationPermission={notificationPermission}
              isOnline={isOnline}
              adminActivated={adminActivated}
              driverStatus={driverStatus}
            />
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

      {/* Main Content - Mobile Optimized Layout */}
      <main className="flex-1 pt-20 flex flex-col relative overflow-hidden">
        {driverId && adminActivated && driverStatus === "approved" && (
          <>
            {/* Status & Search Bar - Sticky */}
            <div className="px-4 pb-3">
              <StatusSearchBar
                isOnline={isOnline}
                isSearching={isSearching}
                onToggleOnline={handleOnlineToggle}
                isLoading={onlineToggleLoading}
                locationTracking={locationTracking}
                driverStatus={driverStatus}
              />
            </div>

            {/* Map Container - Full Height */}
            <div className="flex-1 min-h-0 relative">
              <DriverMap 
                driverLocation={currentLocation} 
                isOnline={isOnline} 
              />
            </div>

            {/* Floating Ride Cards - Bottom Center */}
            <div className="fixed bottom-6 left-4 right-4 flex justify-center pointer-events-none z-30">
              <div className="w-full max-w-sm space-y-2">
                {/* Active Ride Card - Float */}
                <div className="pointer-events-auto">
                  <ActiveRideCard
                    driverId={driverId}
                    driverLocation={currentLocation}
                  />
                </div>

                {/* Ride Request Card - Float */}
                <div className="pointer-events-auto">
                  <RideRequestCard
                    driverId={driverId}
                    vehicleType={vehicleType}
                    isOnline={isOnline}
                    driverLocation={currentLocation}
                    maxPickupRadius={maxPickupRadius}
                    onRideAccepted={() => {
                      console.log(
                        "[DriverHome] Ride accepted, ActiveRideCard will update via subscription"
                      );
                    }}
                  />
                </div>
              </div>
            </div>
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

        {/* Loading State - Show only if waiting for approval */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <img
                src={logo}
                alt="RAAN"
                className="w-16 h-16 mx-auto rounded-2xl mb-4 animate-pulse"
              />
              <p className="text-muted-foreground">جاري التحميل...</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DriverHome;
