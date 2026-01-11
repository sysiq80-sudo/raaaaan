import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Clock,
  Wallet,
  User,
  X,
  Check,
  Navigation,
  Loader2,
  Route,
  Timer,
  Car,
} from "lucide-react";

interface PendingRide {
  id: string;
  pickup_location: { lat: number; lng: number };
  dropoff_location: { lat: number; lng: number };
  pickup_address: string | null;
  dropoff_address: string | null;
  estimated_fare: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  vehicle_type: string;
  created_at: string;
  rider_id: string;
  distance_to_pickup?: number; // Distance from driver to pickup
  eta_to_pickup?: number; // ETA in minutes
}

interface RideRequestCardProps {
  driverId: string;
  vehicleType: string | null;
  isOnline: boolean;
  driverLocation?: { lat: number; lng: number } | null;
  onRideAccepted?: () => void;
}

const getLocationString = (location: unknown): string => {
  if (
    typeof location === "object" &&
    location !== null &&
    "lat" in location &&
    "lng" in location
  ) {
    const loc = location as { lat: number; lng: number };
    return `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
  }
  return "";
};

const getVehicleTypeName = (type: string) => {
  const types: Record<string, string> = {
    economy: "اقتصادي",
    comfort: "مريح",
    premium: "فاخر",
    women_only: "نسائي",
  };
  return types[type] || type;
};

export const RideRequestCard = ({
  driverId,
  vehicleType,
  isOnline,
  driverLocation,
  onRideAccepted,
}: RideRequestCardProps) => {
  const { toast } = useToast();
  const [pendingRide, setPendingRide] = useState<PendingRide | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<"accept" | "reject" | null>(
    null
  );
  const [timeLeft, setTimeLeft] = useState(30);
  const [maxSearchRadius, setMaxSearchRadius] = useState<number>(10);
  const [distanceToPickup, setDistanceToPickup] = useState<number | null>(null);
  const [etaToPickup, setEtaToPickup] = useState<number | null>(null);

  // دالة للتحقق من مطابقة نوع السيارة (السائق الأعلى يخدم الطلبات الأدنى)
  const canDriverServeRide = useCallback(
    (driverType: string | null, rideType: string): boolean => {
      if (!driverType) return true;

      // حالة خاصة: التكسي النسائي
      if (driverType === "women_only") return rideType === "women_only";
      if (rideType === "women_only") return driverType === "women_only";

      const typeHierarchy: Record<string, number> = {
        economy: 1,
        comfort: 2,
        premium: 3,
      };
      const driverLevel = typeHierarchy[driverType] || 1;
      const rideLevel = typeHierarchy[rideType] || 1;

      return rideLevel <= driverLevel;
    },
    []
  );

  // Calculate distance to pickup when ride and driver location are available
  const calculateDistanceToPickup = useCallback(
    async (pickupLat: number, pickupLng: number) => {
      if (!driverLocation) return;

      try {
        const response = await fetch(
          `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=directions&start=${driverLocation.lng},${driverLocation.lat}&end=${pickupLng},${pickupLat}`
        );
        const data = await response.json();

        if (data.routes?.[0]) {
          const route = data.routes[0];
          setDistanceToPickup(parseFloat((route.distance / 1000).toFixed(1)));
          setEtaToPickup(Math.round(route.duration / 60));
        }
      } catch (error) {
        console.error("Error calculating distance to pickup:", error);
      }
    },
    [driverLocation]
  );

  // Fetch max search radius from settings
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "max_search_radius")
        .single();

      if (data?.value) {
        const value =
          typeof data.value === "number"
            ? data.value
            : typeof data.value === "string"
            ? parseInt(data.value as string)
            : 10;
        setMaxSearchRadius(value || 10);
      }
    };
    fetchSettings();
  }, []);

  // Fetch pending rides with geographical filtering
  const fetchPendingRides = useCallback(async () => {
    if (!isOnline) {
      setPendingRide(null);
      return;
    }

    try {
      // If driver has location, use geographical filtering
      if (driverLocation) {
        const { data, error } = await supabase.rpc("get_nearby_pending_rides", {
          driver_lat: driverLocation.lat,
          driver_lng: driverLocation.lng,
          max_radius_km: maxSearchRadius,
          driver_vehicle_type: (vehicleType || "economy") as
            | "economy"
            | "comfort"
            | "premium"
            | "women_only",
        });

        if (!error && data && data.length > 0) {
          const ride = data[0];
          const newRide: PendingRide = {
            id: ride.id,
            pickup_location: ride.pickup_location as {
              lat: number;
              lng: number;
            },
            dropoff_location: ride.dropoff_location as {
              lat: number;
              lng: number;
            },
            pickup_address: ride.pickup_address,
            dropoff_address: ride.dropoff_address,
            estimated_fare: ride.estimated_fare,
            distance_km: ride.distance_km ? Number(ride.distance_km) : null,
            duration_minutes: ride.duration_minutes,
            vehicle_type: ride.vehicle_type || "economy",
            created_at: ride.created_at,
            rider_id: ride.rider_id || "",
          };
          setPendingRide(newRide);
          setTimeLeft(30);

          // Calculate distance to pickup
          const pickupLoc = ride.pickup_location as {
            lat: number;
            lng: number;
          };
          calculateDistanceToPickup(pickupLoc.lat, pickupLoc.lng);
          return;
        }
      } else {
        // Fallback to old method if no location
        const { data, error } = await supabase
          .from("rides")
          .select("*")
          .eq("status", "pending")
          .is("driver_id", null)
          .order("created_at", { ascending: true })
          .limit(1);

        if (!error && data && data.length > 0) {
          const ride = data[0];
          // منطق مطابقة نوع السيارة المحسّن
          const canServe = canDriverServeRide(
            vehicleType,
            ride.vehicle_type || "economy"
          );

          if (canServe) {
            const newRide: PendingRide = {
              id: ride.id,
              pickup_location: ride.pickup_location as {
                lat: number;
                lng: number;
              },
              dropoff_location: ride.dropoff_location as {
                lat: number;
                lng: number;
              },
              pickup_address: ride.pickup_address,
              dropoff_address: ride.dropoff_address,
              estimated_fare: ride.estimated_fare,
              distance_km: ride.distance_km ? Number(ride.distance_km) : null,
              duration_minutes: ride.duration_minutes,
              vehicle_type: ride.vehicle_type || "economy",
              created_at: ride.created_at,
              rider_id: ride.rider_id || "",
            };
            setPendingRide(newRide);
            setTimeLeft(30);

            // Calculate distance to pickup
            const pickupLoc = ride.pickup_location as {
              lat: number;
              lng: number;
            };
            calculateDistanceToPickup(pickupLoc.lat, pickupLoc.lng);
            return;
          }
        }
      }

      setPendingRide(null);
      setDistanceToPickup(null);
      setEtaToPickup(null);
    } catch (error) {
      console.error("Error fetching rides:", error);
      setPendingRide(null);
    }
  }, [
    isOnline,
    vehicleType,
    driverLocation,
    maxSearchRadius,
    calculateDistanceToPickup,
  ]);

  // Play notification sound when new ride arrives
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      const playTone = (
        frequency: number,
        duration: number,
        startTime: number
      ) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = "sine";

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.5, startTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const now = audioContext.currentTime;
      playTone(523.25, 0.15, now);
      playTone(659.25, 0.15, now + 0.15);
      playTone(783.99, 0.3, now + 0.3);
    } catch (e) {
      console.log("Audio not supported");
    }

    // Vibrate
    if ("vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  }, []);

  // Listen for new rides with INSTANT realtime
  useEffect(() => {
    if (!isOnline) {
      setPendingRide(null);
      return;
    }

    // Fetch immediately on mount
    fetchPendingRides();

    // Setup realtime subscription for INSTANT updates
    const channel = supabase
      .channel("driver-pending-rides-instant")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rides",
          filter: "status=eq.pending",
        },
        (payload) => {
          console.log("⚡ NEW RIDE INSERTED:", payload.new?.id);
          playNotificationSound();
          // Fetch immediately - don't wait
          fetchPendingRides();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rides",
        },
        (payload) => {
          // If current ride was taken by another driver, fetch next
          if (pendingRide && payload.new?.id === pendingRide.id) {
            if (payload.new?.status !== "pending" || payload.new?.driver_id) {
              console.log("Current ride taken, fetching next...");
              setPendingRide(null);
              fetchPendingRides();
            }
          }
        }
      )
      .subscribe((status) => {
        console.log("🔴 Realtime subscription status:", status);
        if (status === "SUBSCRIBED") {
          console.log(
            "✅ Realtime connected - will receive instant ride updates"
          );
        }
      });

    // Also poll every 5 seconds as backup (reduced from default)
    const pollInterval = setInterval(() => {
      if (!pendingRide) {
        fetchPendingRides();
      }
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [isOnline, fetchPendingRides, playNotificationSound, pendingRide]);

  // Countdown timer
  useEffect(() => {
    if (!pendingRide) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Auto-skip after timeout
          setPendingRide(null);
          fetchPendingRides();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [pendingRide, fetchPendingRides]);

  const handleAccept = async () => {
    if (!pendingRide) return;

    setLoading(true);
    setActionType("accept");

    try {
      // استخدام الدالة الآمنة لقبول الرحلة (تمنع Race Condition)
      const { data: result, error } = await supabase.rpc("accept_ride_safely", {
        p_ride_id: pendingRide.id,
        p_driver_id: driverId,
      });

      if (error) throw error;

      // التحقق من نجاح العملية
      const response = result as {
        success: boolean;
        error?: string;
        message?: string;
      };

      if (!response.success) {
        toast({
          title: "لم يتم قبول الطلب",
          description: response.error || "تم قبول الطلب من سائق آخر",
          variant: "destructive",
        });
        fetchPendingRides();
        return;
      }

      // ⚡ INSTANT: إرسال إشعار broadcast للراكب بأن السائق قبل الطلب
      try {
        const commChannel = supabase.channel(`ride-comm-${pendingRide.id}`, {
          config: { broadcast: { self: false } },
        });

        // Subscribe and wait for confirmation before sending
        await new Promise<void>((resolve) => {
          commChannel.subscribe((status) => {
            if (status === "SUBSCRIBED") {
              resolve();
            }
          });
        });

        // Send acceptance broadcast
        await commChannel.send({
          type: "broadcast",
          event: "ride_accepted",
          payload: {
            driverId,
            message: "تم قبول طلبك! السائق في الطريق إليك",
            timestamp: new Date().toISOString(),
          },
        });

        console.log(
          "[Driver] ⚡ INSTANT: Sent ride_accepted broadcast to rider"
        );

        // Small delay to ensure message is delivered before removing channel
        await new Promise((resolve) => setTimeout(resolve, 200));
        supabase.removeChannel(commChannel);
      } catch (broadcastError) {
        console.error("Error sending acceptance broadcast:", broadcastError);
      }

      toast({
        title: "تم قبول الطلب! ✅",
        description: "توجه إلى موقع العميل",
      });

      // إعلام المكون الأب بأنه تم قبول الرحلة
      if (onRideAccepted) {
        onRideAccepted();
      }

      setPendingRide(null);
    } catch (error: any) {
      console.error("Accept error:", error);
      toast({
        title: "خطأ",
        description: "تم قبول الطلب من سائق آخر",
        variant: "destructive",
      });
      fetchPendingRides();
    } finally {
      setLoading(false);
      setActionType(null);
    }
  };

  const handleReject = async () => {
    if (!pendingRide) return;

    setLoading(true);
    setActionType("reject");

    try {
      // تسجيل رفض السائق في matching log
      await supabase.rpc("update_driver_response", {
        p_ride_id: pendingRide.id,
        p_driver_id: driverId,
        p_response: "rejected",
      });
    } catch (error) {
      console.error("Error logging rejection:", error);
    }

    // تخطي الطلب محلياً
    setTimeout(() => {
      setPendingRide(null);
      setLoading(false);
      setActionType(null);
      toast({
        title: "تم تخطي الطلب",
        description: "سيظهر لك الطلب التالي",
      });
      fetchPendingRides();
    }, 500);
  };

  if (!isOnline || !pendingRide) return null;

  return (
    <div className="mb-6 rounded-2xl overflow-hidden shadow-2xl border-2 border-primary">
      {/* Header with Timer */}
      <div className="bg-primary px-4 pt-4 pb-3">
        {/* Progress Bar */}
        <div className="h-1 bg-white/30 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              timeLeft <= 10 ? "bg-red-400" : "bg-white"
            }`}
            style={{ width: `${(timeLeft / 30) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">طلب رحلة جديد!</h1>
              <Badge className="mt-0.5 bg-white/20 text-white border-0 hover:bg-white/20 text-xs">
                {getVehicleTypeName(pendingRide.vehicle_type)}
              </Badge>
            </div>
          </div>

          {/* Timer */}
          <div
            className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center ${
              timeLeft <= 10 ? "bg-red-500" : "bg-white/20"
            }`}
          >
            <span className="text-2xl font-black text-white leading-none">
              {timeLeft}
            </span>
            <span className="text-[9px] text-white/80">ثانية</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-background px-4 py-3">
        {/* Fare Card - Most Important */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-3 mb-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white/80">
              <Wallet className="w-4 h-4" />
              <span className="text-xs">الأجرة</span>
            </div>
            <div className="text-left">
              <span className="text-2xl font-black text-white">
                {(pendingRide.estimated_fare || 0).toLocaleString()}
              </span>
              <span className="text-xs text-white/80 mr-1">د.ع</span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* Distance to Customer */}
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-2.5 border border-blue-200 dark:border-blue-900">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
                <Navigation className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                المسافة إليك
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-foreground">
                {distanceToPickup ?? "?"}
              </span>
              <span className="text-xs text-muted-foreground">كم</span>
              <span className="text-xs text-muted-foreground mr-1">
                • {etaToPickup ?? "?"} د
              </span>
            </div>
          </div>

          {/* Trip Info */}
          <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-2.5 border border-purple-200 dark:border-purple-900">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-purple-500 flex items-center justify-center">
                <Route className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                تفاصيل الرحلة
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-foreground">
                {pendingRide.distance_km ?? "?"}
              </span>
              <span className="text-xs text-muted-foreground">كم</span>
              <span className="text-xs text-muted-foreground mr-1">
                • {pendingRide.duration_minutes ?? "?"} د
              </span>
            </div>
          </div>
        </div>

        {/* Route Card - Compact */}
        <div className="bg-card rounded-xl border border-border overflow-hidden mb-3">
          <div className="px-3 py-2 bg-muted/50 border-b border-border">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              مسار الرحلة
            </h3>
          </div>
          <div className="p-3">
            <div className="flex gap-2.5">
              {/* Route Line */}
              <div className="flex flex-col items-center py-0.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <div className="w-0.5 flex-1 bg-gradient-to-b from-green-500 to-red-500 my-1.5 min-h-[40px]" />
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              </div>
              {/* Addresses */}
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <p className="text-[10px] text-green-600 dark:text-green-400 font-semibold mb-0.5">
                    نقطة الانطلاق
                  </p>
                  <p className="text-xs text-foreground line-clamp-2 leading-relaxed">
                    {pendingRide.pickup_address ||
                      getLocationString(pendingRide.pickup_location)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-red-600 dark:text-red-400 font-semibold mb-0.5">
                    الوجهة
                  </p>
                  <p className="text-xs text-foreground line-clamp-2 leading-relaxed">
                    {pendingRide.dropoff_address ||
                      getLocationString(pendingRide.dropoff_location)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="px-4 py-3 bg-background border-t border-border">
        <div className="flex gap-2.5">
          <Button
            variant="outline"
            className="flex-1 h-12 text-sm border-2 border-destructive/30 text-destructive hover:bg-destructive hover:text-white hover:border-destructive rounded-xl"
            onClick={handleReject}
            disabled={loading}
          >
            {loading && actionType === "reject" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <X className="w-4 h-4 ml-2" />
                رفض
              </>
            )}
          </Button>
          <Button
            className="flex-1 h-12 text-sm bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg shadow-primary/30"
            onClick={handleAccept}
            disabled={loading}
          >
            {loading && actionType === "accept" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4 ml-2" />
                قبول
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RideRequestCard;
