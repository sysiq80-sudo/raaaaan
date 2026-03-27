import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SplashScreen from "@/components/common/SplashScreen";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Session } from "@supabase/supabase-js";
import { 
  Car, 
  MapPin, 
  Clock,
  CheckCircle,
  XCircle,
  Navigation
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import DriverPageHeader from "@/components/driver/DriverPageHeader";

interface Ride {
  id: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  status: string | null;
  final_fare: number | null;
  estimated_fare: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  created_at: string;
  completed_at: string | null;
  payment_method: string | null;
}

const DriverRides = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState<Ride[]>([]);
  const [driverId, setDriverId] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchDriverAndRides();
    }
  }, [user]);

  const fetchDriverAndRides = async () => {
    try {
      // Get driver ID
      const { data: driver } = await supabase
        .from("drivers")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (driver) {
        setDriverId(driver.id);
        
        // Fetch rides
        const { data: ridesData } = await supabase
          .from("rides")
          .select("*")
          .eq("driver_id", driver.id)
          .order("created_at", { ascending: false })
          .limit(50);

        setRides(ridesData || []);
      }
    } catch (error) {
      console.error("Error fetching rides:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "قيد الانتظار", variant: "secondary" },
      accepted: { label: "مقبولة", variant: "default" },
      arrived: { label: "وصلت", variant: "default" },
      in_progress: { label: "جارية", variant: "default" },
      completed: { label: "مكتملة", variant: "outline" },
      cancelled: { label: "ملغاة", variant: "destructive" },
    };
    const config = statusConfig[status || "pending"] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPaymentLabel = (method: string | null) => {
    const methods: Record<string, string> = {
      cash: "نقدي",
      nas_wallet: "المحفظة",
      nass: "البطاقة",
      wallet: "المحفظة",
      card: "البطاقة",
      zain_cash: "نقدي",
      asia_hawala: "نقدي",
      qi_card: "البطاقة",
    };
    return methods[method || "cash"] || "نقدي";
  };

  const completedRides = rides.filter(r => r.status === "completed");
  const activeRides = rides.filter(r => ["pending", "accepted", "arrived", "in_progress"].includes(r.status || ""));
  const cancelledRides = rides.filter(r => r.status === "cancelled");

  if (loading) {
    return <SplashScreen />;
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <DriverPageHeader title="رحلاتي" />
      {/* Main Content */}
      <main className="pt-20 pb-8 px-4">
        <div className="container max-w-lg">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="text-center">
              <CardContent className="p-4">
                <CheckCircle className="w-5 h-5 mx-auto mb-2 text-primary" />
                <p className="text-lg font-bold">{completedRides.length}</p>
                <p className="text-xs text-muted-foreground">مكتملة</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-4">
                <Navigation className="w-5 h-5 mx-auto mb-2 text-info" />
                <p className="text-lg font-bold">{activeRides.length}</p>
                <p className="text-xs text-muted-foreground">نشطة</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-4">
                <XCircle className="w-5 h-5 mx-auto mb-2 text-destructive" />
                <p className="text-lg font-bold">{cancelledRides.length}</p>
                <p className="text-xs text-muted-foreground">ملغاة</p>
              </CardContent>
            </Card>
          </div>

          {/* Rides Tabs */}
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList className="w-full bg-muted/50">
              <TabsTrigger value="all" className="flex-1">الكل</TabsTrigger>
              <TabsTrigger value="completed" className="flex-1">مكتملة</TabsTrigger>
              <TabsTrigger value="cancelled" className="flex-1">ملغاة</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-3">
              {rides.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Car className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">لا توجد رحلات بعد</p>
                  </CardContent>
                </Card>
              ) : (
                rides.map((ride) => <RideCard key={ride.id} ride={ride} getStatusBadge={getStatusBadge} getPaymentLabel={getPaymentLabel} />)
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-3">
              {completedRides.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">لا توجد رحلات مكتملة</p>
                  </CardContent>
                </Card>
              ) : (
                completedRides.map((ride) => <RideCard key={ride.id} ride={ride} getStatusBadge={getStatusBadge} getPaymentLabel={getPaymentLabel} />)
              )}
            </TabsContent>

            <TabsContent value="cancelled" className="space-y-3">
              {cancelledRides.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <XCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">لا توجد رحلات ملغاة</p>
                  </CardContent>
                </Card>
              ) : (
                cancelledRides.map((ride) => <RideCard key={ride.id} ride={ride} getStatusBadge={getStatusBadge} getPaymentLabel={getPaymentLabel} />)
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

const RideCard = ({ 
  ride, 
  getStatusBadge, 
  getPaymentLabel 
}: { 
  ride: Ride; 
  getStatusBadge: (status: string | null) => React.ReactNode;
  getPaymentLabel: (method: string | null) => string;
}) => (
  <Card className="card-hover">
    <CardContent className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          {format(new Date(ride.created_at), "d MMM yyyy - HH:mm", { locale: ar })}
        </div>
        {getStatusBadge(ride.status)}
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-primary mt-2" />
          <p className="text-sm text-foreground">{ride.pickup_address || "نقطة الانطلاق"}</p>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-destructive mt-2" />
          <p className="text-sm text-foreground">{ride.dropoff_address || "الوجهة"}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="w-4 h-4" />
            {ride.distance_km?.toFixed(1) || "0"} كم
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-4 h-4" />
            {ride.duration_minutes || "0"} د
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{getPaymentLabel(ride.payment_method)}</Badge>
          <span className="font-bold text-primary">
            {(ride.final_fare || ride.estimated_fare || 0).toLocaleString()} د.ع
          </span>
        </div>
      </div>
    </CardContent>
  </Card>
);

export default DriverRides;
