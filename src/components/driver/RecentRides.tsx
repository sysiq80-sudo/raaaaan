import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  ChevronLeft,
  MapPin
} from "lucide-react";

interface RecentRide {
  id: string;
  status: string;
  final_fare: number | null;
  estimated_fare: number | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  completed_at: string | null;
  created_at: string;
}

interface RecentRidesProps {
  driverId: string;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  completed: {
    label: 'مكتملة',
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'text-green-500'
  },
  cancelled: {
    label: 'ملغاة',
    icon: <XCircle className="w-4 h-4" />,
    color: 'text-destructive'
  },
  in_progress: {
    label: 'جارية',
    icon: <Clock className="w-4 h-4" />,
    color: 'text-blue-500'
  },
  accepted: {
    label: 'مقبولة',
    icon: <Clock className="w-4 h-4" />,
    color: 'text-amber-500'
  },
  arrived: {
    label: 'بانتظار العميل',
    icon: <Clock className="w-4 h-4" />,
    color: 'text-amber-500'
  }
};

export const RecentRides = ({ driverId }: RecentRidesProps) => {
  const [rides, setRides] = useState<RecentRide[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecentRides = useCallback(async () => {
    if (!driverId) return;

    try {
      const { data, error } = await supabase
        .from("rides")
        .select("id, status, final_fare, estimated_fare, pickup_address, dropoff_address, completed_at, created_at")
        .eq("driver_id", driverId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!error && data) {
        setRides(data);
      }
    } catch (error) {
      console.error("Error fetching recent rides:", error);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    fetchRecentRides();

    // Listen for ride updates
    const channel = supabase
      .channel('driver-recent-rides')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rides',
          filter: `driver_id=eq.${driverId}`
        },
        () => fetchRecentRides()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId, fetchRecentRides]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffMins < 1440) return `منذ ${Math.floor(diffMins / 60)} ساعة`;
    return date.toLocaleDateString('ar-IQ');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-secondary rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (rides.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">لا توجد رحلات سابقة</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">آخر الرحلات</CardTitle>
          <Link to="/driver/rides">
            <Button variant="ghost" size="sm" className="text-xs">
              عرض الكل
              <ChevronLeft className="w-4 h-4 mr-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {rides.map((ride) => {
          const config = statusConfig[ride.status] || statusConfig.completed;
          const fare = ride.final_fare || ride.estimated_fare || 0;
          
          return (
            <div 
              key={ride.id}
              className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className={`${config.color}`}>
                  {config.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground truncate max-w-[150px]">
                    {ride.dropoff_address || 'رحلة'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(ride.completed_at || ride.created_at)}
                  </p>
                </div>
              </div>
              <div className="text-left">
                <p className={`text-sm font-bold ${ride.status === 'cancelled' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {fare.toLocaleString('en-US')} د.ع
                </p>
                <p className={`text-xs ${config.color}`}>
                  {config.label}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default RecentRides;
