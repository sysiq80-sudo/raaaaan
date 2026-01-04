import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminLayout from "@/components/admin/AdminLayout";
import { 
  Map, 
  Navigation, 
  MapPin,
  Image,
  DollarSign,
  TrendingUp,
  Calendar,
  Activity,
  BarChart3,
  Clock,
  AlertCircle
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ar } from "date-fns/locale";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Mapbox pricing (as of 2024) - per 1000 requests
const MAPBOX_PRICING = {
  mapbox_directions: 5.00,      // $5 per 1000 requests
  mapbox_geocode: 0.75,         // $0.75 per 1000 requests  
  mapbox_reverse_geocode: 0.75, // $0.75 per 1000 requests
  mapbox_static: 1.00,          // $1 per 1000 requests
  mapbox_token: 0,              // Free
  google_directions: 5.00,      // $5 per 1000 requests
  google_geocode: 5.00,         // $5 per 1000 requests
};

const API_TYPE_LABELS: Record<string, string> = {
  mapbox_directions: "الاتجاهات",
  mapbox_geocode: "البحث عن مكان",
  mapbox_reverse_geocode: "عنوان من إحداثيات",
  mapbox_static: "صور ثابتة",
  mapbox_token: "توكن",
  google_directions: "Google اتجاهات",
  google_geocode: "Google بحث",
};

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

interface ApiStats {
  totalRequests: number;
  totalCost: number;
  todayRequests: number;
  todayCost: number;
  byType: Record<string, { requests: number; cost: number }>;
  dailyTrend: Array<{ date: string; requests: number; cost: number }>;
}

const AdminApiStats = () => {
  const navigate = useNavigate();
  const { user, loading, isAdmin } = useAdminAuth();
  const [stats, setStats] = useState<ApiStats>({
    totalRequests: 0,
    totalCost: 0,
    todayRequests: 0,
    todayCost: 0,
    byType: {},
    dailyTrend: [],
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [dateRange, setDateRange] = useState("30");

  useEffect(() => {
    if (isAdmin) {
      fetchStats();
    }
  }, [isAdmin, dateRange]);

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const daysAgo = parseInt(dateRange);
      const startDate = format(subDays(new Date(), daysAgo), 'yyyy-MM-dd');
      const today = format(new Date(), 'yyyy-MM-dd');

      // Fetch all logs within date range
      const { data: logs, error } = await supabase
        .from("api_usage_logs")
        .select("*")
        .gte("date", startDate)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching API logs:", error);
        setStatsLoading(false);
        return;
      }

      // Process data
      const byType: Record<string, { requests: number; cost: number }> = {};
      const dailyData: Record<string, { requests: number; cost: number }> = {};
      let totalRequests = 0;
      let totalCost = 0;
      let todayRequests = 0;
      let todayCost = 0;

      (logs || []).forEach((log) => {
        const type = log.api_type;
        const requests = log.request_count || 1;
        const costPer1000 = MAPBOX_PRICING[type as keyof typeof MAPBOX_PRICING] || 0;
        const cost = (requests / 1000) * costPer1000;

        // By type
        if (!byType[type]) {
          byType[type] = { requests: 0, cost: 0 };
        }
        byType[type].requests += requests;
        byType[type].cost += cost;

        // By date
        const dateKey = log.date;
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = { requests: 0, cost: 0 };
        }
        dailyData[dateKey].requests += requests;
        dailyData[dateKey].cost += cost;

        // Totals
        totalRequests += requests;
        totalCost += cost;

        // Today
        if (log.date === today) {
          todayRequests += requests;
          todayCost += cost;
        }
      });

      // Convert daily data to array
      const dailyTrend = Object.entries(dailyData)
        .map(([date, data]) => ({
          date: format(new Date(date), 'MM/dd', { locale: ar }),
          requests: data.requests,
          cost: parseFloat(data.cost.toFixed(2)),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setStats({
        totalRequests,
        totalCost,
        todayRequests,
        todayCost,
        byType,
        dailyTrend,
      });
    } catch (error) {
      console.error("Error processing stats:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  const pieData = Object.entries(stats.byType).map(([type, data]) => ({
    name: API_TYPE_LABELS[type] || type,
    value: data.requests,
    cost: data.cost,
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary flex items-center justify-center mb-4 animate-pulse">
            <BarChart3 className="w-10 h-10 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <AdminLayout 
      title="إحصائيات API" 
      subtitle="تتبع استخدام Mapbox وتكاليف الخرائط"
      actions={
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="الفترة الزمنية" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">آخر 7 أيام</SelectItem>
            <SelectItem value="14">آخر 14 يوم</SelectItem>
            <SelectItem value="30">آخر 30 يوم</SelectItem>
            <SelectItem value="90">آخر 90 يوم</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">إجمالي</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {statsLoading ? "..." : stats.totalRequests.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">طلبات API</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-xs bg-green-500/20 text-green-600 px-2 py-1 rounded-full">تكلفة</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              ${statsLoading ? "..." : stats.totalCost.toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground">التكلفة المقدرة</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-xs bg-blue-500/20 text-blue-600 px-2 py-1 rounded-full">اليوم</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {statsLoading ? "..." : stats.todayRequests.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">طلبات اليوم</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-xs bg-orange-500/20 text-orange-600 px-2 py-1 rounded-full">معدل</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {statsLoading ? "..." : Math.round(stats.totalRequests / parseInt(dateRange)).toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">طلب/يوم</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Trend Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              اتجاه الاستخدام
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {stats.dailyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.dailyTrend}>
                    <defs>
                      <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number, name: string) => [
                        name === 'requests' ? `${value} طلب` : `$${value}`,
                        name === 'requests' ? 'الطلبات' : 'التكلفة'
                      ]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="requests" 
                      stroke="hsl(var(--primary))" 
                      fillOpacity={1} 
                      fill="url(#colorRequests)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>لا توجد بيانات</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Distribution Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              توزيع الطلبات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      fill="#8884d8"
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name: string, props: any) => [
                        `${value.toLocaleString()} طلب ($${props.payload.cost.toFixed(2)})`,
                        name
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>لا توجد بيانات</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Map className="w-4 h-4" />
            تفاصيل الاستخدام حسب النوع
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(stats.byType).map(([type, data]) => {
              const icon = type.includes('direction') ? Navigation :
                          type.includes('static') ? Image :
                          type.includes('geocode') ? MapPin : Map;
              const Icon = icon;
              
              return (
                <div 
                  key={type}
                  className="p-4 rounded-lg bg-muted/50 border border-border/50"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{API_TYPE_LABELS[type] || type}</p>
                      <p className="text-xs text-muted-foreground">{type}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">الطلبات</span>
                      <span className="font-medium">{data.requests.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">التكلفة</span>
                      <span className="font-medium text-green-600">${data.cost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {Object.keys(stats.byType).length === 0 && !statsLoading && (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-1">لا توجد بيانات API حتى الآن</p>
              <p className="text-sm">ستظهر الإحصائيات هنا بمجرد بدء استخدام خدمات الخرائط</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing Reference */}
      <Card className="mt-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            مرجع الأسعار (لكل 1000 طلب)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {Object.entries(MAPBOX_PRICING).filter(([_, price]) => price > 0).map(([type, price]) => (
              <div key={type} className="flex justify-between p-2 rounded bg-muted/30">
                <span className="text-muted-foreground">{API_TYPE_LABELS[type] || type}</span>
                <span className="font-medium">${price}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default AdminApiStats;