/**
 * صفحة عملاء البوت - Bot Customers Marketing Database
 * عرض وإدارة العملاء الذين تفاعلوا عبر واتساب وتليجرام
 */

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminLayout from "@/components/admin/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Search,
  MessageCircle,
  Phone,
  RefreshCw,
  Download,
  Calendar,
  Hash,
  User,
  Globe,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ar } from "date-fns/locale";

interface BotCustomer {
  id: string;
  platform: "whatsapp" | "telegram";
  platform_id: string;
  full_name: string | null;
  username: string | null;
  phone_number: string | null;
  first_seen: string;
  last_active: string;
  interaction_count: number;
}

const AdminBotCustomers = () => {
  const { toast } = useToast();
  const { loading: authLoading, isAdmin } = useAdminAuth();

  const [customers, setCustomers] = useState<BotCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  // ─── إحصائيات ───
  const stats = useMemo(() => {
    const total = customers.length;
    const whatsapp = customers.filter((c) => c.platform === "whatsapp").length;
    const telegram = customers.filter((c) => c.platform === "telegram").length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeToday = customers.filter(
      (c) => new Date(c.last_active) >= today
    ).length;
    const totalInteractions = customers.reduce(
      (sum, c) => sum + (c.interaction_count || 0),
      0
    );
    return { total, whatsapp, telegram, activeToday, totalInteractions };
  }, [customers]);

  // ─── جلب البيانات ───
  useEffect(() => {
    if (isAdmin) fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const fetchCustomers = async () => {
    setLoading(true);
    // bot_customers جدول جديد — لم يُضاف بعد للتايبات المولّدة
    const { data, error } = await (supabase as any)
      .from("bot_customers")
      .select("*")
      .order("last_active", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Failed to fetch bot_customers:", error);
      toast({
        title: "خطأ",
        description: "فشل في جلب بيانات العملاء",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setCustomers((data as BotCustomer[]) || []);
    setLoading(false);
  };

  // ─── الفلترة ───
  const filteredCustomers = useMemo(() => {
    let result = [...customers];

    if (platformFilter !== "all") {
      result = result.filter((c) => c.platform === platformFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.full_name?.toLowerCase().includes(q) ||
          c.username?.toLowerCase().includes(q) ||
          c.phone_number?.includes(q) ||
          c.platform_id.includes(q)
      );
    }

    return result;
  }, [customers, platformFilter, searchQuery]);

  // ─── تصدير CSV ───
  const exportCSV = () => {
    if (filteredCustomers.length === 0) {
      toast({ title: "لا توجد بيانات للتصدير" });
      return;
    }

    const headers = [
      "المنصة",
      "الاسم",
      "اسم المستخدم",
      "رقم الهاتف",
      "أول ظهور",
      "آخر نشاط",
      "عدد التفاعلات",
    ];
    const rows = filteredCustomers.map((c) => [
      c.platform,
      c.full_name || "-",
      c.username || "-",
      c.phone_number || "-",
      format(new Date(c.first_seen), "yyyy-MM-dd HH:mm"),
      format(new Date(c.last_active), "yyyy-MM-dd HH:mm"),
      c.interaction_count,
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `bot_customers_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();

    toast({ title: `تم تصدير ${filteredCustomers.length} عميل بنجاح ✅` });
  };

  // ─── Guard ───
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <AdminLayout
      title="عملاء البوت 🤖"
      subtitle={`${filteredCustomers.length} من ${customers.length} عميل`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 ml-1" />
            تصدير CSV
          </Button>
          <Button variant="outline" size="sm" onClick={fetchCustomers}>
            <RefreshCw className="h-4 w-4 ml-1" />
            تحديث
          </Button>
        </div>
      }
    >
      {/* ── بطاقات الإحصائيات ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-6 w-6 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">إجمالي العملاء</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Phone className="h-6 w-6 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold">{stats.whatsapp}</p>
            <p className="text-xs text-muted-foreground">واتساب</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <MessageCircle className="h-6 w-6 mx-auto mb-1 text-sky-500" />
            <p className="text-2xl font-bold">{stats.telegram}</p>
            <p className="text-xs text-muted-foreground">تليجرام</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="h-6 w-6 mx-auto mb-1 text-amber-500" />
            <p className="text-2xl font-bold">{stats.activeToday}</p>
            <p className="text-xs text-muted-foreground">نشطون اليوم</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Hash className="h-6 w-6 mx-auto mb-1 text-purple-500" />
            <p className="text-2xl font-bold">{stats.totalInteractions}</p>
            <p className="text-xs text-muted-foreground">إجمالي التفاعلات</p>
          </CardContent>
        </Card>
      </div>

      {/* ── الفلاتر ── */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو رقم الهاتف أو المعرف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-[160px]">
                <Globe className="h-4 w-4 ml-2" />
                <SelectValue placeholder="المنصة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المنصات</SelectItem>
                <SelectItem value="whatsapp">واتساب</SelectItem>
                <SelectItem value="telegram">تليجرام</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || platformFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setPlatformFilter("all");
                }}
              >
                مسح الفلاتر
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── جدول العملاء ── */}
      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">جاري تحميل بيانات العملاء...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-medium mb-1">لا يوجد عملاء</p>
            <p className="text-sm text-muted-foreground">
              {customers.length > 0
                ? "جرب تغيير فلاتر البحث"
                : "سيظهر العملاء تلقائياً عند تفاعلهم مع بوت واتساب أو تليجرام"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المنصة</TableHead>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">المعرف</TableHead>
                  <TableHead className="text-right">رقم الهاتف</TableHead>
                  <TableHead className="text-right">أول ظهور</TableHead>
                  <TableHead className="text-right">آخر نشاط</TableHead>
                  <TableHead className="text-right">التفاعلات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <Badge
                        variant={
                          customer.platform === "whatsapp"
                            ? "default"
                            : "secondary"
                        }
                        className={
                          customer.platform === "whatsapp"
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-sky-100 text-sky-700 hover:bg-sky-200"
                        }
                      >
                        {customer.platform === "whatsapp" ? (
                          <Phone className="h-3 w-3 ml-1" />
                        ) : (
                          <MessageCircle className="h-3 w-3 ml-1" />
                        )}
                        {customer.platform === "whatsapp"
                          ? "واتساب"
                          : "تليجرام"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {customer.full_name || "بدون اسم"}
                        </span>
                        {customer.username && (
                          <span className="text-xs text-muted-foreground" dir="ltr">
                            @{customer.username}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded" dir="ltr">
                        {customer.platform_id}
                      </code>
                    </TableCell>
                    <TableCell>
                      {customer.phone_number ? (
                        <span dir="ltr" className="text-sm">
                          {customer.phone_number}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {formatDistanceToNow(new Date(customer.first_seen), {
                          addSuffix: true,
                          locale: ar,
                        })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {formatDistanceToNow(new Date(customer.last_active), {
                          addSuffix: true,
                          locale: ar,
                        })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {customer.interaction_count}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </AdminLayout>
  );
};

export default AdminBotCustomers;
