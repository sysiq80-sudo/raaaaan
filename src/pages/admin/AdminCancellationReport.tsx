import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { XCircle, DollarSign, TrendingDown, Users, Car } from "lucide-react";
import { format, subDays, eachDayOfInterval, startOfDay } from "date-fns";
import { ar } from "date-fns/locale";

interface CancelledRide {
  id: string;
  created_at: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  cancellation_fee: number | null;
  cancellation_fee_paid: boolean | null;
  estimated_fare: number | null;
  vehicle_type: string | null;
}

interface DailyCancellation {
  date: string;
  count: number;
  fees: number;
}

interface CancellerDistribution {
  name: string;
  value: number;
  color: string;
}

const AdminCancellationReport = () => {
  const { loading: authLoading, isAdmin } = useAdminAuth();
  const [cancelledRides, setCancelledRides] = useState<CancelledRide[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyCancellation[]>([]);
  const [cancellerDistribution, setCancellerDistribution] = useState<CancellerDistribution[]>([]);
  const [totals, setTotals] = useState({
    totalCancellations: 0,
    totalFeesCollected: 0,
    totalFeesPending: 0,
    cancellationRate: 0,
    riderCancellations: 0,
    driverCancellations: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      fetchCancellationData();
    }
  }, [isAdmin]);

  const fetchCancellationData = async () => {
    try {
      // Fetch all rides
      const { data: allRides, error: allError } = await supabase
        .from("rides")
        .select("id, status")
        .limit(10000);

      if (allError) throw allError;

      // Fetch cancelled rides
      const { data: rides, error } = await supabase
        .from("rides")
        .select("id, created_at, pickup_address, dropoff_address, cancelled_by, cancellation_reason, cancellation_fee, cancellation_fee_paid, estimated_fare, vehicle_type")
        .eq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      setCancelledRides(rides || []);

      if (!rides || rides.length === 0) {
        setLoading(false);
        return;
      }

      // Calculate totals
      const totalRides = allRides?.length || 0;
      const riderCancellations = rides.filter(r => r.cancelled_by === "rider").length;
      const driverCancellations = rides.filter(r => r.cancelled_by === "driver").length;
      const feesCollected = rides
        .filter(r => r.cancellation_fee_paid)
        .reduce((sum, r) => sum + (r.cancellation_fee || 0), 0);
      const feesPending = rides
        .filter(r => !r.cancellation_fee_paid && (r.cancellation_fee || 0) > 0)
        .reduce((sum, r) => sum + (r.cancellation_fee || 0), 0);

      setTotals({
        totalCancellations: rides.length,
        totalFeesCollected: feesCollected,
        totalFeesPending: feesPending,
        cancellationRate: totalRides > 0 ? (rides.length / totalRides) * 100 : 0,
        riderCancellations,
        driverCancellations,
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
        const dayFees = dayRides
          .filter(r => r.cancellation_fee_paid)
          .reduce((sum, r) => sum + (r.cancellation_fee || 0), 0);

        return {
          date: format(day, "EEE", { locale: ar }),
          count: dayRides.length,
          fees: dayFees,
        };
      });

      setDailyStats(dailyData);

      // Canceller distribution
      setCancellerDistribution([
        { name: "الراكب", value: riderCancellations, color: "hsl(var(--chart-1))" },
        { name: "السائق", value: driverCancellations, color: "hsl(var(--chart-2))" },
        { name: "النظام", value: rides.length - riderCancellations - driverCancellations, color: "hsl(var(--chart-3))" },
      ].filter(item => item.value > 0));

    } catch (error) {
      console.error("Error fetching cancellation data:", error);
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

  const getCancellerBadge = (cancelledBy: string | null) => {
    switch (cancelledBy) {
      case "rider":
        return <Badge variant="secondary">الراكب</Badge>;
      case "driver":
        return <Badge variant="outline">السائق</Badge>;
      default:
        return <Badge variant="destructive">النظام</Badge>;
    }
  };

  const getVehicleType = (type: string | null) => {
    const types: Record<string, string> = {
      economy: "اقتصادي",
      comfort: "مريح",
      premium: "فاخر",
      women_only: "نسائي",
    };
    return types[type || "economy"] || type;
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
      title="تقرير الإلغاءات" 
      subtitle="إحصائيات الإلغاءات والغرامات المحصلة"
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">إجمالي الإلغاءات</p>
                <p className="text-2xl font-bold text-foreground">{totals.totalCancellations}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {totals.cancellationRate.toFixed(1)}% من الرحلات
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">الغرامات المحصلة</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totals.totalFeesCollected)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-chart-4/10 to-chart-4/5 border-chart-4/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">الغرامات المعلقة</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totals.totalFeesPending)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-chart-4/20 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-chart-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-chart-2/10 to-chart-2/5 border-chart-2/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">إلغاء الراكب / السائق</p>
                <p className="text-2xl font-bold text-foreground">
                  {totals.riderCancellations} / {totals.driverCancellations}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-chart-2/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-chart-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Daily Cancellations Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">الإلغاءات اليومية (آخر 7 أيام)</CardTitle>
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
                    formatter={(value: number, name: string) => [
                      name === "count" ? `${value} إلغاء` : formatCurrency(value),
                      name === "count" ? "الإلغاءات" : "الغرامات"
                    ]}
                  />
                  <Legend formatter={(value) => value === "count" ? "الإلغاءات" : "الغرامات"} />
                  <Bar 
                    dataKey="count" 
                    fill="hsl(var(--destructive))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Canceller Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">توزيع الإلغاءات حسب الطرف</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={cancellerDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {cancellerDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                    formatter={(value: number) => [`${value} إلغاء`, ""]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cancellations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Car className="w-5 h-5" />
            آخر الإلغاءات
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
          ) : cancelledRides.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">لا توجد إلغاءات</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">من</TableHead>
                    <TableHead className="text-right">إلى</TableHead>
                    <TableHead className="text-right">نوع المركبة</TableHead>
                    <TableHead className="text-right">ألغي بواسطة</TableHead>
                    <TableHead className="text-right">السبب</TableHead>
                    <TableHead className="text-right">الغرامة</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cancelledRides.map((ride) => (
                    <TableRow key={ride.id}>
                      <TableCell className="font-medium">
                        {format(new Date(ride.created_at), "dd/MM/yyyy HH:mm", { locale: ar })}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {ride.pickup_address || "-"}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {ride.dropoff_address || "-"}
                      </TableCell>
                      <TableCell>{getVehicleType(ride.vehicle_type)}</TableCell>
                      <TableCell>{getCancellerBadge(ride.cancelled_by)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {ride.cancellation_reason || "-"}
                      </TableCell>
                      <TableCell>
                        {ride.cancellation_fee ? formatCurrency(ride.cancellation_fee) : "-"}
                      </TableCell>
                      <TableCell>
                        {ride.cancellation_fee ? (
                          ride.cancellation_fee_paid ? (
                            <Badge className="bg-primary/20 text-primary border-0">مدفوعة</Badge>
                          ) : (
                            <Badge variant="outline" className="text-chart-4 border-chart-4">معلقة</Badge>
                          )
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default AdminCancellationReport;
