import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Phone, Ban, RefreshCw, Search, TrendingUp, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface SMSLog {
  id: string;
  phone: string;
  message_type: string;
  purpose: string | null;
  provider: string;
  status: string;
  error_message: string | null;
  ip_address: string;
  cost: number;
  created_at: string;
}

interface BlockedPhone {
  id: string;
  phone: string;
  reason: string | null;
  blocked_until: string | null;
  is_permanent: boolean;
  failure_count: number;
}

interface SMSStats {
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  total_cost: number;
  whatsapp_count: number;
  sms_count: number;
}

export default function AdminSMSLogs() {
  const [logs, setLogs] = useState<SMSLog[]>([]);
  const [blockedPhones, setBlockedPhones] = useState<BlockedPhone[]>([]);
  const [stats, setStats] = useState<SMSStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchPhone, setSearchPhone] = useState("");
  const [activeTab, setActiveTab] = useState<"logs" | "blocked">("logs");

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch logs
      const { data: logsData } = await supabase
        .from("sms_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      // Fetch blocked phones
      const { data: blockedData } = await supabase
        .from("blocked_phones")
        .select("*")
        .order("created_at", { ascending: false });

      // Fetch stats
      const { data: statsData } = await supabase.rpc("get_sms_stats", { p_days: 30 });

      setLogs(logsData || []);
      setBlockedPhones(blockedData || []);
      if (statsData && statsData.length > 0) {
        setStats(statsData[0]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const unblockPhone = async (id: string) => {
    await supabase.from("blocked_phones").delete().eq("id", id);
    fetchData();
  };

  const filteredLogs = logs.filter((log) =>
    log.phone.includes(searchPhone)
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
      case "delivered":
        return <Badge className="bg-green-500">تم الإرسال</Badge>;
      case "failed":
        return <Badge variant="destructive">فشل</Badge>;
      case "blocked":
        return <Badge variant="secondary">محظور</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getProviderBadge = (provider: string) => {
    if (provider === "whatsapp") {
      return <Badge className="bg-green-600">WhatsApp</Badge>;
    }
    return <Badge className="bg-blue-500">SMS</Badge>;
  };

  return (
    <AdminLayout title="سجلات الرسائل">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">سجلات الرسائل</h1>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 ml-2" />
            تحديث
          </Button>
        </div>

        {/* Stats Cards */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">إجمالي المرسلة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_sent}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  آخر 30 يوم
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">الفاشلة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{stats.total_failed}</div>
                <div className="text-xs text-muted-foreground">
                  {stats.total_sent > 0 ? ((stats.total_failed / stats.total_sent) * 100).toFixed(1) : 0}% نسبة الفشل
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">WhatsApp / SMS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.whatsapp_count} / {stats.sms_count}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">التكلفة التقديرية</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${Number(stats.total_cost).toFixed(2)}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
          <Button
            variant={activeTab === "logs" ? "default" : "outline"}
            onClick={() => setActiveTab("logs")}
          >
            <MessageSquare className="h-4 w-4 ml-2" />
            سجل الرسائل
          </Button>
          <Button
            variant={activeTab === "blocked" ? "default" : "outline"}
            onClick={() => setActiveTab("blocked")}
          >
            <Ban className="h-4 w-4 ml-2" />
            الأرقام المحظورة ({blockedPhones.length})
          </Button>
        </div>

        {activeTab === "logs" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث برقم الهاتف..."
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    className="pr-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>المزود</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono">{log.phone}</TableCell>
                        <TableCell>{log.purpose || log.message_type}</TableCell>
                        <TableCell>{getProviderBadge(log.provider)}</TableCell>
                        <TableCell>
                          {getStatusBadge(log.status)}
                          {log.error_message && (
                            <span className="text-xs text-destructive block">{log.error_message}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{log.ip_address}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(log.created_at).toLocaleString("ar-IQ")}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredLogs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          لا توجد سجلات
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "blocked" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                الأرقام المحظورة
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : blockedPhones.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد أرقام محظورة
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>السبب</TableHead>
                      <TableHead>عدد الفشل</TableHead>
                      <TableHead>ينتهي الحظر</TableHead>
                      <TableHead>إجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blockedPhones.map((phone) => (
                      <TableRow key={phone.id}>
                        <TableCell className="font-mono">{phone.phone}</TableCell>
                        <TableCell>{phone.reason || "-"}</TableCell>
                        <TableCell>{phone.failure_count}</TableCell>
                        <TableCell>
                          {phone.is_permanent ? (
                            <Badge variant="destructive">دائم</Badge>
                          ) : phone.blocked_until ? (
                            new Date(phone.blocked_until).toLocaleString("ar-IQ")
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => unblockPhone(phone.id)}
                          >
                            إلغاء الحظر
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
