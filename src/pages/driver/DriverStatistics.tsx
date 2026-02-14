import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Session } from "@supabase/supabase-js";
import { 
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  MapPin,
  Star,
  Car,
  Loader2,
  Target,
  CheckCircle2,
  XCircle,
  Timer,
  Route,
  Banknote,
  BarChart3,
  PieChart as PieChartIcon,
  Activity
} from "lucide-react";
import { 
  LineChart, 
  Line, 
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
  AreaChart,
  Area,
  Legend
} from "recharts";
import { format, subDays, startOfWeek, startOfMonth, eachDayOfInterval, getHours, parseISO } from "date-fns";
import { ar } from "date-fns/locale";

interface RideData {
  id: string;
  status: string;
  final_fare: number | null;
  estimated_fare: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  driver_rating: number | null;
  payment_method: string | null;
  created_at: string;
  completed_at: string | null;
  cancelled_by: string | null;
}

interface DailyEarning {
  date: string;
  earnings: number;
  rides: number;
}

interface HourlyData {
  hour: string;
  rides: number;
}

interface PaymentData {
  name: string;
  value: number;
  color: string;
}

const COLORS = ['#10b981', '#8b5cf6', '#3b82f6', '#f59e0b'];

const DriverStatistics = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [period, setPeriod] = useState<"week" | "month" | "all">("week");
  
  // Stats
  const [dailyEarnings, setDailyEarnings] = useState<DailyEarning[]>([]);
  const [hourlyDistribution, setHourlyDistribution] = useState<HourlyData[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentData[]>([]);
  const [stats, setStats] = useState({
    totalRides: 0,
    completedRides: 0,
    cancelledRides: 0,
    acceptanceRate: 0,
    averageFare: 0,
    averageDistance: 0,
    averageDuration: 0,
    averageRating: 0,
    totalEarnings: 0,
    peakHour: "",
    bestDay: "",
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchDriverId();
    }
  }, [user]);

  useEffect(() => {
    if (driverId) {
      fetchStatistics();
    }
  }, [driverId, period]);

  const fetchDriverId = async () => {
    const { data: driver } = await supabase
      .from("drivers")
      .select("id")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (driver) {
      setDriverId(driver.id);
    } else {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      // Determine date range
      const now = new Date();
      let startDate: Date;
      
      if (period === "week") {
        startDate = subDays(now, 7);
      } else if (period === "month") {
        startDate = subDays(now, 30);
      } else {
        startDate = subDays(now, 365);
      }

      // Fetch all rides for the driver within the period
      const { data: rides, error } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", driverId)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (rides && rides.length > 0) {
        processRidesData(rides as RideData[], startDate, now);
      } else {
        // Reset stats if no rides
        setDailyEarnings([]);
        setHourlyDistribution([]);
        setPaymentBreakdown([]);
        setStats({
          totalRides: 0,
          completedRides: 0,
          cancelledRides: 0,
          acceptanceRate: 0,
          averageFare: 0,
          averageDistance: 0,
          averageDuration: 0,
          averageRating: 0,
          totalEarnings: 0,
          peakHour: "-",
          bestDay: "-",
        });
      }
    } catch (error) {
      console.error("Error fetching statistics:", error);
    } finally {
      setLoading(false);
    }
  };

  const processRidesData = (rides: RideData[], startDate: Date, endDate: Date) => {
    // Basic stats
    const completedRides = rides.filter(r => r.status === "completed");
    const cancelledRides = rides.filter(r => r.status === "cancelled");
    
    const totalEarnings = completedRides.reduce((sum, r) => sum + (r.final_fare || r.estimated_fare || 0), 0);
    const totalDistance = completedRides.reduce((sum, r) => sum + (r.distance_km || 0), 0);
    const totalDuration = completedRides.reduce((sum, r) => sum + (r.duration_minutes || 0), 0);
    const totalRating = completedRides.filter(r => r.driver_rating).reduce((sum, r) => sum + (r.driver_rating || 0), 0);
    const ratedRides = completedRides.filter(r => r.driver_rating).length;

    // Daily earnings
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const dailyData: DailyEarning[] = days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayRides = completedRides.filter(r => 
        r.completed_at && format(parseISO(r.completed_at), "yyyy-MM-dd") === dayStr
      );
      return {
        date: format(day, "EEE", { locale: ar }),
        earnings: dayRides.reduce((sum, r) => sum + (r.final_fare || r.estimated_fare || 0), 0),
        rides: dayRides.length,
      };
    });

    // Hourly distribution
    const hourlyMap: Record<number, number> = {};
    completedRides.forEach(ride => {
      if (ride.completed_at) {
        const hour = getHours(parseISO(ride.completed_at));
        hourlyMap[hour] = (hourlyMap[hour] || 0) + 1;
      }
    });
    
    const hourlyData: HourlyData[] = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      rides: hourlyMap[i] || 0,
    }));

    // Find peak hour
    let peakHour = 0;
    let maxRides = 0;
    Object.entries(hourlyMap).forEach(([hour, count]) => {
      if (count > maxRides) {
        maxRides = count;
        peakHour = parseInt(hour);
      }
    });

    // Find best day
    let bestDay = "";
    let maxEarnings = 0;
    dailyData.forEach(day => {
      if (day.earnings > maxEarnings) {
        maxEarnings = day.earnings;
        bestDay = day.date;
      }
    });

    // Payment breakdown
    const paymentMap: Record<string, number> = {};
    completedRides.forEach(ride => {
      const method = ride.payment_method || "cash";
      paymentMap[method] = (paymentMap[method] || 0) + (ride.final_fare || ride.estimated_fare || 0);
    });

    const paymentData: PaymentData[] = [
      { name: "نقدي", value: (paymentMap["cash"] || 0) + (paymentMap["zain_cash"] || 0) + (paymentMap["asia_hawala"] || 0), color: COLORS[0] },
      { name: "المحفظة", value: (paymentMap["nas_wallet"] || 0), color: COLORS[1] },
      { name: "البطاقة", value: (paymentMap["nass"] || 0) + (paymentMap["qi_card"] || 0), color: COLORS[2] },
    ].filter(p => p.value > 0);

    // Update state
    setDailyEarnings(dailyData.slice(-7)); // Last 7 days for chart
    setHourlyDistribution(hourlyData);
    setPaymentBreakdown(paymentData);
    setStats({
      totalRides: rides.length,
      completedRides: completedRides.length,
      cancelledRides: cancelledRides.length,
      acceptanceRate: rides.length > 0 ? (completedRides.length / rides.length) * 100 : 0,
      averageFare: completedRides.length > 0 ? totalEarnings / completedRides.length : 0,
      averageDistance: completedRides.length > 0 ? totalDistance / completedRides.length : 0,
      averageDuration: completedRides.length > 0 ? totalDuration / completedRides.length : 0,
      averageRating: ratedRides > 0 ? totalRating / ratedRides : 5,
      totalEarnings,
      peakHour: `${peakHour}:00 - ${peakHour + 1}:00`,
      bestDay,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">جاري تحميل الإحصائيات...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    navigate("/driver/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20" dir="rtl">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container flex items-center h-16">
          <Link to="/driver" className="p-2">
            <ArrowRight className="w-6 h-6" />
          </Link>
          <h1 className="flex-1 text-center font-bold text-lg">الإحصائيات المتقدمة</h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-8 px-4">
        <div className="container max-w-lg space-y-6">
          
          {/* Period Selector */}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              نظرة عامة
            </h2>
            <Select value={period} onValueChange={(v: "week" | "month" | "all") => setPeriod(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">آخر 7 أيام</SelectItem>
                <SelectItem value="month">آخر 30 يوم</SelectItem>
                <SelectItem value="all">كل الوقت</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Summary Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.completedRides}</p>
                    <p className="text-xs text-muted-foreground">رحلات مكتملة</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.cancelledRides}</p>
                    <p className="text-xs text-muted-foreground">رحلات ملغاة</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Target className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.acceptanceRate.toFixed(0)}%</p>
                    <p className="text-xs text-muted-foreground">نسبة الإكمال</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Star className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.averageRating.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">متوسط التقييم</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Earnings Chart */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                الأرباح اليومية
              </CardTitle>
              <CardDescription>
                إجمالي: {stats.totalEarnings.toLocaleString()} د.ع
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dailyEarnings.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={dailyEarnings}>
                    <defs>
                      <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        direction: "rtl"
                      }}
                      formatter={(value: number) => [`${value.toLocaleString()} د.ع`, "الأرباح"]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="earnings" 
                      stroke="hsl(var(--primary))" 
                      fillOpacity={1}
                      fill="url(#colorEarnings)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  لا توجد بيانات للعرض
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hourly Distribution */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                توزيع الرحلات حسب الساعة
              </CardTitle>
              <CardDescription>
                أفضل وقت: {stats.peakHour}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hourlyDistribution.some(h => h.rides > 0) ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={hourlyDistribution.filter((_, i) => i >= 6 && i <= 23)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={2} />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                      formatter={(value: number) => [`${value} رحلة`, "عدد الرحلات"]}
                    />
                    <Bar dataKey="rides" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-muted-foreground">
                  لا توجد بيانات للعرض
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Methods Pie Chart */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-primary" />
                توزيع طرق الدفع
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paymentBreakdown.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={160}>
                    <PieChart>
                      <Pie
                        data={paymentBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {paymentBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                        formatter={(value: number) => [`${value.toLocaleString()} د.ع`]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {paymentBreakdown.map((item, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-medium text-foreground">{item.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[160px] flex items-center justify-center text-muted-foreground">
                  لا توجد بيانات للعرض
                </div>
              )}
            </CardContent>
          </Card>

          {/* Average Stats */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                متوسطات الأداء
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Banknote className="w-4 h-4" />
                  <span>متوسط الأجرة</span>
                </div>
                <span className="font-semibold text-foreground">
                  {stats.averageFare.toLocaleString()} د.ع
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Route className="w-4 h-4" />
                  <span>متوسط المسافة</span>
                </div>
                <span className="font-semibold text-foreground">
                  {stats.averageDistance.toFixed(1)} كم
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Timer className="w-4 h-4" />
                  <span>متوسط المدة</span>
                </div>
                <span className="font-semibold text-foreground">
                  {stats.averageDuration.toFixed(0)} دقيقة
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>أفضل يوم</span>
                </div>
                <span className="font-semibold text-foreground">
                  {stats.bestDay || "-"}
                </span>
              </div>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
};

export default DriverStatistics;
