import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { MapPin, Navigation, Car, Clock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Map from "@/components/Map";

interface RideData {
  id: string;
  status: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_location: { lat: number; lng: number };
  dropoff_location: { lat: number; lng: number };
  driver: {
    full_name: string;
    vehicle_model: string;
    vehicle_color: string;
    vehicle_plate: string;
    current_location: { lat: number; lng: number } | null;
  } | null;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "في انتظار سائق", color: "bg-yellow-500" },
  accepted: { label: "السائق في الطريق", color: "bg-blue-500" },
  arrived: { label: "السائق وصل", color: "bg-purple-500" },
  in_progress: { label: "الرحلة جارية", color: "bg-green-500" },
  completed: { label: "مكتملة", color: "bg-gray-500" },
  cancelled: { label: "ملغاة", color: "bg-red-500" },
};

export default function TrackRide() {
  const { token } = useParams<{ token: string }>();
  const [ride, setRide] = useState<RideData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRide = async () => {
      if (!token) {
        setError("رابط غير صالح");
        setLoading(false);
        return;
      }

      // Use secure RPC function to get ride details
      const { data, error: rpcError } = await supabase
        .rpc('get_ride_by_share_token', { p_token: token });

      if (rpcError) {
        console.error('Error fetching ride:', rpcError);
        setError("حدث خطأ أثناء تحميل بيانات الرحلة");
        setLoading(false);
        return;
      }

      const result = data as { success: boolean; error?: string; ride?: any };
      
      if (!result?.success) {
        setError(result?.error || "رابط غير صالح أو منتهي الصلاحية");
        setLoading(false);
        return;
      }

      const rideData = result.ride;
      setRide({
        id: rideData.id,
        status: rideData.status,
        pickup_address: rideData.pickup_address,
        dropoff_address: rideData.dropoff_address,
        pickup_location: rideData.pickup_location as { lat: number; lng: number },
        dropoff_location: rideData.dropoff_location as { lat: number; lng: number },
        driver: rideData.driver ? {
          full_name: rideData.driver.full_name,
          vehicle_model: rideData.driver.vehicle_model,
          vehicle_color: rideData.driver.vehicle_color,
          vehicle_plate: rideData.driver.vehicle_plate,
          current_location: rideData.driver.current_location as { lat: number; lng: number } | null
        } : null
      });
      setLoading(false);
    };

    fetchRide();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('track-ride')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rides',
          filter: `id=eq.${ride?.id}`
        },
        (payload) => {
          if (payload.new) {
            setRide(prev => prev ? { ...prev, ...payload.new } : null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="text-6xl mb-4">😔</div>
            <h2 className="text-xl font-bold mb-2">عذراً</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!ride) return null;

  const status = statusLabels[ride.status] || { label: ride.status, color: "bg-gray-500" };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-bold mb-2">تتبع الرحلة</h1>
          <Badge className={`${status.color} text-white`}>
            {status.label}
          </Badge>
        </div>
      </div>

      {/* Map */}
      <div className="h-[40vh] relative">
        <Map
          pickupLocation={ride.pickup_location}
          dropoffLocation={ride.dropoff_location}
          driverLocation={ride.driver?.current_location || undefined}
          showRoute={true}
        />
      </div>

      {/* Ride Details */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Locations */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <MapPin className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">نقطة الانطلاق</p>
                <p className="font-medium">{ride.pickup_address || "غير محدد"}</p>
              </div>
            </div>

            <div className="border-r-2 border-dashed border-muted mr-4 h-4" />

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Navigation className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">الوجهة</p>
                <p className="font-medium">{ride.dropoff_address || "غير محدد"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Driver Info */}
        {ride.driver && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                معلومات السائق
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-medium">{ride.driver.full_name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Car className="h-3 w-3" />
                    <span>
                      {ride.driver.vehicle_color} {ride.driver.vehicle_model}
                    </span>
                  </div>
                  <p className="text-sm font-mono bg-muted px-2 py-0.5 rounded inline-block mt-1">
                    {ride.driver.vehicle_plate}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          يتم تحديث الموقع تلقائياً • تطبيق رعان
        </p>
      </div>
    </div>
  );
}
