import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  FileText,
  Percent,
  Download,
  Banknote
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

  const { data: stats = {
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
  }, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      const today = new Date();
      const todayStart = startOfDay(today).toISOString();
      const weekAgo = subDays(today, 7);
      const weekAgoStart = startOfDay(weekAgo).toISOString();

      const { data, error } = await supabase.rpc("get_admin_dashboard_stats", {
        p_today_start: todayStart,
        p_week_ago_start: weekAgoStart,
      });

      if (error) {
        console.error("RPC Error fetching admin stats:", error);
        throw error;
      }

      return {
        totalRides: data?.totalRides || 0,
        activeDrivers: data?.activeDrivers || 0,
        pendingDrivers: data?.pendingDrivers || 0,
        todayEarnings: data?.todayEarnings || 0,
        totalUsers: data?.totalUsers || 0,
        activeRides: data?.activeRides || 0,
        completedRides: data?.completedRides || 0,
        cancelledRides: data?.cancelledRides || 0,
        totalIncentivesPaid: data?.totalIncentivesPaid || 0,
        totalDrivers: data?.totalDrivers || 0,
        avgDriverRating: data?.avgDriverRating || 0,
        weeklyRides: data?.weeklyRides || 0,
        weeklyEarnings: data?.weeklyEarnings || 0,
        todayRides: data?.todayRides || 0,
        regionsCount: data?.regionsCount || 0,
        landmarksCount: data?.landmarksCount || 0,
      } as DashboardStats;
    },
    enabled: isAdmin,
  });

  const { data: recentActivity = [] } = useQuery({
    queryKey: ["admin-recent-activity"],
    queryFn: async () => {
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
            details: `${claim.bonus_earned.toLocaleString('en-US')} د.ع`,
            created_at: claim.claimed_at || new Date().toISOString(),
          });
        });
      }

      activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return activities.slice(0, 8);
    },
    enabled: isAdmin,
  });

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
          value={statsLoading ? "..." : stats.totalRides.toLocaleString('en-US')}
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
          value={statsLoading ? "..." : stats.totalUsers.toLocaleString('en-US')}
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
            <p className="text-2xl font-bold text-foreground">{statsLoading ? "..." : `${(stats.todayEarnings / 1000).toLocaleString('en-US')}K`}</p>
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
            <p className="text-2xl font-bold text-foreground">{statsLoading ? "..." : `${(stats.weeklyEarnings / 1000).toLocaleString('en-US')}K`}</p>
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
            <p className="text-2xl font-bold text-foreground">{statsLoading ? "..." : `${(stats.totalIncentivesPaid / 1000).toLocaleString('en-US')}K`}</p>
            <p className="text-sm text-muted-foreground">مكافآت مدفوعة (د.ع)</p>
            <div className="mt-2">
              <Button variant="ghost" size="sm" className="text-xs h-6 px-2 text-purple-600" onClick={() => navigate("/admin/incentives")}>
                إدارة الحوافز ←
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 💰 Financial Health — الصحة المالية */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <FinancialCard
          icon={<Percent className="w-5 h-5 text-emerald-600" />}
          label="إجمالي عمولات الشركة"
          color="emerald"
          onClick={() => navigate("/admin/commission-reports")}
        />
        <FinancialCard
          icon={<Download className="w-5 h-5 text-amber-600" />}
          label="سحوبات معلقة"
          color="amber"
          onClick={() => navigate("/admin/withdrawals")}
        />
        <FinancialCard
          icon={<Banknote className="w-5 h-5 text-sky-600" />}
          label="إجمالي رصيد المحافظ"
          color="sky"
          onClick={() => navigate("/admin/wallet-requests")}
        />
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
                <p className="text-lg font-bold text-foreground">{stats.completedRides.toLocaleString('en-US')}</p>
                <p className="text-xs text-muted-foreground">مكتملة</p>
              </div>
              <div className="text-center p-3 bg-red-500/10 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{stats.cancelledRides.toLocaleString('en-US')}</p>
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
            <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => navigate("/admin/withdrawals")}>
              <TrendingUp className="w-4 h-4 ml-2" /> طلبات السحب
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

const FinancialCard = ({ icon, label, color, onClick }: {
  icon: React.ReactNode;
  label: string;
  color: "emerald" | "amber" | "sky";
  onClick?: () => void;
}) => {
  const colorMap = {
    emerald: "from-emerald-500/10 to-emerald-600/5 border-emerald-500/20",
    amber: "from-amber-500/10 to-amber-600/5 border-amber-500/20",
    sky: "from-sky-500/10 to-sky-600/5 border-sky-500/20",
  };

  return (
    <Card
      className={`bg-gradient-to-br ${colorMap[color]} cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5`}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-10 h-10 rounded-lg bg-${color}-500/20 flex items-center justify-center`}>
            {icon}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <Button variant="ghost" size="sm" className="text-xs h-6 px-2 mt-2">
          عرض التفاصيل ←
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminDashboard;
