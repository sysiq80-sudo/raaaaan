import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ar } from "date-fns/locale";
import { 
  DollarSign, 
  TrendingUp, 
  Car, 
  Calendar,
  Loader2,
  PieChart
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const AdminCommissionReports = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('month');

  // Get date range based on selected period
  const getDateRange = () => {
    const now = new Date();
    switch (selectedPeriod) {
      case 'today':
        return { start: format(now, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      case 'week':
        return { 
          start: format(startOfWeek(now, { weekStartsOn: 6 }), 'yyyy-MM-dd'), 
          end: format(endOfWeek(now, { weekStartsOn: 6 }), 'yyyy-MM-dd') 
        };
      case 'month':
      default:
        return { 
          start: format(startOfMonth(now), 'yyyy-MM-dd'), 
          end: format(endOfMonth(now), 'yyyy-MM-dd') 
        };
    }
  };

  // Fetch company earnings
  const { data: earnings, isLoading } = useQuery({
    queryKey: ['company-earnings', selectedPeriod],
    queryFn: async () => {
      const { start, end } = getDateRange();
      const { data, error } = await supabase
        .from('company_earnings')
        .select(`
          *,
          drivers (full_name)
        `)
        .gte('date', start)
        .lte('date', end)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  // Fetch daily stats for chart
  const { data: dailyStats } = useQuery({
    queryKey: ['company-earnings-daily', selectedPeriod],
    queryFn: async () => {
      const { start, end } = getDateRange();
      const { data, error } = await supabase
        .from('company_earnings')
        .select('date, commission_amount, driver_share, total_fare')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true });

      if (error) throw error;

      // Group by date
      const grouped = data?.reduce((acc: Record<string, any>, item) => {
        if (!acc[item.date]) {
          acc[item.date] = { 
            date: item.date, 
            commission: 0, 
            driver_share: 0, 
            total: 0,
            rides: 0 
          };
        }
        acc[item.date].commission += item.commission_amount;
        acc[item.date].driver_share += item.driver_share;
        acc[item.date].total += item.total_fare;
        acc[item.date].rides += 1;
        return acc;
      }, {});

      return Object.values(grouped || {});
    }
  });

  // Calculate totals
  const totals = earnings?.reduce((acc, item) => ({
    totalFares: acc.totalFares + (item.total_fare || 0),
    totalCommission: acc.totalCommission + (item.commission_amount || 0),
    totalDriverShare: acc.totalDriverShare + (item.driver_share || 0),
    ridesCount: acc.ridesCount + 1
  }), { totalFares: 0, totalCommission: 0, totalDriverShare: 0, ridesCount: 0 });

  // Get top drivers by commission
  const topDrivers = earnings?.reduce((acc: Record<string, any>, item) => {
    const driverName = (item.drivers as any)?.full_name || 'غير معروف';
    if (!acc[driverName]) {
      acc[driverName] = { name: driverName, commission: 0, rides: 0, total: 0 };
    }
    acc[driverName].commission += item.commission_amount;
    acc[driverName].rides += 1;
    acc[driverName].total += item.total_fare;
    return acc;
  }, {});

  const topDriversList = Object.values(topDrivers || {})
    .sort((a: any, b: any) => b.commission - a.commission)
    .slice(0, 5);

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString('ar-IQ')} د.ع`;
  };

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'today': return 'اليوم';
      case 'week': return 'هذا الأسبوع';
      case 'month': return 'هذا الشهر';
    }
  };

  return (
    <AdminLayout 
      title="تقارير العمولات" 
      subtitle="عرض أرباح الشركة من العمولات على الرحلات"
    >
      {/* Period Selector */}
      <div className="mb-6">
        <Tabs value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as any)}>
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="today">اليوم</TabsTrigger>
            <TabsTrigger value="week">هذا الأسبوع</TabsTrigger>
            <TabsTrigger value="month">هذا الشهر</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  إجمالي الإيرادات
                </CardTitle>
                <DollarSign className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency(totals?.totalFares || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {getPeriodLabel()}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-primary">
                  عمولة الشركة
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(totals?.totalCommission || 0)}
                </div>
                <Badge variant="secondary" className="mt-1">
                  15% من الإيرادات
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  حصة السائقين
                </CardTitle>
                <PieChart className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency(totals?.totalDriverShare || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  85% من الإيرادات
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  عدد الرحلات
                </CardTitle>
                <Car className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {totals?.ridesCount || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  رحلة مكتملة
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Daily Earnings Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">العمولات اليومية</CardTitle>
              </CardHeader>
              <CardContent>
                {dailyStats && dailyStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(date) => format(new Date(date), 'd MMM', { locale: ar })}
                        className="text-xs"
                      />
                      <YAxis 
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                        className="text-xs"
                      />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(date) => format(new Date(date), 'EEEE d MMMM', { locale: ar })}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="commission" 
                        name="العمولة"
                        stroke="hsl(var(--primary))" 
                        fill="hsl(var(--primary))" 
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    لا توجد بيانات لعرضها
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Rides per Day Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">الرحلات اليومية</CardTitle>
              </CardHeader>
              <CardContent>
                {dailyStats && dailyStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(date) => format(new Date(date), 'd MMM', { locale: ar })}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        formatter={(value: number) => value}
                        labelFormatter={(date) => format(new Date(date), 'EEEE d MMMM', { locale: ar })}
                      />
                      <Bar 
                        dataKey="rides" 
                        name="الرحلات"
                        fill="hsl(var(--primary))" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    لا توجد بيانات لعرضها
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Drivers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">أكثر السائقين إيراداً</CardTitle>
              </CardHeader>
              <CardContent>
                {topDriversList.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>السائق</TableHead>
                        <TableHead>الرحلات</TableHead>
                        <TableHead>العمولة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topDriversList.map((driver: any, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{driver.name}</TableCell>
                          <TableCell>{driver.rides}</TableCell>
                          <TableCell className="text-primary font-semibold">
                            {formatCurrency(driver.commission)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    لا توجد بيانات
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">آخر العمليات</CardTitle>
              </CardHeader>
              <CardContent>
                {earnings && earnings.length > 0 ? (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto">
                    {earnings.slice(0, 10).map((earning) => (
                      <div 
                        key={earning.id} 
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {(earning.drivers as any)?.full_name || 'سائق'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(earning.created_at), 'dd/MM/yyyy HH:mm', { locale: ar })}
                          </p>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-primary">
                            +{formatCurrency(earning.commission_amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            من {formatCurrency(earning.total_fare)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    لا توجد عمليات
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </AdminLayout>
  );
};

export default AdminCommissionReports;