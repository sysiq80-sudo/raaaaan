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
  X,
  Check,
  Loader2,
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
}

interface RideRequestCardProps {
  driverId: string;
  vehicleType: string | null;
  isOnline: boolean;
  driverLocation?: { lat: number; lng: number } | null;
  onRideAccepted?: () => void;
  maxPickupRadius?: number;
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
  maxPickupRadius = 10,
}: RideRequestCardProps) => {
  const { toast } = useToast();
  const [pendingRide, setPendingRide] = useState<PendingRide | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<"accept" | "reject" | null>(
    null
  );
  const [timeLeft, setTimeLeft] = useState(30);
  const [debugMode, setDebugMode] = useState(false);

  const canDriverServeRide = useCallback(
    (driverType: string | null, rideType: string): boolean => {
      if (!driverType) return true;
      if (driverType === "women_only") return rideType === "women_only";
      if (rideType === "women_only") return driverType === "women_only";
      const typeHierarchy: Record<string, number> = {
        economy: 1,
        comfort: 2,
        premium: 3,
      };
      const d = typeHierarchy[driverType] || 1;
      const r = typeHierarchy[rideType] || 1;
      return d >= r;
    },
    []
  );

  const fetchPendingRides = useCallback(async () => {
    if (!isOnline) {
      setPendingRide(null);
      return;
    }
    try {
      if (driverLocation) {
        // استخدم نطاق السائق المحدد فقط
        console.log("🔍 [RideRequestCard] Searching for rides:", {
          driver_lat: driverLocation.lat,
          driver_lng: driverLocation.lng,
          max_radius_km: maxPickupRadius,
          driver_vehicle_type: vehicleType || "economy",
        });

        const { data, error } = await supabase.rpc("get_nearby_pending_rides", {
          driver_lat: driverLocation.lat,
          driver_lng: driverLocation.lng,
          max_radius_km: maxPickupRadius,
          driver_vehicle_type: (vehicleType || "economy") as
            | "economy"
            | "comfort"
            | "premium"
            | "women_only",
        });

        console.log("📦 [RideRequestCard] RPC Result:", {
          data,
          error,
          count: data?.length || 0,
        });

        if (!error && data && data.length > 0) {
          console.log(
            "✅ [RideRequestCard] Found ride, creating newRide object..."
          );
          const ride = data[0];
          console.log("📄 [RideRequestCard] Raw ride data:", ride);

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
          console.log("🎉 [RideRequestCard] Setting pendingRide:", newRide);
          setPendingRide(newRide);
          setTimeLeft(30);
          console.log("✅ [RideRequestCard] Ride set successfully!");
        } else {
          console.log("❌ [RideRequestCard] No rides found or error occurred");
          // لا طلبات ضمن النطاق
          setPendingRide(null);
        }
      } else {
        // Fallback: ابحث عن أي طلب معلق إذا لم يكن هناك موقع سائق
        console.log(
          "🔄 [RideRequestCard] No driver location, using fallback query"
        );
        const { data, error } = await supabase
          .from("rides")
          .select("*")
          .eq("status", "pending")
          .is("driver_id", null)
          .order("created_at", { ascending: true })
          .limit(1);
        if (!error && data && data.length > 0) {
          const ride = data[0];
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
            return;
          }
        }
      }
      setPendingRide(null);
    } catch (error) {
      console.error("[RideRequestCard] Error fetching rides:", error);
      setPendingRide(null);
    }
  }, [
    isOnline,
    vehicleType,
    driverLocation,
    maxPickupRadius,
    canDriverServeRide,
  ]);

  useEffect(() => {
    console.log("🔄 [RideRequestCard] useEffect triggered:", {
      isOnline,
      hasPendingRide: !!pendingRide,
      hasLocation: !!driverLocation,
      maxPickupRadius,
      vehicleType,
    });

    if (!isOnline) {
      console.log("❌ [RideRequestCard] Driver is offline, skipping fetch");
      setPendingRide(null);
      return;
    }

    console.log("▶️ [RideRequestCard] Calling fetchPendingRides...");
    fetchPendingRides();
    const pollInterval = setInterval(() => {
      console.log("🔁 [RideRequestCard] Polling for new rides...");
      fetchPendingRides();
    }, 5000);
    return () => clearInterval(pollInterval);
  }, [isOnline, fetchPendingRides]);

  // Countdown timer effect
  useEffect(() => {
    if (!pendingRide) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
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
      const { error } = await supabase.rpc("accept_ride_safely", {
        p_ride_id: pendingRide.id,
        p_driver_id: driverId,
      });
      if (error) throw error;
      toast({ title: "تم القبول", description: "تم قبول الطلب بنجاح" });
      onRideAccepted?.();
      setPendingRide(null);
    } catch (e: any) {
      toast({
        title: "خطأ",
        description: e?.message || "تم قبول الطلب من سائق آخر",
        variant: "destructive",
      });
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
      await supabase.rpc("update_driver_response", {
        p_ride_id: pendingRide.id,
        p_driver_id: driverId,
        p_response: "rejected",
      });
    } catch {}
    setPendingRide(null);
    toast({ title: "تم التخطي", description: "سيتم عرض الطلب التالي" });
    setLoading(false);
    setActionType(null);
  };

  console.log("🖼️ [RideRequestCard] Render check:", {
    isOnline,
    hasPendingRide: !!pendingRide,
    pendingRideId: pendingRide?.id,
    willShowCard: isOnline && !!pendingRide,
  });

  if (!isOnline || !pendingRide) {
    if (isOnline && !pendingRide) {
      return (
        <div className="mb-6 rounded-2xl overflow-hidden shadow-lg border-2 border-orange-400 bg-card">
          <div className="px-4 py-6 text-center">
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-500" />
              </div>
            </div>
            <h3 className="text-base font-bold text-foreground mb-2">
              بحث عن الطلبات...
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {driverLocation
                ? "لا توجد طلبات متاحة بالقرب منك حالياً"
                : "تفعيل الموقع لرؤية الطلبات المتاحة"}
            </p>
            {debugMode && (
              <div className="mt-4 p-3 bg-muted rounded-lg text-xs text-left text-muted-foreground space-y-1">
                <div>
                  📍 الموقع:{" "}
                  {driverLocation ? getLocationString(driverLocation) : "معطل"}
                </div>
                <div>🚗 نوع السيارة: {vehicleType || "غير محدد"}</div>
                <div>📡 حالة الاتصال: {isOnline ? "متصل" : "غير متصل"}</div>
                <div>🎯 نطاق استقبال الطلبات: {maxPickupRadius} كم</div>
              </div>
            )}
            <button
              onClick={() => setDebugMode(!debugMode)}
              className="mt-3 text-xs text-muted-foreground hover:text-foreground underline"
            >
              {debugMode ? "إخفاء التفاصيل" : "عرض التفاصيل"}
            </button>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="mb-6 rounded-2xl overflow-hidden shadow-2xl border-2 border-primary">
      <div className="bg-primary px-4 pt-4 pb-3">
        <div className="h-1 bg-white/30 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              timeLeft <= 10 ? "bg-red-400" : "bg-white"
            }`}
            style={{ width: `${(timeLeft / 30) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-white" />
            <span className="text-white font-bold">{timeLeft}s</span>
          </div>
          <Badge className="bg-white text-primary font-bold">طلب جديد</Badge>
        </div>
      </div>

      <div className="px-4 py-3 bg-card">
        <div className="grid grid-cols-2 gap-3">
          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">
                  الأجرة المتوقعة
                </span>
              </div>
              <div className="mt-2 text-xl font-bold text-foreground">
                {pendingRide.estimated_fare ?? "-"} د.ع
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">
                  نوع السيارة
                </span>
              </div>
              <div className="mt-2 text-sm font-bold text-foreground">
                {getVehicleTypeName(pendingRide.vehicle_type)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden mt-3">
          <div className="px-3 py-2 bg-muted/50 border-b border-border">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              مسار الرحلة
            </h3>
          </div>
          <div className="p-3">
            <div className="flex gap-2.5">
              <div className="flex flex-col items-center py-0.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <div className="w-0.5 flex-1 bg-gradient-to-b from-green-500 to-red-500 my-1.5 min-h-[40px]" />
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              </div>
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
