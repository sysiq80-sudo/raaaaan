import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  DollarSign, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  TrendingDown,
  Calendar,
  Target,
  Car,
  Clock
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip 
} from "recharts";
import { format, subDays, startOfWeek, startOfMonth, eachDayOfInterval, parseISO } from "date-fns";
import { ar } from "date-fns/locale";

interface DriverStatsProps {
  driverId: string;
}

interface StatsData {
  todayEarnings: number;
  todayRides: number;
  weekEarnings: number;
  weekRides: number;
  monthEarnings: number;
  monthRides: number;
  cancelledToday: number;
  avgFare: number;
  yesterdayEarnings: number;
  lastWeekEarnings: number;
  lastMonthEarnings: number;
}

interface DailyData {
  day: string;
  earnings: number;
  rides: number;
}

const DAILY_GOAL = 50000; // هدف يومي

export const DriverStats = ({ driverId }: DriverStatsProps) => {
  const [stats, setStats] = useState<StatsData>({
    todayEarnings: 0,
    todayRides: 0,
    weekEarnings: 0,
    weekRides: 0,
    monthEarnings: 0,
    monthRides: 0,
    cancelledToday: 0,
    avgFare: 0,
    yesterdayEarnings: 0,
    lastWeekEarnings: 0,
    lastMonthEarnings: 0
  });
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month'>('today');
  const [chartData, setChartData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!driverId) return;

    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const weekStart = startOfWeek(now, { weekStartsOn: 6 }); // Saturday
      const lastWeekStart = new Date(weekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const monthStart = startOfMonth(now);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      // Get all driver rides for last 30 days
      const thirtyDaysAgo = subDays(now, 30);
      const { data: rides } = await supabase
        .from("rides")
        .select("status, final_fare, estimated_fare, completed_at, created_at")
        .eq("driver_id", driverId)
        .gte("created_at", thirtyDaysAgo.toISOString());

      if (!rides) {
        setLoading(false);
        return;
      }

      let todayEarnings = 0, todayRides = 0, cancelledToday = 0;
      let yesterdayEarnings = 0;
      let weekEarnings = 0, weekRides = 0;
      let lastWeekEarnings = 0;
      let monthEarnings = 0, monthRides = 0;
      let lastMonthEarnings = 0;
      let totalFares = 0, fareCount = 0;

      // Daily breakdown for chart
      const dailyMap: Record<string, { earnings: number; rides: number }> = {};
      const days = eachDayOfInterval({ start: subDays(now, 6), end: now });
      days.forEach(day => {
        const dayStr = format(day, "yyyy-MM-dd");
        dailyMap[dayStr] = { earnings: 0, rides: 0 };
      });

      rides.forEach(ride => {
        const rideDate = new Date(ride.completed_at || ride.created_at);
        const rideDateStr = format(rideDate, "yyyy-MM-dd");
        const fare = ride.final_fare || ride.estimated_fare || 0;

        // Today stats
        if (rideDate >= todayStart) {
          if (ride.status === 'completed') {
            todayEarnings += fare;
            todayRides++;
          } else if (ride.status === 'cancelled') {
            cancelledToday++;
          }
        }

        // Yesterday stats
        if (rideDate >= yesterdayStart && rideDate < todayStart && ride.status === 'completed') {
          yesterdayEarnings += fare;
        }

        // Week stats
        if (rideDate >= weekStart && ride.status === 'completed') {
          weekEarnings += fare;
          weekRides++;
        }

        // Last week stats
        if (rideDate >= lastWeekStart && rideDate < weekStart && ride.status === 'completed') {
          lastWeekEarnings += fare;
        }

        // Month stats
        if (rideDate >= monthStart && ride.status === 'completed') {
          monthEarnings += fare;
          monthRides++;
          totalFares += fare;
          fareCount++;
        }

        // Last month stats
        if (rideDate >= lastMonthStart && rideDate <= lastMonthEnd && ride.status === 'completed') {
          lastMonthEarnings += fare;
        }

        // Chart data
        if (dailyMap[rideDateStr] && ride.status === 'completed') {
          dailyMap[rideDateStr].earnings += fare;
          dailyMap[rideDateStr].rides += 1;
        }
      });

      const avgFare = fareCount > 0 ? Math.round(totalFares / fareCount) : 0;

      // Convert daily map to chart data
      const chartDataArr: DailyData[] = days.map(day => {
        const dayStr = format(day, "yyyy-MM-dd");
        return {
          day: format(day, "EEE", { locale: ar }),
          earnings: dailyMap[dayStr]?.earnings || 0,
          rides: dailyMap[dayStr]?.rides || 0
        };
      });

      setChartData(chartDataArr);
      setStats({
        todayEarnings,
        todayRides,
        weekEarnings,
        weekRides,
        monthEarnings,
        monthRides,
        cancelledToday,
        avgFare,
        yesterdayEarnings,
        lastWeekEarnings,
        lastMonthEarnings
      });
      setLoading(false);
    } catch (error) {
      console.error("Error fetching stats:", error);
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    fetchStats();

    // Refresh every minute
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const getDisplayData = () => {
    switch (activeTab) {
      case 'today':
        return { 
          earnings: stats.todayEarnings, 
          rides: stats.todayRides, 
          label: 'اليوم',
          comparison: stats.yesterdayEarnings,
          comparisonLabel: 'أمس'
        };
      case 'week':
        return { 
          earnings: stats.weekEarnings, 
          rides: stats.weekRides, 
          label: 'الأسبوع',
          comparison: stats.lastWeekEarnings,
          comparisonLabel: 'الأسبوع الماضي'
        };
      case 'month':
        return { 
          earnings: stats.monthEarnings, 
          rides: stats.monthRides, 
          label: 'الشهر',
          comparison: stats.lastMonthEarnings,
          comparisonLabel: 'الشهر الماضي'
        };
    }
  };

  const displayData = getDisplayData();
  const dailyProgress = Math.min((stats.todayEarnings / DAILY_GOAL) * 100, 100);
  
  // Calculate trend
  const trend = displayData.comparison > 0 
    ? ((displayData.earnings - displayData.comparison) / displayData.comparison) * 100 
    : displayData.earnings > 0 ? 100 : 0;
  const isTrendUp = trend >= 0;

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-12 bg-secondary rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-32 bg-secondary rounded-xl" />
          <div className="h-32 bg-secondary rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab Selector */}
      <div className="flex gap-2 p-1 bg-secondary rounded-xl">
        {(['today', 'week', 'month'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab 
                ? 'bg-primary text-primary-foreground shadow-md' 
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'
            }`}
          >
            {tab === 'today' ? 'اليوم' : tab === 'week' ? 'الأسبوع' : 'الشهر'}
          </button>
        ))}
      </div>

      {/* Main Earnings Card with Chart */}
      <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">أرباح {displayData.label}</span>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {displayData.earnings.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">دينار عراقي</p>
            </div>
            
            {/* Trend Indicator */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              isTrendUp ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
            }`}>
              {isTrendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{Math.abs(trend).toFixed(0)}%</span>
            </div>
          </div>

          {/* Mini Chart */}
          {chartData.length > 0 && activeTab !== 'today' && (
            <div className="h-16 mt-2 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
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
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <Car className="w-3 h-3" />
              {displayData.rides} رحلة
            </span>
            <span>
              مقارنة بـ {displayData.comparisonLabel}: {displayData.comparison.toLocaleString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Daily Goal Progress - Only show for today */}
      {activeTab === 'today' && (
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">هدف اليوم</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {stats.todayEarnings.toLocaleString()} / {DAILY_GOAL.toLocaleString()}
              </span>
            </div>
            <Progress value={dailyProgress} className="h-2" />
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-muted-foreground">
                متبقي {Math.max(0, DAILY_GOAL - stats.todayEarnings).toLocaleString()} د.ع
              </span>
              <span className={dailyProgress >= 100 ? "text-emerald-500 font-medium" : "text-muted-foreground"}>
                {dailyProgress >= 100 ? "🎉 تم تحقيق الهدف!" : `${dailyProgress.toFixed(0)}%`}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              </div>
              <span className="text-sm text-muted-foreground">مكتملة</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {displayData.rides}
            </p>
            <p className="text-xs text-muted-foreground">رحلة {displayData.label}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-amber-500" />
              </div>
              <span className="text-sm text-muted-foreground">متوسط الأجرة</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {stats.avgFare.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">د.ع / رحلة</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats - Only for today */}
      {activeTab === 'today' && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <XCircle className="w-5 h-5 text-destructive mx-auto mb-1" />
              <p className="text-lg font-bold text-foreground">{stats.cancelledToday}</p>
              <p className="text-xs text-muted-foreground">ملغاة</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 text-center">
              <Calendar className="w-5 h-5 text-blue-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-foreground">{stats.weekRides}</p>
              <p className="text-xs text-muted-foreground">الأسبوع</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 text-center">
              <Clock className="w-5 h-5 text-purple-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-foreground">{stats.monthRides}</p>
              <p className="text-xs text-muted-foreground">الشهر</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DriverStats;
