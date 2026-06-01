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

  const dailyProgress = Math.min((stats.todayEarnings / DAILY_GOAL) * 100, 100);
  
  // Calculate trend vs yesterday
  const trend = stats.yesterdayEarnings > 0 
    ? ((stats.todayEarnings - stats.yesterdayEarnings) / stats.yesterdayEarnings) * 100 
    : stats.todayEarnings > 0 ? 100 : 0;
  const isTrendUp = trend >= 0;

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-32 bg-secondary rounded-xl" />
        <div className="h-24 bg-secondary rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Today's Earnings Card - Simplified */}
      <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">أرباح اليوم</span>
              </div>
              <p className="text-4xl font-bold text-foreground">
                {stats.todayEarnings.toLocaleString('en-US')}
              </p>
              <p className="text-sm text-muted-foreground mt-1">دينار عراقي</p>
            </div>
            
            {/* Trend Indicator */}
            <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${
              isTrendUp ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
            }`}>
              {isTrendUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{Math.abs(trend).toFixed(0)}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Car className="w-4 h-4" />
              {stats.todayRides} رحلة اليوم
            </span>
            <span className="text-sm text-muted-foreground">
              أمس: {stats.yesterdayEarnings.toLocaleString('en-US')} د.ع
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Daily Goal Progress */}
      <Card className="border-border/50">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">هدف اليوم</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {stats.todayEarnings.toLocaleString('en-US')} / {DAILY_GOAL.toLocaleString('en-US')} د.ع
            </span>
          </div>
          <Progress value={dailyProgress} className="h-3" />
          <div className="flex items-center justify-between mt-3 text-sm">
            <span className="text-muted-foreground">
              متبقي {Math.max(0, DAILY_GOAL - stats.todayEarnings).toLocaleString('en-US')} د.ع
            </span>
            <span className={dailyProgress >= 100 ? "text-emerald-500 font-medium" : "text-muted-foreground"}>
              {dailyProgress >= 100 ? "🎉 تم تحقيق الهدف!" : `${dailyProgress.toFixed(0)}%`}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverStats;
