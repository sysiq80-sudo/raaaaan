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
import DriverSideMenu from "@/components/driver/DriverSideMenu";
import logo from "@/assets/logo.png";
import {
  MapPin,
  DollarSign,
  Star,
  Menu,
  X,
  LogOut,
  History,
  Settings,
  Bell,
  Navigation,
  Clock,
  Locate,
  Wifi,
  WifiOff,
  AlertCircle,
  Phone,
  Shield,
  BarChart3,
  FileSearch,
  UserCircle,
  Wallet,
  Gift,
  Loader2,
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
  const watchIdRef = useRef<number | null>(null);
  const locationUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [rating, setRating] = useState(5.0);
  const [isProfileComplete, setIsProfileComplete] = useState(true);
  const [adminActivated, setAdminActivated] = useState(true);

  // Enable real-time notifications for new rides
  const { notificationPermission, requestNotificationPermission } =
    useDriverNotifications(isOnline ? driverId : null, vehicleType);

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
        "id, vehicle_type, is_online, rating, status, full_name, phone, current_location, vehicle_image_url, license_image_url, profile_image_url, vehicle_model, vehicle_plate, admin_activated"
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
    <div className="min-h-screen bg-background">
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
            <div
              className={`w-2 h-2 rounded-full ${
                isOnline ? "bg-green-500 animate-pulse" : "bg-muted"
              }`}
            />
            <img src={logo} alt="RAAN" className="w-8 h-8 rounded-lg" />
            <span className="font-bold">ران كابتن</span>
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
      />

      {/* Main Content */}
      <main className="pt-20 pb-8 px-4">
        <div className="container max-w-lg space-y-6">
          {/* Profile Incomplete Warning - Hidden, functionality moved to DriverAlerts button */}

          {/* Account Deactivated Warning - Hidden, functionality moved to DriverAlerts button */}

          {/* Driver Status Warning - Hidden, functionality moved to DriverAlerts button */}

          {/* Push Notifications Setup - High Priority */}
          {driverId && driverStatus === "approved" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NotificationSetup driverId={driverId} isOnline={isOnline} />

              <Card
                className={`border-2 transition-all duration-300 shadow-xl ${
                  isOnline
                    ? "border-green-500 bg-gradient-to-br from-gray-800 to-gray-900"
                    : "border-blue-500/50 bg-gradient-to-br from-gray-800 to-gray-900"
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-lg ${
                          isOnline
                            ? "bg-green-500 shadow-green-500/50"
                            : "bg-blue-500/30 shadow-blue-500/30"
                        }`}
                      >
                        {isOnline ? (
                          <Wifi className="w-6 h-6 text-white" />
                        ) : (
                          <WifiOff className="w-6 h-6 text-blue-400" />
                        )}
                      </div>
                      <div>
                        <p
                          className={`font-bold text-[clamp(0.875rem,2.5vw,1.125rem)] leading-tight ${
                            isOnline ? "text-green-400" : "text-blue-400"
                          }`}
                        >
                          {isOnline ? "أنت متصل" : "أنت غير متصل"}
                        </p>
                        <p
                          className={`text-[clamp(0.75rem,2vw,0.875rem)] leading-tight ${
                            isOnline ? "text-green-300/80" : "text-blue-300/70"
                          }`}
                        >
                          {isOnline
                            ? locationTracking
                              ? "جاري استقبال الطلبات"
                              : "جاري تفعيل تتبع الموقع..."
                            : "فعّل الاتصال لاستقبال الطلبات"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        !onlineToggleLoading &&
                        driverStatus === "approved" &&
                        handleOnlineToggle(!isOnline)
                      }
                      disabled={
                        onlineToggleLoading || driverStatus !== "approved"
                      }
                      className={`
                        relative inline-flex h-10 w-20 items-center rounded-full
                        transition-all duration-300 ease-in-out
                        ${
                          onlineToggleLoading || driverStatus !== "approved"
                            ? "opacity-50 cursor-not-allowed"
                            : "cursor-pointer"
                        }
                        ${
                          isOnline
                            ? "bg-green-500 shadow-lg shadow-green-500/50 hover:shadow-xl hover:shadow-green-500/60"
                            : "bg-gray-400 shadow-md hover:shadow-lg hover:bg-gray-500"
                        }
                        active:scale-95
                      `}
                    >
                      <span
                        className={`
                          inline-block h-8 w-8 transform rounded-full
                          bg-white shadow-lg transition-transform duration-300
                          ${isOnline ? "translate-x-12" : "translate-x-0.5"}
                        `}
                      >
                        {onlineToggleLoading ? (
                          <Loader2 className="w-4 h-4 m-2 animate-spin text-gray-400" />
                        ) : (
                          <div
                            className={`w-4 h-4 m-2 ${
                              isOnline ? "text-gray-400" : "text-gray-400"
                            }`}
                          >
                            {isOnline ? (
                              <Wifi className="w-4 h-4" />
                            ) : (
                              <WifiOff className="w-4 h-4" />
                            )}
                          </div>
                        )}
                      </span>
                    </button>
                  </div>

                  {/* Location info when online */}
                  {isOnline && currentLocation && (
                    <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-[clamp(0.625rem,1.5vw,0.75rem)] text-muted-foreground">
                      <Locate className="w-4 h-4 text-primary" />
                      <span>
                        {currentLocation.lat.toFixed(4)},{" "}
                        {currentLocation.lng.toFixed(4)}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Only show ride features when approved and activated */}
          {driverId && adminActivated && driverStatus === "approved" && (
            <>
              {/* Active Ride Card */}
              <ActiveRideCard
                driverId={driverId}
                driverLocation={currentLocation}
              />

              {/* Ride Request Card */}
              <RideRequestCard
                driverId={driverId}
                vehicleType={vehicleType}
                isOnline={isOnline}
                driverLocation={currentLocation}
                onRideAccepted={() => {
                  console.log(
                    "[DriverHome] Ride accepted, ActiveRideCard will update via subscription"
                  );
                }}
              />

              {/* Map */}
              <DriverMap driverLocation={currentLocation} isOnline={isOnline} />
            </>
          )}

          {/* Stats - always show */}
          {driverId && <DriverStats driverId={driverId} />}

          {/* Recent Rides - always show */}
          {driverId && <RecentRides driverId={driverId} />}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-4">
            <Link to="/driver/rides">
              <Button variant="outline" className="w-full h-14 flex-col gap-1">
                <Clock className="w-5 h-5" />
                <span className="text-sm">سجل الرحلات</span>
              </Button>
            </Link>
            <Link to="/driver/payments">
              <Button variant="outline" className="w-full h-14 flex-col gap-1">
                <DollarSign className="w-5 h-5" />
                <span className="text-sm">الأرباح</span>
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

const MenuLink = ({
  icon,
  label,
  href,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  onClick?: () => void;
}) => (
  <Link
    to={href}
    onClick={onClick}
    className="flex items-center gap-3 p-3 rounded-lg text-foreground hover:bg-accent transition-colors"
  >
    <span className="text-muted-foreground">{icon}</span>
    <span>{label}</span>
  </Link>
);

export default DriverHome;
