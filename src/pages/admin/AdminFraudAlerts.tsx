/**
 * صفحة تنبيهات الاحتيال — Admin Fraud Alerts
 * عرض وإدارة التنبيهات المشبوهة
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from: (table: string) => any };
import AdminLayout from "@/components/admin/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  Shield,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Eye,
  Clock,
  Ban,
  Users,
  TrendingUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface FraudAlert {
  id: string;
  alert_type: string;
  severity: string;
  user_id: string;
  user_type: string;
  description: string;
  details: Record<string, unknown>;
  status: string;
  review_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const AdminFraudAlerts = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");

  const { isAdmin } = useAdminAuth();

  const { data: alerts = [], isLoading: loading } = useQuery({
    queryKey: ["fraud-alerts", activeTab],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as SupabaseUntyped)
        .from("fraud_alerts")
        .select("*")
        .eq("status", activeTab)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as FraudAlert[];
    },
    enabled: isAdmin,
  });

  const { data: stats = { pending: 0, high: 0, today: 0, actioned: 0 } } = useQuery({
    queryKey: ["fraud-stats"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const db = supabase as unknown as SupabaseUntyped;
      const [pending, high, todayAlerts, actioned] = await Promise.all([
        db.from("fraud_alerts").select("id", { count: "exact", head: true }).eq("status", "pending"),
        db.from("fraud_alerts").select("id", { count: "exact", head: true }).eq("severity", "high").eq("status", "pending"),
        db.from("fraud_alerts").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
        db.from("fraud_alerts").select("id", { count: "exact", head: true }).eq("status", "actioned"),
      ]);
      return {
        pending: pending.count || 0,
        high: high.count || 0,
        today: todayAlerts.count || 0,
        actioned: actioned.count || 0,
      };
    },
    enabled: isAdmin,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["fraud-alerts"] });
    queryClient.invalidateQueries({ queryKey: ["fraud-stats"] });
  };

  const runScan = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("detect-fraud-patterns");
      if (error) throw error;
      toast({
        title: "تم الفحص",
        description: `تم العثور على ${data?.alerts_count || 0} تنبيه جديد`,
      });
      invalidateAll();
    } catch (err) {
      toast({ title: "خطأ في الفحص", description: (err as Error).message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ alertId, status }: { alertId: string; status: string }) => {
      const { error } = await (supabase as unknown as SupabaseUntyped)
        .from("fraud_alerts")
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      toast({ title: variables.status === "dismissed" ? "تم التجاهل" : "تم التنفيذ" });
      invalidateAll();
    },
    onError: (err) => {
      toast({ title: "خطأ", description: (err as Error).message, variant: "destructive" });
    },
  });

  const updateAlertStatus = (alertId: string, status: string) => {
    updateStatusMutation.mutate({ alertId, status });
  };

  const getSeverityBadge = (severity: string) => {
    const config: Record<string, { color: string; label: string }> = {
      high: { color: "bg-red-500", label: "عالي" },
      medium: { color: "bg-orange-500", label: "متوسط" },
      low: { color: "bg-yellow-500", label: "منخفض" },
    };
    const c = config[severity] || config.low;
    return <Badge className={c.color}>{c.label}</Badge>;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      excessive_cancellations: "إلغاء متكرر (راكب)",
      driver_excessive_cancellations: "إلغاء متكرر (سائق)",
      suspicious_pair: "تكرار سائق-راكب",
      abnormal_fare: "أجرة غير طبيعية",
      repeated_route: "مسار متكرر",
    };
    return labels[type] || type;
  };

  const getTypeIcon = (type: string) => {
    if (type.includes("cancel")) return <Ban className="w-4 h-4" />;
    if (type.includes("pair")) return <Users className="w-4 h-4" />;
    if (type.includes("fare")) return <TrendingUp className="w-4 h-4" />;
    return <AlertTriangle className="w-4 h-4" />;
  };

  return (
    <AdminLayout title="كشف الاحتيال" subtitle="مراقبة الأنماط المشبوهة">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">كشف الاحتيال</h1>
            <p className="text-muted-foreground">مراقبة وتحليل الأنماط المشبوهة</p>
          </div>
          <Button onClick={runScan} disabled={scanning}>
            {scanning ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <RefreshCw className="w-4 h-4 ml-2" />}
            فحص الآن
          </Button>
        </div>

        {/* إحصائيات */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">معلقة</p>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                </div>
                <Clock className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">عالية الخطورة</p>
                  <p className="text-2xl font-bold text-red-500">{stats.high}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">اليوم</p>
                  <p className="text-2xl font-bold">{stats.today}</p>
                </div>
                <Eye className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">تم التنفيذ</p>
                  <p className="text-2xl font-bold text-green-500">{stats.actioned}</p>
                </div>
                <Shield className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* التنبيهات */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pending">معلقة</TabsTrigger>
            <TabsTrigger value="reviewed">مراجعة</TabsTrigger>
            <TabsTrigger value="actioned">منفذة</TabsTrigger>
            <TabsTrigger value="dismissed">متجاهلة</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : alerts.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Shield className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p className="text-muted-foreground">لا توجد تنبيهات</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <Card
                    key={alert.id}
                    className={alert.severity === "high" ? "border-red-500 border-2" : ""}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="mt-1">{getTypeIcon(alert.alert_type)}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {getSeverityBadge(alert.severity)}
                              <Badge variant="outline">
                                {alert.user_type === "rider" ? "راكب" : "سائق"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {getTypeLabel(alert.alert_type)}
                              </span>
                            </div>
                            <p className="text-sm font-medium">{alert.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(alert.created_at), {
                                addSuffix: true,
                                locale: ar,
                              })}
                              {" · "}
                              ID: {alert.user_id.substring(0, 8)}...
                            </p>
                          </div>
                        </div>
                        {alert.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateAlertStatus(alert.id, "actioned")}
                            >
                              <CheckCircle className="w-4 h-4 ml-1" />
                              تنفيذ
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateAlertStatus(alert.id, "dismissed")}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminFraudAlerts;
