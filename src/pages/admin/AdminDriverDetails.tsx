import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Phone,
  Car,
  Star,
  DollarSign,
  MapPin,
  Calendar,
  Clock,
  TrendingUp,
  Award,
  FileText,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  Navigation,
  CreditCard,
  Gift,
  BarChart3,
  Activity,
  MessageSquare,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import type { Database } from "@/integrations/supabase/types";

type Driver = Database["public"]["Tables"]["drivers"]["Row"] & {
  email?: string | null;
  residency_image_url?: string | null;
  guarantor_image_url?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ride = Record<string, any> & {
  rider?: { full_name: string; phone: string };
  ride_ratings?: { rating: number; comment: string | null }[];
};

type Subscription = Database["public"]["Tables"]["driver_subscriptions"]["Row"] & {
  plan?: { name_ar: string; commission_discount: number };
};

type CommissionTier = Database["public"]["Tables"]["commission_tiers"]["Row"];

type IncentiveClaim = {
  id: string;
  driver_id: string;
  incentive_id: string;
  period_start: string;
  period_end: string;
  rides_completed: number;
  bonus_earned: number;
  claimed_at: string;
  incentive?: { name: string; description: string; period: string };
};

const AdminDriverDetails = () => {
  // route uses ":id" so param name is "id" not "driverId"
  const { id: driverId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: authLoading, isAdmin } = useAdminAuth();

  const [driver, setDriver] = useState<Driver | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [commissionTier, setCommissionTier] = useState<CommissionTier | null>(null);
  const [incentiveClaims, setIncentiveClaims] = useState<IncentiveClaim[]>([]);
  const [monthlyEarnings, setMonthlyEarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!driverId) {
      setLoading(false);
      return;
    }
    if (isAdmin) {
      fetchDriverData();
      return;
    }
    if (!authLoading) {
      setLoading(false);
      return;
    }
    const fallbackTimer = setTimeout(() => {
      if (driverId) fetchDriverData();
    }, 1500);
    return () => clearTimeout(fallbackTimer);
  }, [isAdmin, driverId, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ⚡ drivers أُزيل من supabase_realtime — polling كل 30 ثانية بدلاً من Realtime
  useEffect(() => {
    if (!driverId || !isAdmin) return;
    const pollDriver = async () => {
      const { data } = await supabase
        .from("drivers")
        .select("*")
        .eq("id", driverId)
        .single();
      if (data) {
        setDriver(prev => prev ? { ...prev, ...data } : null);
      }
    };
    const interval = setInterval(pollDriver, 30000);
    return () => { clearInterval(interval); };
  }, [driverId, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDriverData = async () => {
    if (!driverId) return;

    try {
      setLoading(true);

      // Fetch driver details
      const { data: driverData, error: driverError } = await supabase
        .from("drivers")
        .select("*")
        .eq("id", driverId)
        .single();

      if (driverError) throw driverError;
      setDriver(driverData);

      // Fetch recent rides (without profiles join - foreign key changed)
      const { data: ridesData, error: ridesError } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", driverId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!ridesError && ridesData) {
        // enrich rides with rider profiles in a separate query
        const riderIds = Array.from(
          new Set(ridesData.map(r => r.rider_id).filter(Boolean))
        ) as string[];

        if (riderIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("user_id,full_name,phone")
            .in("user_id", riderIds);

          const profileMap: Record<string, { full_name: string; phone: string }> = {};
          (profilesData || []).forEach(p => {
            if (p.user_id) profileMap[p.user_id] = { full_name: p.full_name, phone: p.phone };
          });

          const enriched = ridesData.map(r => ({
            ...r,
            rider: profileMap[r.rider_id || ""] || undefined,
          }));

          // جلب ride_ratings لعرض تعليقات الراكب في لوحة التحكم
          const rideIds = ridesData.map(r => r.id);
          const { data: ratingsData } = await supabase
            .from("ride_ratings")
            .select("ride_id, rating, comment")
            .in("ride_id", rideIds);

          const ratingsMap: Record<string, { rating: number; comment: string | null }[]> = {};
          (ratingsData || []).forEach(rv => {
            if (!ratingsMap[rv.ride_id]) ratingsMap[rv.ride_id] = [];
            ratingsMap[rv.ride_id].push({ rating: rv.rating, comment: rv.comment });
          });

          const withRatings = enriched.map(r => ({
            ...r,
            ride_ratings: ratingsMap[r.id] || [],
          }));

          setRides(withRatings as Ride[]);
        } else {
          setRides(ridesData as Ride[]);
        }
      }

      // Fetch monthly earnings
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: monthlyRidesData } = await supabase
        .from("rides")
        .select("final_fare")
        .eq("driver_id", driverId)
        .eq("status", "completed")
        .gte("created_at", startOfMonth.toISOString());

      if (monthlyRidesData) {
        const total = monthlyRidesData.reduce((sum, r) => sum + (r.final_fare || 0), 0);
        setMonthlyEarnings(total);
      }

      // Fetch incentive claims
      const { data: claimsData } = await supabase
        .from("driver_incentive_claims")
        .select(`
          *,
          incentive:driver_incentives(name, description, period)
        `)
        .eq("driver_id", driverId)
        .order("claimed_at", { ascending: false })
        .limit(20);

      if (claimsData) {
        setIncentiveClaims(claimsData as IncentiveClaim[]);
      }

      // Fetch active subscription
      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from("driver_subscriptions")
        .select(`
          *,
          plan:subscription_plans(name_ar, commission_discount)
        `)
        .eq("driver_id", driverId)
        .eq("status", "active")
        .gte("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!subscriptionError) {
        setSubscription(subscriptionData);
      }

      // Fetch commission tier
      const commStartOfMonth = new Date();
      commStartOfMonth.setDate(1);
      commStartOfMonth.setHours(0, 0, 0, 0);

      const { count: monthlyRides } = await supabase
        .from("rides")
        .select("*", { count: "exact", head: true })
        .eq("driver_id", driverId)
        .eq("status", "completed")
        .gte("completed_at", commStartOfMonth.toISOString());

      // استخدام driverData.rating مباشرة بدلاً من استعلام منفصل
      if (monthlyRides !== null && monthlyRides !== undefined) {
        const driverRatingValue = driverData?.rating ?? 5.0;
        const { data: tierData, error: tierError } = await supabase
          .from("commission_tiers")
          .select("*")
          .eq("is_active", true)
          .lte("min_rides_monthly", monthlyRides)
          .lte("min_rating", driverRatingValue)
          .order("priority", { ascending: false })
          .limit(1);

        if (!tierError && tierData && tierData.length > 0) {
          setCommissionTier(tierData[0]);
        }
      }

    } catch (error: unknown) {
      console.error("Error fetching driver data:", error);
      setFetchError(true);
      toast({
        title: "خطأ في تحميل البيانات",
        description: "تعذّر جلب بيانات السائق — تحقق من اتصالك وأعد المحاولة",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "بانتظار الموافقة", variant: "secondary" },
      approved: { label: "مُعتمد", variant: "default" },
      rejected: { label: "مرفوض", variant: "destructive" },
      suspended: { label: "موقوف", variant: "outline" },
    };
    const config = statusConfig[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getVehicleTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      economy: "اقتصادي",
      comfort: "مريح",
      premium: "فاخر",
      women_only: "نسائي",
    };
    return types[type] || type;
  };

  const getRideStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "معلق", variant: "secondary" },
      accepted: { label: "مقبول", variant: "default" },
      arrived: { label: "وصل", variant: "default" },
      in_progress: { label: "قيد التنفيذ", variant: "default" },
      completed: { label: "مكتمل", variant: "default" },
      cancelled: { label: "ملغي", variant: "destructive" },
    };
    const config = statusConfig[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString("ar-IQ")} د.ع`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("ar-IQ", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ✅ FIX: نعرض loading فقط عند dataLoading — لا ننتظر authLoading الذي قد يتعطل
  if (loading) {
    return (
      <AdminLayout title="تفاصيل السائق">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">جاري تحميل بيانات السائق...</p>
        </div>
      </AdminLayout>
    );
  }

  // عرض خطأ مع زر إعادة المحاولة
  if (fetchError && !driver) {
    return (
      <AdminLayout title="تفاصيل السائق">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <h3 className="text-lg font-bold">تعذّر تحميل البيانات</h3>
          <p className="text-muted-foreground text-center">فشل الاتصال بقاعدة البيانات أو انتهت الجلسة</p>
          <div className="flex gap-3">
            <Button onClick={() => { setFetchError(false); setLoading(true); fetchDriverData(); }}>إعادة المحاولة</Button>
            <Button variant="outline" onClick={() => navigate("/admin/drivers")}>العودة للقائمة</Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // if somehow route param is missing, show error instead of blank loader
  if (!driverId) {
    return (
      <AdminLayout title="خطأ">
        <div className="flex items-center justify-center min-h-[400px]">
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-bold mb-2">معرّف السائق غير صالح</h3>
          <Button onClick={() => navigate("/admin/drivers")}>عودة للقائمة</Button>
        </div>
      </AdminLayout>
    );
  }

  if (!driver) {
    return (
      <AdminLayout title="تفاصيل السائق">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-bold mb-2">السائق غير موجود</h3>
            <Button onClick={() => navigate("/admin/drivers")}>
              <ArrowLeft className="w-4 h-4 ml-2" />
              العودة لقائمة السائقين
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const completedRides = rides.filter(ride => ride.status === "completed");
  const totalEarnings = completedRides.reduce((sum, ride) => sum + (ride.final_fare || 0), 0);
  const averageRating = completedRides.length > 0
    ? completedRides.reduce((sum, ride) => sum + (ride.driver_rating || 5), 0) / completedRides.length
    : 5.0;

  return (
    <AdminLayout
      title={`تفاصيل السائق: ${driver.full_name}`}
      subtitle={`الحالة: ${getStatusBadge(driver.status || "pending").props.children}`}
      actions={
        <Button variant="outline" onClick={() => navigate("/admin/drivers")}>
          <ArrowLeft className="w-4 h-4 ml-2" />
          العودة للقائمة
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Driver Profile Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-6">
              <Avatar className="w-20 h-20">
                <AvatarImage src={driver.profile_image_url || ""} />
                <AvatarFallback>
                  {driver.full_name?.charAt(0) || "س"}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-2xl font-bold">{driver.full_name}</h2>
                  <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {driver.phone}
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4" />
                      {driver.rating?.toFixed(1) || "5.0"}
                    </div>
                    <div className="flex items-center gap-1">
                      <Car className="w-4 h-4" />
                      {getVehicleTypeLabel(driver.vehicle_type || "economy")}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-primary">{driver.total_rides || 0}</div>
                    <div className="text-sm text-muted-foreground">إجمالي الرحلات</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(driver.total_earnings || 0)}</div>
                    <div className="text-sm text-muted-foreground">إجمالي الأرباح</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{completedRides.length}</div>
                    <div className="text-sm text-muted-foreground">رحلات مكتملة</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{averageRating.toFixed(1)}</div>
                    <div className="text-sm text-muted-foreground">متوسط التقييم</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="rides">الرحلات</TabsTrigger>
            <TabsTrigger value="comments">التعليقات</TabsTrigger>
            <TabsTrigger value="financial">المالية</TabsTrigger>
            <TabsTrigger value="rewards">المكافآت</TabsTrigger>
            <TabsTrigger value="documents">الوثائق</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    المعلومات الشخصية
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الاسم الكامل:</span>
                    <span className="font-medium">{driver.full_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">رقم الهاتف:</span>
                    <span className="font-medium" dir="ltr">{driver.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">البريد الإلكتروني:</span>
                    <span className="font-medium" dir="ltr">{driver.email || "غير متوفر"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">تاريخ التسجيل:</span>
                    <span className="font-medium">{formatDate(driver.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">آخر تحديث:</span>
                    <span className="font-medium">{formatDate(driver.updated_at)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Vehicle Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Car className="w-5 h-5" />
                    معلومات المركبة
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">نوع المركبة:</span>
                    <Badge>{getVehicleTypeLabel(driver.vehicle_type || "economy")}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">موديل المركبة:</span>
                    <span className="font-medium">{driver.vehicle_model || "غير محدد"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">لون المركبة:</span>
                    <span className="font-medium">{driver.vehicle_color || "غير محدد"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">رقم اللوحة:</span>
                    <span className="font-medium" dir="ltr">{driver.vehicle_plate || "غير محدد"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">رقم الرخصة:</span>
                    <span className="font-medium" dir="ltr">{driver.license_number || "غير محدد"}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Status Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    حالة الحساب
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الحالة:</span>
                    {getStatusBadge(driver.status || "pending")}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">متصل الآن:</span>
                    <Badge variant={driver.is_online ? "default" : "secondary"}>
                      {driver.is_online ? "نعم" : "لا"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">متاح للرحلات:</span>
                    <Badge variant={driver.is_available ? "default" : "destructive"}>
                      {driver.is_available ? "نعم" : "لا"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">تحت التحكم الإداري:</span>
                    <Badge variant={driver.admin_controlled ? "default" : "secondary"}>
                      {driver.admin_controlled ? "نعم" : "لا"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">مفعل من الأدمن:</span>
                    <Badge variant={driver.admin_activated !== false ? "default" : "destructive"}>
                      {driver.admin_activated !== false ? "نعم" : "لا"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    مقاييس الأداء
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">إجمالي الرحلات:</span>
                    <span className="font-medium">{driver.total_rides || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">التقييم العام:</span>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      <span className="font-medium">{driver.rating?.toFixed(1) || "5.0"}</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">إجمالي الأرباح:</span>
                    <span className="font-medium text-green-600">{formatCurrency(driver.total_earnings || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">متوسط التقييم:</span>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      <span className="font-medium">{averageRating.toFixed(1)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Rides Tab */}
          <TabsContent value="rides" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Navigation className="w-5 h-5" />
                  الرحلات الأخيرة ({rides.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {rides.length === 0 ? (
                  <div className="text-center py-8">
                    <Navigation className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">لا توجد رحلات لهذا السائق</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {rides.map((ride) => (
                      <div key={ride.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">رحلة #{ride.id.slice(-8)}</span>
                              {getRideStatusBadge(ride.status || "pending")}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatDate(ride.created_at)}
                            </div>
                          </div>
                          <div className="text-left">
                            <div className="font-medium text-green-600">{formatCurrency(ride.final_fare || 0)}</div>
                            <div className="text-sm text-muted-foreground">{ride.distance_km?.toFixed(1)} كم</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">الراكب:</span>
                            <div className="font-medium">{ride.rider?.full_name || "غير محدد"}</div>
                            <div className="text-muted-foreground" dir="ltr">{ride.rider?.phone || ""}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">التقييم:&nbsp;</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              {ride.driver_rating ? (
                                <>
                                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                                  <span className="font-medium">{ride.driver_rating}</span>
                                </>
                              ) : (
                                <span className="text-muted-foreground">غير مقيم</span>
                              )}
                            </div>
                            {/* تعليق الراكب من ride_ratings */}
                            {ride.ride_ratings?.[0]?.comment && (() => {
                              const raw: string = ride.ride_ratings[0].comment;
                              const badgeMatch = raw.match(/\[بادجات: ([^\]]+)\]/);
                              const freePart = raw
                                .replace(/\[بادجات: [^\]]+\]\s*\|?\s*/g, '')
                                .trim();
                              const badgeIds = badgeMatch ? badgeMatch[1].split(',') : [];
                              const BADGE_MAP: Record<string, string> = {
                                clean: '🧹 نظيفة', ontime: '⏱️ دقيق', roads: '🛣️ خبير',
                                polite: '💬 مهذب', ac: '❄️ مكيف', safe: '🚗 آمن',
                              };
                              return (
                                <div className="mt-1.5 space-y-1">
                                  {badgeIds.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {badgeIds.map(b => (
                                        <span key={b} className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full px-2 py-0.5">
                                          {BADGE_MAP[b] ?? b}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {freePart && (
                                    <blockquote className="text-xs text-muted-foreground bg-muted/60 border-r-2 border-primary/50 pr-2 py-1 rounded-sm italic leading-relaxed">
                                      "{freePart}"
                                    </blockquote>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Comments Tab */}
          <TabsContent value="comments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  تعليقات الركاب
                </CardTitle>
                <CardDescription>
                  جميع التقييمات النصية والبادجات للرحلات المكتملة
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const BADGE_MAP: Record<string, string> = {
                    clean: '🧹 سيارة نظيفة', ontime: '⏱️ دقيق في المواعيد',
                    roads: '🛣️ خبير بالطرق', polite: '💬 أسلوب مهذب',
                    ac: '❄️ مكيف ممتاز', safe: '🚗 قيادة آمنة',
                  };
                  const ridesWithComments = rides.filter(r => r.ride_ratings?.[0]?.comment);
                  if (ridesWithComments.length === 0) {
                    return (
                      <div className="text-center py-12">
                        <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">لا توجد تعليقات بعد</p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-4">
                      {ridesWithComments.map((ride) => {
                        const raw: string = ride.ride_ratings![0].comment!;
                        const badgeMatch = raw.match(/\[بادجات: ([^\]]+)\]/);
                        const freePart = raw.replace(/\[بادجات: [^\]]+\]\s*\|?\s*/g, '').trim();
                        const badgeIds = badgeMatch ? badgeMatch[1].split(',') : [];
                        return (
                          <div key={ride.id} className="border rounded-xl p-4 space-y-3">
                            {/* رأس التعليق */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="text-xs font-bold text-primary">
                                    {ride.rider?.full_name?.slice(0, 2) || 'ر'}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-sm font-semibold">{ride.rider?.full_name || 'راكب غير محدد'}</p>
                                  <p className="text-xs text-muted-foreground">{formatDate(ride.created_at)}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {ride.driver_rating && (
                                  <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1">
                                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{ride.driver_rating}</span>
                                  </div>
                                )}
                                <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                                  #{ride.id.slice(-6)}
                                </span>
                              </div>
                            </div>

                            {/* البادجات */}
                            {badgeIds.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {badgeIds.map(b => (
                                  <span key={b} className="text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-full px-3 py-1">
                                    {BADGE_MAP[b] ?? b}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* النص الحر */}
                            {freePart && (
                              <blockquote className="text-sm text-foreground/80 bg-muted/60 border-r-4 border-primary/40 pr-3 py-2 rounded-md leading-relaxed italic">
                                "{freePart}"
                              </blockquote>
                            )}

                            {/* معلومات الرحلة */}
                            <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground border-t">
                              <span>📍 {ride.pickup_address?.slice(0, 30) || '—'}...</span>
                              <span>•</span>
                              <span>🚗 {(ride.distance_km || 0).toFixed(1)} كم</span>
                              <span>•</span>
                              <span>💰 {formatCurrency(ride.final_fare || 0)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Earnings Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    ملخص الأرباح
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span>إجمالي الأرباح:</span>
                    <span className="font-bold text-green-600">{formatCurrency(driver.total_earnings || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span>أرباح هذا الشهر:</span>
                    <span className="font-bold text-blue-600">{formatCurrency(monthlyEarnings)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span>متوسط لكل رحلة:</span>
                    <span className="font-bold">
                      {completedRides.length > 0
                        ? formatCurrency(totalEarnings / completedRides.length)
                        : formatCurrency(0)
                      }
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Subscription & Commission */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    الاشتراك والعمولة
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {subscription ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                        <span>الاشتراك النشط:</span>
                        <Badge variant="default">{subscription.plan?.name_ar}</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <span>خصم العمولة:</span>
                        <span className="font-medium text-green-600">-{subscription.plan?.commission_discount}%</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <span>تاريخ الانتهاء:</span>
                        <span className="font-medium">{formatDate(subscription.expires_at)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      لا يوجد اشتراك نشط
                    </div>
                  )}

                  {commissionTier && (
                    <div className="space-y-3 mt-4 pt-4 border-t">
                      <div className="flex justify-between items-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <span>المستوى الحالي:</span>
                        <Badge variant="secondary">{commissionTier.name_ar}</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <span>خصم العمولة:</span>
                        <span className="font-medium text-blue-600">-{commissionTier.commission_discount}%</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Rewards Tab */}
          <TabsContent value="rewards" className="space-y-6">
            {/* Incentive Claims Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{incentiveClaims.length}</div>
                <div className="text-sm text-muted-foreground">عدد المكافآت المكتسبة</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(incentiveClaims.reduce((s, c) => s + (c.bonus_earned || 0), 0))}
                </div>
                <div className="text-sm text-muted-foreground">إجمالي مبالغ المكافآت</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {incentiveClaims.reduce((s, c) => s + (c.rides_completed || 0), 0)}
                </div>
                <div className="text-sm text-muted-foreground">رحلات لأجل المكافآت</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Incentive Claims History */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5" />
                    سجل المكافآت ({incentiveClaims.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {incentiveClaims.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Award className="w-12 h-12 mx-auto mb-4" />
                      <p>لم يحصل السائق على أي مكافأة بعد</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {incentiveClaims.map((claim) => (
                        <div key={claim.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{claim.incentive?.name || "مكافأة"}</div>
                              <div className="text-sm text-muted-foreground">{claim.incentive?.description}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {new Date(claim.period_start).toLocaleDateString("ar-IQ")} - {new Date(claim.period_end).toLocaleDateString("ar-IQ")}
                              </div>
                            </div>
                            <div className="text-left">
                              <div className="font-bold text-green-600">{formatCurrency(claim.bonus_earned)}</div>
                              <div className="text-sm text-muted-foreground">{claim.rides_completed} رحلة</div>
                              <Badge variant="secondary" className="mt-1">
                                {claim.incentive?.period === "daily" ? "يومي" : claim.incentive?.period === "weekly" ? "أسبوعي" : "شهري"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Subscription Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="w-5 h-5" />
                    تفاصيل الاشتراك
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {subscription ? (
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">اسم الخطة:</span>
                        <span className="font-medium">{subscription.plan?.name_ar}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">خصم العمولة:</span>
                        <span className="font-medium text-green-600">{subscription.plan?.commission_discount}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">تاريخ الاشتراك:</span>
                        <span className="font-medium">{formatDate(subscription.created_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">تاريخ الانتهاء:</span>
                        <span className="font-medium">{formatDate(subscription.expires_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الحالة:</span>
                        <Badge variant="default">نشط</Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Gift className="w-12 h-12 mx-auto mb-4" />
                      <p>لا يوجد اشتراك نشط</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Commission Tier */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5" />
                    مستوى العمولة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {commissionTier ? (
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">اسم المستوى:</span>
                        <span className="font-medium">{commissionTier.name_ar}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">خصم العمولة:</span>
                        <span className="font-medium text-blue-600">{commissionTier.commission_discount}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الحد الأدنى للرحلات:</span>
                        <span className="font-medium">{commissionTier.min_rides_monthly} رحلة</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الحد الأدنى للتقييم:</span>
                        <span className="font-medium">{commissionTier.min_rating}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الأولوية:</span>
                        <span className="font-medium">{commissionTier.priority}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Award className="w-12 h-12 mx-auto mb-4" />
                      <p>لم يصل لأي مستوى بعد</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  الوثائق والملف الشخصي
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Profile Photo */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">صورة الملف الشخصي</label>
                    {driver.profile_image_url ? (
                      <div className="border rounded-lg p-4">
                        <img
                          src={driver.profile_image_url}
                          alt="Profile"
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => window.open(driver.profile_image_url, '_blank')}
                        >
                          <Eye className="w-4 h-4 ml-2" />
                          عرض الصورة
                        </Button>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-8 text-center text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-2" />
                        <p>لا توجد صورة للملف الشخصي</p>
                      </div>
                    )}
                  </div>

                  {/* ID Card */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">بطاقة الهوية (الوجه الأمامي)</label>
                    {driver.id_image_url ? (
                      <div className="border rounded-lg p-4">
                        <img
                          src={driver.id_image_url}
                          alt="ID Front"
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => window.open(driver.id_image_url, '_blank')}
                        >
                          <Eye className="w-4 h-4 ml-2" />
                          عرض الصورة
                        </Button>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-8 text-center text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-2" />
                        <p>لا توجد صورة لبطاقة الهوية</p>
                      </div>
                    )}
                  </div>

                  {/* ID Card Back */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">بطاقة الهوية (الوجه الخلفي)</label>
                    {driver.id_image_back_url ? (
                      <div className="border rounded-lg p-4">
                        <img
                          src={driver.id_image_back_url}
                          alt="ID Back"
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => window.open(driver.id_image_back_url, '_blank')}
                        >
                          <Eye className="w-4 h-4 ml-2" />
                          عرض الصورة
                        </Button>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-8 text-center text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-2" />
                        <p>لا توجد صورة خلفية لبطاقة الهوية</p>
                      </div>
                    )}
                  </div>

                  {/* License */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">رخصة القيادة (الوجه الأمامي)</label>
                    {driver.license_image_url ? (
                      <div className="border rounded-lg p-4">
                        <img
                          src={driver.license_image_url}
                          alt="License Front"
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => window.open(driver.license_image_url, '_blank')}
                        >
                          <Eye className="w-4 h-4 ml-2" />
                          عرض الصورة
                        </Button>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-8 text-center text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-2" />
                        <p>لا توجد صورة لرخصة القيادة</p>
                      </div>
                    )}
                  </div>

                  {/* License Back */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">رخصة القيادة (الوجه الخلفي)</label>
                    {driver.license_image_back_url ? (
                      <div className="border rounded-lg p-4">
                        <img
                          src={driver.license_image_back_url}
                          alt="License Back"
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => window.open(driver.license_image_back_url, '_blank')}
                        >
                          <Eye className="w-4 h-4 ml-2" />
                          عرض الصورة
                        </Button>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-8 text-center text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-2" />
                        <p>لا توجد صورة خلفية لرخصة القيادة</p>
                      </div>
                    )}
                  </div>

                  {/* Vehicle Photo */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">صورة المركبة</label>
                    {driver.vehicle_image_url ? (
                      <div className="border rounded-lg p-4">
                        <img
                          src={driver.vehicle_image_url}
                          alt="Vehicle"
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => window.open(driver.vehicle_image_url, '_blank')}
                        >
                          <Eye className="w-4 h-4 ml-2" />
                          عرض الصورة
                        </Button>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-8 text-center text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-2" />
                        <p>لا توجد صورة للمركبة</p>
                      </div>
                    )}
                  </div>
                  {/* Residency Card */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">بطاقة السكن</label>
                    {driver.residency_image_url ? (
                      <div className="border rounded-lg p-4">
                        <img
                          src={driver.residency_image_url}
                          alt="Residency Card"
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => window.open(driver.residency_image_url, '_blank')}
                        >
                          <Eye className="w-4 h-4 ml-2" />
                          عرض الصورة
                        </Button>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-8 text-center text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-2" />
                        <p>لا توجد صورة لبطاقة السكن</p>
                      </div>
                    )}
                  </div>

                  {/* Guarantor ID */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">هوية الكفيل</label>
                    {driver.guarantor_image_url ? (
                      <div className="border rounded-lg p-4">
                        <img
                          src={driver.guarantor_image_url}
                          alt="Guarantor ID"
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => window.open(driver.guarantor_image_url, '_blank')}
                        >
                          <Eye className="w-4 h-4 ml-2" />
                          عرض الصورة
                        </Button>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-8 text-center text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-2" />
                        <p>لا توجد صورة لهوية الكفيل</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminDriverDetails;
