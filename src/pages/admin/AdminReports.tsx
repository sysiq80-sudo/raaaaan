import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { TrendingUp, DollarSign, Car, Users, Calendar } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, startOfDay } from "date-fns";
import { ar } from "date-fns/locale";

interface RideStats {
  date: string;
  rides: number;
  revenue: number;
}

interface StatusDistribution {
  name: string;
  value: number;
  color: string;
}

interface PaymentDistribution {
  name: string;
  value: number;
  color: string;
}

const AdminReports = () => {
  const { loading: authLoading, isAdmin } = useAdminAuth();
  const [dailyStats, setDailyStats] = useState<RideStats[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<RideStats[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<StatusDistribution[]>([]);
  const [paymentDistribution, setPaymentDistribution] = useState<PaymentDistribution[]>([]);
  const [totals, setTotals] = useState({
    totalRevenue: 0,
    totalRides: 0,
    completedRides: 0,
    averageFare: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      fetchReportData();
    }
  }, [isAdmin]);

  const fetchReportData = async () => {
    try {
      // Fetch all rides
      const { data: rides, error } = await supabase
        .from("rides")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!rides || rides.length === 0) {
        setLoading(false);
        return;
      }

      // Calculate totals
      const completedRides = rides.filter(r => r.status === "completed");
      const totalRevenue = completedRides.reduce((sum, r) => sum + (r.final_fare || r.estimated_fare || 0), 0);
      const averageFare = completedRides.length > 0 ? totalRevenue / completedRides.length : 0;

      setTotals({
        totalRevenue,
        totalRides: rides.length,
        completedRides: completedRides.length,
        averageFare,
      });

      // Calculate daily stats (last 7 days)
      const last7Days = eachDayOfInterval({
        start: subDays(new Date(), 6),
        end: new Date(),
      });

      const dailyData = last7Days.map(day => {
        const dayStart = startOfDay(day);
        const dayRides = rides.filter(r => {
          const rideDate = startOfDay(new Date(r.created_at));
          return rideDate.getTime() === dayStart.getTime();
        });
        const dayRevenue = dayRides
          .filter(r => r.status === "completed")
          .reduce((sum, r) => sum + (r.final_fare || r.estimated_fare || 0), 0);

        return {
          date: format(day, "EEE", { locale: ar }),
          rides: dayRides.length,
          revenue: dayRevenue,
        };
      });

      setDailyStats(dailyData);

      // Calculate monthly stats (last 6 months)
      const monthlyData: RideStats[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = startOfMonth(subDays(new Date(), i * 30));
        const monthEnd = endOfMonth(monthStart);
        const monthRides = rides.filter(r => {
          const rideDate = new Date(r.created_at);
          return rideDate >= monthStart && rideDate <= monthEnd;
        });
        const monthRevenue = monthRides
          .filter(r => r.status === "completed")
          .reduce((sum, r) => sum + (r.final_fare || r.estimated_fare || 0), 0);

        monthlyData.push({
          date: format(monthStart, "MMM", { locale: ar }),
          rides: monthRides.length,
          revenue: monthRevenue,
        });
      }

      setMonthlyStats(monthlyData);

      // Status distribution
      const statusCounts = rides.reduce((acc, r) => {
        acc[r.status || "pending"] = (acc[r.status || "pending"] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const statusLabels: Record<string, string> = {
        pending: "قيد الانتظار",
        accepted: "مقبولة",
        arrived: "وصل السائق",
        in_progress: "جارية",
        completed: "مكتملة",
        cancelled: "ملغاة",
      };

      const statusColors: Record<string, string> = {
        pending: "hsl(var(--chart-1))",
        accepted: "hsl(var(--chart-2))",
        arrived: "hsl(var(--chart-3))",
        in_progress: "hsl(var(--chart-4))",
        completed: "hsl(var(--chart-5))",
        cancelled: "hsl(var(--destructive))",
      };

      setStatusDistribution(
        Object.entries(statusCounts).map(([status, count]) => ({
          name: statusLabels[status] || status,
          value: count,
          color: statusColors[status] || "hsl(var(--muted))",
        }))
      );

      // Payment distribution
      const paymentCounts = rides.reduce((acc, r) => {
        acc[r.payment_method || "cash"] = (acc[r.payment_method || "cash"] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const paymentLabels: Record<string, string> = {
        cash: "نقدي",
        zain_cash: "زين كاش",
        asia_hawala: "آسيا حوالة",
        qi_card: "كي كارد",
      };

      const paymentColors: Record<string, string> = {
        cash: "hsl(var(--chart-1))",
        zain_cash: "hsl(var(--chart-2))",
        asia_hawala: "hsl(var(--chart-3))",
        qi_card: "hsl(var(--chart-4))",
      };

      setPaymentDistribution(
        Object.entries(paymentCounts).map(([method, count]) => ({
          name: paymentLabels[method] || method,
          value: count,
          color: paymentColors[method] || "hsl(var(--muted))",
        }))
      );

    } catch (error) {
      console.error("Error fetching report data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ar-IQ", {
      style: "decimal",
      maximumFractionDigits: 0,
    }).format(value) + " د.ع";
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <AdminLayout 
      title="التقارير المالية" 
      subtitle="إحصائيات الإيرادات والرحلات"
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">إجمالي الإيرادات</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totals.totalRevenue)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-chart-2/10 to-chart-2/5 border-chart-2/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">إجمالي الرحلات</p>
                <p className="text-2xl font-bold text-foreground">{totals.totalRides}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-chart-2/20 flex items-center justify-center">
                <Car className="w-6 h-6 text-chart-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-chart-3/10 to-chart-3/5 border-chart-3/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">الرحلات المكتملة</p>
                <p className="text-2xl font-bold text-foreground">{totals.completedRides}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-chart-3/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-chart-3" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-chart-4/10 to-chart-4/5 border-chart-4/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">متوسط الأجرة</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totals.averageFare)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-chart-4/20 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-chart-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="daily" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="daily">يومي (آخر 7 أيام)</TabsTrigger>
          <TabsTrigger value="monthly">شهري (آخر 6 أشهر)</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Revenue Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">الإيرادات اليومية</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyStats}>
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                        formatter={(value: number) => [formatCurrency(value), "الإيرادات"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(var(--primary))"
                        fill="url(#revenueGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Daily Rides Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">عدد الرحلات اليومية</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                        formatter={(value: number) => [value, "رحلة"]}
                      />
                      <Bar 
                        dataKey="rides" 
                        fill="hsl(var(--chart-2))" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Revenue Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">الإيرادات الشهرية</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyStats}>
                      <defs>
                        <linearGradient id="monthlyRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                        formatter={(value: number) => [formatCurrency(value), "الإيرادات"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(var(--primary))"
                        fill="url(#monthlyRevenueGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Rides Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">عدد الرحلات الشهرية</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                        formatter={(value: number) => [value, "رحلة"]}
                      />
                      <Bar 
                        dataKey="rides" 
                        fill="hsl(var(--chart-2))" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">توزيع حالات الرحلات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payment Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">توزيع طرق الدفع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {paymentDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminReports;
