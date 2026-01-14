import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowRight,
  MapPin,
  Navigation,
  Calendar,
  Clock,
  Star,
  Car,
  RefreshCw,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface RideHistory {
  id: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  pickup_location: { lat: number; lng: number };
  dropoff_location: { lat: number; lng: number };
  status: string;
  final_fare: number | null;
  estimated_fare: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  vehicle_type: string | null;
  driver_id: string | null;
  created_at: string;
  completed_at: string | null;
  driver_rating: number | null;
}

const RiderRidesPage: React.FC = () => {
  const navigate = useNavigate();
  const [rides, setRides] = useState<RideHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "completed" | "cancelled">("all");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate("/auth?redirect=/rider/rides");
        return;
      }
      setUserId(data.user.id);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (userId) {
      fetchRides();
    }
  }, [userId, filter]);

  const fetchRides = async () => {
    if (!userId) return;
    setLoading(true);

    let query = supabase
      .from("rides")
      .select("*")
      .eq("rider_id", userId)
      .order("created_at", { ascending: false });

    if (filter === "completed") {
      query = query.eq("status", "completed");
    } else if (filter === "cancelled") {
      query = query.eq("status", "cancelled");
    }

    const { data, error } = await query.limit(50);

    if (!error && data) {
      setRides(
        data.map((ride) => ({
          ...ride,
          pickup_location: ride.pickup_location as { lat: number; lng: number },
          dropoff_location: ride.dropoff_location as { lat: number; lng: number },
        }))
      );
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "قيد الانتظار", variant: "secondary" },
      accepted: { label: "تم القبول", variant: "default" },
      arrived: { label: "وصل السائق", variant: "default" },
      in_progress: { label: "جارية", variant: "default" },
      completed: { label: "مكتملة", variant: "outline" },
      cancelled: { label: "ملغاة", variant: "destructive" },
    };
    const config = statusConfig[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleRebook = (ride: RideHistory) => {
    // Navigate to go page with pre-filled locations
    const params = new URLSearchParams({
      pickup_lat: ride.pickup_location.lat.toString(),
      pickup_lng: ride.pickup_location.lng.toString(),
      pickup_address: ride.pickup_address || "",
      dropoff_lat: ride.dropoff_location.lat.toString(),
      dropoff_lng: ride.dropoff_location.lng.toString(),
      dropoff_address: ride.dropoff_address || "",
    });
    navigate(`/rider?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/rider")}
            className="shrink-0"
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">رحلاتي</h1>
        </div>

        {/* Filter Tabs */}
        <div className="px-4 pb-3">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="all">الكل</TabsTrigger>
              <TabsTrigger value="completed">مكتملة</TabsTrigger>
              <TabsTrigger value="cancelled">ملغاة</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : rides.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <Car className="w-16 h-16 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">لا توجد رحلات سابقة</p>
            <Button onClick={() => navigate("/rider")} className="gap-2">
              <Navigation className="w-4 h-4" />
              احجز رحلتك الأولى
            </Button>
          </div>
        ) : (
          rides.map((ride) => (
            <Card key={ride.id} className="overflow-hidden">
              <CardContent className="p-4">
                {/* Header with date and status */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(ride.created_at), "d MMM yyyy", { locale: ar })}
                    <span>•</span>
                    <Clock className="w-4 h-4" />
                    {format(new Date(ride.created_at), "h:mm a", { locale: ar })}
                  </div>
                  {getStatusBadge(ride.status)}
                </div>

                {/* Locations */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5 shrink-0" />
                    <p className="text-sm">{ride.pickup_address || "موقع الانطلاق"}</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5 shrink-0" />
                    <p className="text-sm">{ride.dropoff_address || "الوجهة"}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    {ride.distance_km && (
                      <span className="text-muted-foreground">
                        {ride.distance_km.toFixed(1)} كم
                      </span>
                    )}
                    {ride.driver_rating && (
                      <div className="flex items-center gap-1 text-amber-500">
                        <Star className="w-4 h-4 fill-current" />
                        {ride.driver_rating}
                      </div>
                    )}
                  </div>
                  <div className="font-bold text-lg">
                    {(ride.final_fare || ride.estimated_fare || 0).toLocaleString()} د.ع
                  </div>
                </div>

                {/* Rebook button for completed rides */}
                {ride.status === "completed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRebook(ride)}
                    className="w-full mt-3 gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    إعادة الحجز
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}

        {/* Refresh button */}
        {!loading && rides.length > 0 && (
          <Button
            variant="ghost"
            onClick={fetchRides}
            className="w-full gap-2 text-muted-foreground"
          >
            <RefreshCw className="w-4 h-4" />
            تحديث القائمة
          </Button>
        )}
      </div>
    </div>
  );
};

export default RiderRidesPage;
