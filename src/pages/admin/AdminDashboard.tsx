import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminLayout from "@/components/admin/AdminLayout";
import { 
  Car, 
  Users, 
  MapPin, 
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  UserCog,
  Map,
  ChevronLeft,
  LayoutDashboard,
  Route,
  Gift,
  Bell,
  Ban,
  Calendar,
  Star,
  Wallet,
  AlertTriangle,
  FileText
} from "lucide-react";
import { formatDistanceToNow, subDays, startOfDay, endOfDay } from "date-fns";
import { ar } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";

interface DashboardStats {
  totalRides: number;
  activeDrivers: number;
  pendingDrivers: number;
  todayEarnings: number;
  totalUsers: number;
  activeRides: number;
  completedRides: number;
  cancelledRides: number;
  totalIncentivesPaid: number;
  totalDrivers: number;
  avgDriverRating: number;
  weeklyRides: number;
  weeklyEarnings: number;
  todayRides: number;
  regionsCount: number;
  landmarksCount: number;
}

interface RecentActivity {
  id: string;
  type: "ride_completed" | "ride_cancelled" | "new_driver" | "driver_approved" | "incentive_claimed";
  title: string;
  details: string;
  created_at: string;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, loading, isAdmin } = useAdminAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalRides: 0,
    activeDrivers: 0,
    pendingDrivers: 0,
    todayEarnings: 0,
    totalUsers: 0,
    activeRides: 0,
    completedRides: 0,
    cancelledRides: 0,
    totalIncentivesPaid: 0,
    totalDrivers: 0,
    avgDriverRating: 0,
    weeklyRides: 0,
    weeklyEarnings: 0,
    todayRides: 0,
    regionsCount: 0,
    landmarksCount: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      fetchStats();
      fetchRecentActivity();
    }
  }, [isAdmin]);

  const fetchStats = async () => {
    try {
      const today = new Date();
      const todayStart = startOfDay(today).toISOString();
      const weekAgo = subDays(today, 7);
      const weekAgoStart = startOfDay(weekAgo).toISOString();

      const [
        ridesResult,
        activeDriversResult,
        pendingDriversResult,
        todayEarningsResult,
        usersResult,
        activeRidesResult,
        completedRidesResult,
        cancelledRidesResult,
        incentivesResult,
        totalDriversResult,
        driverRatingsResult,
        weeklyRidesResult,
        weeklyEarningsResult,
        todayRidesResult,
        regionsResult,
        landmarksResult,
      ] = await Promise.all([
        supabase.from("rides").select("id", { count: "exact", head: true }),
        supabase.from("drivers").select("id", { count: "exact", head: true }).eq("is_online", true),
        supabase.from("drivers").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("rides").select("final_fare").eq("status", "completed").gte("created_at", todayStart),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("rides").select("id", { count: "exact", head: true }).in("status", ["pending", "accepted", "arrived", "in_progress"]),
        supabase.from("rides").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("rides").select("id", { count: "exact", head: true }).eq("status", "cancelled"),
        supabase.from("driver_incentive_claims").select("bonus_earned"),
        supabase.from("drivers").select("id", { count: "exact", head: true }),
        supabase.from("drivers").select("rating").not("rating", "is", null),
        supabase.from("rides").select("id", { count: "exact", head: true }).gte("created_at", weekAgoStart),
        supabase.from("rides").select("final_fare").eq("status", "completed").gte("created_at", weekAgoStart),
        supabase.from("rides").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
        supabase.from("regions").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("landmarks").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);

      const todayEarnings = todayEarningsResult.data?.reduce((sum, ride) => sum + (ride.final_fare || 0), 0) || 0;
      const totalIncentives = incentivesResult.data?.reduce((sum, claim) => sum + (claim.bonus_earned || 0), 0) || 0;
      const avgRating = driverRatingsResult.data?.length 
        ? driverRatingsResult.data.reduce((sum, d) => sum + (Number(d.rating) || 0), 0) / driverRatingsResult.data.length 
        : 0;
      const weeklyEarnings = weeklyEarningsResult.data?.reduce((sum, ride) => sum + (ride.final_fare || 0), 0) || 0;

      setStats({
        totalRides: ridesResult.count || 0,
        activeDrivers: activeDriversResult.count || 0,
        pendingDrivers: pendingDriversResult.count || 0,
        todayEarnings,
        totalUsers: usersResult.count || 0,
        activeRides: activeRidesResult.count || 0,
        completedRides: completedRidesResult.count || 0,
        cancelledRides: cancelledRidesResult.count || 0,
        totalIncentivesPaid: totalIncentives,
        totalDrivers: totalDriversResult.count || 0,
        avgDriverRating: avgRating,
        weeklyRides: weeklyRidesResult.count || 0,
        weeklyEarnings,
        todayRides: todayRidesResult.count || 0,
        regionsCount: regionsResult.count || 0,
        landmarksCount: landmarksResult.count || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const activities: RecentActivity[] = [];

      const { data: recentRides } = await supabase
        .from("rides")
        .select("id, status, pickup_address, dropoff_address, created_at")
        .in("status", ["completed", "cancelled"])
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentRides) {
        recentRides.forEach((ride) => {
          activities.push({
            id: ride.id,
            type: ride.status === "completed" ? "ride_completed" : "ride_cancelled",
            title: ride.status === "completed" ? "رحلة مكتملة" : "رحلة ملغية",
            details: `${ride.pickup_address || "غير محدد"} ← ${ride.dropoff_address || "غير محدد"}`,
            created_at: ride.created_at,
          });
        });
      }

      const { data: recentDrivers } = await supabase
        .from("drivers")
        .select("id, full_name, status, created_at")
        .order("created_at", { ascending: false })
        .limit(3);

      if (recentDrivers) {
        recentDrivers.forEach((driver) => {
          if (driver.status === "pending") {
            activities.push({
              id: driver.id,
              type: "new_driver",
              title: "طلب سائق جديد",
              details: `${driver.full_name} - بانتظار الموافقة`,
              created_at: driver.created_at,
            });
          } else if (driver.status === "approved") {
            activities.push({
              id: driver.id,
              type: "driver_approved",
              title: "تمت الموافقة على سائق",
              details: driver.full_name,
              created_at: driver.created_at,
            });
          }
        });
      }

      const { data: recentClaims } = await supabase
        .from("driver_incentive_claims")
        .select("id, bonus_earned, claimed_at, driver_id")
        .order("claimed_at", { ascending: false })
        .limit(3);

      if (recentClaims) {
        recentClaims.forEach((claim) => {
          activities.push({
            id: claim.id,
            type: "incentive_claimed",
            title: "مكافأة جديدة",
            details: `${claim.bonus_earned.toLocaleString()} د.ع`,
            created_at: claim.claimed_at || new Date().toISOString(),
          });
        });
      }

      activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRecentActivity(activities.slice(0, 8));
    } catch (error) {
      console.error("Error fetching recent activity:", error);
    }
  };

  const getActivityIcon = (type: RecentActivity["type"]) => {
    switch (type) {
      case "ride_completed":
        return <CheckCircle className="text-green-500" />;
      case "ride_cancelled":
        return <XCircle className="text-destructive" />;
      case "new_driver":
        return <UserCog className="text-yellow-500" />;
      case "driver_approved":
        return <CheckCircle className="text-primary" />;
      case "incentive_claimed":
        return <Gift className="text-purple-500" />;
    }
  };

  const completionRate = stats.totalRides > 0 
    ? Math.round((stats.completedRides / stats.totalRides) * 100) 
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary flex items-center justify-center mb-4 animate-pulse">
            <LayoutDashboard className="w-10 h-10 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
              <XCircle className="w-10 h-10 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-2">غير مصرح</h2>
            <p className="text-muted-foreground mb-6">ليس لديك صلاحية الوصول للوحة التحكم</p>
            <Link to="/auth">
              <Button className="w-full">تسجيل الدخول</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AdminLayout title="لوحة التحكم" subtitle="مرحباً بك في لوحة تحكم ران">
      {/* Main Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<Route className="w-5 h-5" />}
          label="إجمالي الرحلات"
          value={statsLoading ? "..." : stats.totalRides.toLocaleString()}
          onClick={() => navigate("/admin/rides")}
          color="primary"
        />
        <StatCard
          icon={<Car className="w-5 h-5" />}
          label="السائقين النشطين"
          value={statsLoading ? "..." : `${stats.activeDrivers}/${stats.totalDrivers}`}
          onClick={() => navigate("/admin/drivers")}
          color="green"
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="إجمالي المستخدمين"
          value={statsLoading ? "..." : stats.totalUsers.toLocaleString()}
          onClick={() => navigate("/admin/riders")}
          color="blue"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="رحلات نشطة الآن"
          value={statsLoading ? "..." : stats.activeRides.toString()}
          onClick={() => navigate("/admin/rides")}
          color="orange"
        />
      </div>

      {/* Financial Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-xs bg-green-500/20 text-green-600 px-2 py-1 rounded-full">اليوم</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{statsLoading ? "..." : `${(stats.todayEarnings / 1000).toLocaleString()}K`}</p>
            <p className="text-sm text-muted-foreground">أرباح اليوم (د.ع)</p>
            <div className="mt-2 text-xs text-green-600">
              {stats.todayRides} رحلة اليوم
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-xs bg-blue-500/20 text-blue-600 px-2 py-1 rounded-full">هذا الأسبوع</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{statsLoading ? "..." : `${(stats.weeklyEarnings / 1000).toLocaleString()}K`}</p>
            <p className="text-sm text-muted-foreground">أرباح الأسبوع (د.ع)</p>
            <div className="mt-2 text-xs text-blue-600">
              {stats.weeklyRides} رحلة
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Gift className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-xs bg-purple-500/20 text-purple-600 px-2 py-1 rounded-full">حوافز</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{statsLoading ? "..." : `${(stats.totalIncentivesPaid / 1000).toLocaleString()}K`}</p>
            <p className="text-sm text-muted-foreground">مكافآت مدفوعة (د.ع)</p>
            <div className="mt-2">
              <Button variant="ghost" size="sm" className="text-xs h-6 px-2 text-purple-600" onClick={() => navigate("/admin/incentives")}>
                إدارة الحوافز ←
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              أداء الرحلات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">معدل الإكمال</span>
                <span className="font-medium text-green-600">{completionRate}%</span>
              </div>
              <Progress value={completionRate} className="h-2" />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center p-3 bg-green-500/10 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{stats.completedRides.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">مكتملة</p>
              </div>
              <div className="text-center p-3 bg-red-500/10 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{stats.cancelledRides.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">ملغية</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="w-4 h-4" />
              إحصائيات السائقين
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                <span className="text-sm text-muted-foreground">متوسط التقييم</span>
              </div>
              <span className="font-bold text-foreground">{stats.avgDriverRating.toFixed(1)} / 5</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-yellow-500/10 rounded-lg" onClick={() => navigate("/admin/drivers")} style={{ cursor: 'pointer' }}>
                <UserCog className="w-5 h-5 text-yellow-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{stats.pendingDrivers}</p>
                <p className="text-xs text-muted-foreground">بانتظار الموافقة</p>
              </div>
              <div className="text-center p-3 bg-primary/10 rounded-lg">
                <Car className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{stats.totalDrivers}</p>
                <p className="text-xs text-muted-foreground">إجمالي السائقين</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & System Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">الإجراءات السريعة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <QuickAction icon={<MapPin />} label="المناطق" count={stats.regionsCount} onClick={() => navigate("/admin/regions")} />
                <QuickAction icon={<Map />} label="المعالم" count={stats.landmarksCount} onClick={() => navigate("/admin/landmarks")} />
                <QuickAction icon={<Gift />} label="الحوافز" onClick={() => navigate("/admin/incentives")} />
                <QuickAction icon={<UserCog />} label="السائقين" count={stats.pendingDrivers} badge onClick={() => navigate("/admin/drivers")} />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">روابط سريعة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => navigate("/admin/map")}>
              <Map className="w-4 h-4 ml-2" /> الخريطة الحية
            </Button>
            <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => navigate("/admin/reports")}>
              <TrendingUp className="w-4 h-4 ml-2" /> التقارير
            </Button>
            <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => navigate("/admin/settings")}>
              <UserCog className="w-4 h-4 ml-2" /> الإعدادات
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Emergency System Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-yellow-500/30 bg-yellow-500/5 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate("/admin/stopped-rides")}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                رحلات متوقفة
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm mb-2">
              الرحلات المتوقفة لأكثر من 5 دقائق
            </p>
            <Button variant="outline" size="sm" className="w-full">
              عرض الرحلات المتوقفة
            </Button>
          </CardContent>
        </Card>

        <Card className="border-red-500/30 bg-red-500/5 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate("/admin/complaints")}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-600" />
                الشكاوى
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm mb-2">
              شكاوى المستخدمين والقرارات المالية
            </p>
            <Button variant="outline" size="sm" className="w-full">
              إدارة الشكاوى
            </Button>
          </CardContent>
        </Card>

        <Card className="border-blue-500/30 bg-blue-500/5 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate("/admin/emergency-settings")}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <UserCog className="w-5 h-5 text-blue-600" />
                إعدادات الطوارئ
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm mb-2">
              تخصيص معايير الكشف والحدود
            </p>
            <Button variant="outline" size="sm" className="w-full">
              تعديل الإعدادات
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">النشاط الأخير</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              لا يوجد نشاط حديث
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recentActivity.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center shrink-0">
                    {getActivityIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.details}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ar })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

const StatCard = ({ icon, label, value, suffix, onClick, color = "primary" }: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
  suffix?: string;
  onClick?: () => void;
  color?: "primary" | "green" | "blue" | "orange";
}) => {
  const colorClasses = {
    primary: "bg-primary/10 text-primary",
    green: "bg-green-500/10 text-green-600",
    blue: "bg-blue-500/10 text-blue-600",
    orange: "bg-orange-500/10 text-orange-600",
  };

  return (
    <Card className={onClick ? "cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5" : ""} onClick={onClick}>
      <CardContent className="p-4">
        <div className={`w-9 h-9 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-2`}>
          {icon}
        </div>
        <p className="text-xl font-bold text-foreground">
          {value} <span className="text-xs text-muted-foreground font-normal">{suffix}</span>
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
};

const QuickAction = ({ icon, label, count, onClick, badge }: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  onClick?: () => void;
  badge?: boolean;
}) => (
  <div 
    className="relative p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer text-center"
    onClick={onClick}
  >
    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
      {icon}
    </div>
    <p className="text-xs font-medium text-foreground">{label}</p>
    {count !== undefined && count > 0 && (
      <span className={`absolute -top-1 -right-1 text-xs px-1.5 py-0.5 rounded-full ${badge ? 'bg-destructive text-destructive-foreground' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
        {count}
      </span>
    )}
  </div>
);

export default AdminDashboard;
