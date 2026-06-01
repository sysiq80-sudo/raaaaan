import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  Database,
  Zap,
  ArrowUpDown,
  Radio,
  HardDrive,
  Clock,
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Infinity,
  Trash2,
  Timer,
  TrendingUp,
  Users,
  Car,
  Route,
  Activity,
  Server,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ═══════════════════════════════════════════════════
// القيم الثابتة — من تحليل 2026-05-28
// ═══════════════════════════════════════════════════
const FREE_TIER_LIMITS = {
  dbSize: { used: 0.068, limit: 0.5, unit: "GB", label: "حجم قاعدة البيانات" },
  edgeFunctions: { used: 49750, limit: 500000, unit: "", label: "Edge Functions" },
  egress: { used: 0.424, limit: 5, unit: "GB", label: "Egress" },
  realtime: { used: 13920, limit: 2000000, unit: "", label: "Realtime Messages" },
  connections: { used: 7, limit: 200, unit: "", label: "Realtime Connections" },
  mau: { used: 5, limit: 50000, unit: "", label: "MAU" },
};

const LAST_UPDATED = "2026-05-28";

const RETENTION_POLICIES = [
  { table: "rides", content: "جميع الرحلات", retention: "دائم", type: "permanent" as const, icon: Route },
  { table: "drivers", content: "بيانات السائقين", retention: "دائم", type: "permanent" as const, icon: Car },
  { table: "profiles / auth.users", content: "حسابات المستخدمين", retention: "دائم", type: "permanent" as const, icon: Users },
  { table: "wallet_transactions", content: "معاملات المحفظة", retention: "دائم", type: "permanent" as const, icon: Shield },
  { table: "company_earnings", content: "أرباح الشركة", retention: "دائم", type: "permanent" as const, icon: TrendingUp },
  { table: "ride_tracking_points", content: "نقاط تتبع الرحلات", retention: "دائم", type: "permanent" as const, icon: Activity },
  { table: "rider_notifications", content: "إشعارات الركاب", retention: "دائم", type: "permanent" as const, icon: Zap },
  { table: "driver_notifications", content: "إشعارات السائقين", retention: "دائم", type: "permanent" as const, icon: Zap },
  { table: "net._http_response", content: "ردود HTTP الداخلية", retention: "3 أيام", type: "temporary" as const, icon: Server },
  { table: "cron.job_run_details", content: "نتائج تشغيل cron", retention: "7 أيام", type: "temporary" as const, icon: Timer },
  { table: "analytics_events", content: "أحداث بوت واتساب", retention: "30 يوم", type: "temporary" as const, icon: Activity },
  { table: "notifications_log", content: "سجل إرسال الإشعارات", retention: "60 يوم", type: "temporary" as const, icon: Zap },
  { table: "bot_conversation_messages", content: "محادثات البوت", retention: "90 يوم", type: "temporary" as const, icon: Car },
  { table: "admin_audit_logs", content: "سجلات تدقيق أمنية", retention: "365 يوم", type: "temporary" as const, icon: Shield },
];

const CAPACITY_SCENARIOS = [
  {
    id: "startup",
    title: "بداية صغيرة",
    color: "from-emerald-500/20 to-emerald-600/10",
    border: "border-emerald-500/30",
    badge: "bg-emerald-500/20 text-emerald-400",
    icon: "🟢",
    ridesPerDay: "5-15",
    ridesPerMonth: "150-450",
    concurrent: "1-3",
    drivers: "5-10",
    riders: "10-30",
    edgePct: 1.7,
    realtimePct: 3.5,
    egressPct: 6,
    dbLifetime: "~10 سنوات",
  },
  {
    id: "growth",
    title: "نمو معتدل",
    color: "from-blue-500/20 to-blue-600/10",
    border: "border-blue-500/30",
    badge: "bg-blue-500/20 text-blue-400",
    icon: "🔵",
    ridesPerDay: "50-100",
    ridesPerMonth: "1,500-3,000",
    concurrent: "5-10",
    drivers: "20-30",
    riders: "100-200",
    edgePct: 8.7,
    realtimePct: 10,
    egressPct: 26,
    dbLifetime: "~16 شهر",
  },
  {
    id: "max-free",
    title: "الحد الأقصى المجاني",
    color: "from-amber-500/20 to-amber-600/10",
    border: "border-amber-500/30",
    badge: "bg-amber-500/20 text-amber-400",
    icon: "🟡",
    ridesPerDay: "200-300",
    ridesPerMonth: "6,000-9,000",
    concurrent: "15-25",
    drivers: "50",
    riders: "300-500",
    edgePct: 27.6,
    realtimePct: 27,
    egressPct: 60,
    dbLifetime: "~5 أشهر",
  },
  {
    id: "absolute",
    title: "الحد المطلق",
    color: "from-red-500/20 to-red-600/10",
    border: "border-red-500/30",
    badge: "bg-red-500/20 text-red-400",
    icon: "🔴",
    ridesPerDay: "400-430",
    ridesPerMonth: "~13,000",
    concurrent: "30-40",
    drivers: "80",
    riders: "500-800",
    edgePct: 47,
    realtimePct: 45,
    egressPct: 100,
    dbLifetime: "~3 أشهر",
  },
];

const OPTIMIZATIONS = [
  { date: "2026-05-28", title: "REPLICA IDENTITY DEFAULT", desc: "rides, admin_notifications, dual_stop_alerts — تقليل WAL ~30-40%", status: "done" as const },
  { date: "2026-05-28", title: "إزالة push_subscriptions من Realtime", desc: "إيقاف WAL + broadcast بلا مستقبل", status: "done" as const },
  { date: "2026-05-28", title: "TRUNCATE net._http_response", desc: "حذف 197 MB (47% من الـ DB)", status: "done" as const },
  { date: "2026-05-28", title: "TRUNCATE cron.job_run_details", desc: "حذف 141 MB (33% من الـ DB)", status: "done" as const },
  { date: "2026-05-28", title: "6 Cron Cleanup Jobs", desc: "تنظيف تلقائي لـ 6 جداول — يمنع التراكم مستقبلاً", status: "done" as const },
  { date: "2026-05-28", title: "إزالة drivers من Realtime", desc: "migration سابق — تقليل WAL للسائقين", status: "done" as const },
];

// ═══════════════════════════════════════════════════
// مكونات فرعية
// ═══════════════════════════════════════════════════

function ResourceGauge({ icon: Icon, label, used, limit, unit, color }: {
  icon: React.ElementType;
  label: string;
  used: number;
  limit: number;
  unit: string;
  color: string;
}) {
  const pct = Math.min((used / limit) * 100, 100);
  const statusColor = pct < 30 ? "text-emerald-400" : pct < 70 ? "text-amber-400" : "text-red-400";
  const barColor = pct < 30 ? "bg-emerald-500" : pct < 70 ? "bg-amber-500" : "bg-red-500";
  const bgGlow = pct < 30 ? "from-emerald-500/10" : pct < 70 ? "from-amber-500/10" : "from-red-500/10";

  const formatNum = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toFixed(n < 10 ? 3 : 0);
  };

  return (
    <Card className={`bg-gradient-to-br ${bgGlow} to-transparent border-border/50 overflow-hidden relative`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
            <Icon className="w-5 h-5" />
          </div>
          <span className={`text-2xl font-bold tabular-nums ${statusColor}`}>
            {pct.toFixed(1)}%
          </span>
        </div>
        <p className="text-sm font-medium text-foreground mb-1">{label}</p>
        <p className="text-xs text-muted-foreground mb-3">
          {formatNum(used)}{unit} / {formatNum(limit)}{unit}
        </p>
        <div className="w-full h-2 bg-muted/50 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} rounded-full transition-all duration-1000 ease-out`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function MiniBar({ pct, className = "" }: { pct: number; className?: string }) {
  const color = pct < 30 ? "bg-emerald-500" : pct < 70 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground w-8 text-left">
        {pct}%
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// الصفحة الرئيسية
// ═══════════════════════════════════════════════════

const AdminSystemCapacity = () => {
  const navigate = useNavigate();
  const { user, loading, isAdmin } = useAdminAuth();

  // جلب أحجام الجداول الحية من DB
  const { data: tableSizes = [], isLoading: sizesLoading } = useQuery({
    queryKey: ["admin-table-sizes"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_table_sizes") as any;
      if (error) {
        // Fallback: if RPC doesn't exist, return empty
        console.warn("get_table_sizes RPC not found:", error.message);
        return [];
      }
      return (data || []).map((row: any) => ({
        name: (row.table_name as string).replace("public.", "").replace("net.", "net.").replace("cron.", "cron."),
        totalSize: row.total_size as string,
        sizeBytes: Number(row.size_bytes),
        sizeMB: Number(row.size_bytes) / (1024 * 1024),
      }));
    },
    enabled: isAdmin,
    staleTime: 60000,
  });

  // جلب حالة cron jobs
  const { data: cronJobs = [], isLoading: cronLoading } = useQuery({
    queryKey: ["admin-cron-status"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cron_job_status") as any;
      if (error) {
        console.warn("get_cron_job_status RPC not found:", error.message);
        return [];
      }
      return (data || []).map((row: any) => ({
        name: row.job_name as string,
        schedule: row.schedule as string,
        lastRun: row.last_run ? new Date(row.last_run as string) : null,
        status: row.last_status as string,
      }));
    },
    enabled: isAdmin,
    staleTime: 60000,
  });

  const chartData = tableSizes.slice(0, 12).map((t: any) => ({
    name: t.name.length > 20 ? t.name.slice(0, 18) + "…" : t.name,
    fullName: t.name,
    size: parseFloat(t.sizeMB.toFixed(2)),
    label: t.totalSize,
  }));

  const CHART_COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary flex items-center justify-center mb-4 animate-pulse">
            <Server className="w-10 h-10 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return (
    <AdminLayout
      title="قدرة النظام"
      subtitle={`تحليل القدرة الاستيعابية — الخطة المجانية • آخر تحديث: ${LAST_UPDATED}`}
    >
      {/* ═══ القسم 1: بطاقات الموارد ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <ResourceGauge icon={Database} {...FREE_TIER_LIMITS.dbSize} color="bg-violet-500/20 text-violet-400" />
        <ResourceGauge icon={Zap} {...FREE_TIER_LIMITS.edgeFunctions} color="bg-amber-500/20 text-amber-400" />
        <ResourceGauge icon={ArrowUpDown} {...FREE_TIER_LIMITS.egress} color="bg-blue-500/20 text-blue-400" />
        <ResourceGauge icon={Radio} {...FREE_TIER_LIMITS.realtime} color="bg-emerald-500/20 text-emerald-400" />
        <ResourceGauge icon={Activity} {...FREE_TIER_LIMITS.connections} color="bg-pink-500/20 text-pink-400" />
        <ResourceGauge icon={Users} {...FREE_TIER_LIMITS.mau} color="bg-cyan-500/20 text-cyan-400" />
      </div>

      {/* ═══ القسم 2: الحدود القصوى (ملخص سريع) ═══ */}
      <Card className="mb-8 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 text-center">
            {[
              { label: "رحلات/ساعة", comfort: "15-25", max: "60-80" },
              { label: "رحلات/يوم", comfort: "50-100", max: "300-430" },
              { label: "رحلات/شهر", comfort: "1.5K-3K", max: "~13K" },
              { label: "متزامنة", comfort: "5-10", max: "30-40" },
              { label: "سائقين أونلاين", comfort: "20-30", max: "~80" },
              { label: "ركاب/يوم", comfort: "100-200", max: "~500" },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                <p className="text-lg font-bold text-foreground">{item.comfort}</p>
                <p className="text-[10px] text-muted-foreground">أقصى: {item.max}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* ═══ القسم 3: أحجام الجداول (حية) ═══ */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              أحجام الجداول
              {sizesLoading && <span className="text-xs text-muted-foreground animate-pulse">جاري التحميل...</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <XAxis type="number" className="text-xs" tickFormatter={(v) => `${v} MB`} />
                    <YAxis type="category" dataKey="name" width={140} className="text-xs" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number, _: string, props: any) => [
                        props.payload.label,
                        props.payload.fullName,
                      ]}
                    />
                    <Bar dataKey="size" radius={[0, 4, 4, 0]}>
                      {chartData.map((_: any, index: number) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">يتطلب RPC function: get_table_sizes</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ═══ القسم 4: فترات الاحتفاظ ═══ */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              فترات احتفاظ البيانات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto custom-scrollbar">
              {RETENTION_POLICIES.map((policy) => {
                const Icon = policy.icon;
                return (
                  <div
                    key={policy.table}
                    className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                      policy.type === "permanent"
                        ? "bg-emerald-500/5 hover:bg-emerald-500/10"
                        : "bg-amber-500/5 hover:bg-amber-500/10"
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                      policy.type === "permanent" ? "bg-emerald-500/20" : "bg-amber-500/20"
                    }`}>
                      {policy.type === "permanent" ? (
                        <Infinity className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{policy.table}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{policy.content}</p>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                      policy.type === "permanent"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}>
                      {policy.retention}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ القسم 5: سيناريوهات السعة ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {CAPACITY_SCENARIOS.map((s) => (
          <Card key={s.id} className={`bg-gradient-to-br ${s.color} ${s.border} overflow-hidden`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl">{s.icon}</span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${s.badge}`}>
                  {s.title}
                </span>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Route className="w-3 h-3" /> رحلات/يوم
                  </span>
                  <span className="font-bold text-foreground">{s.ridesPerDay}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Car className="w-3 h-3" /> سائقين
                  </span>
                  <span className="font-bold text-foreground">{s.drivers}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" /> ركاب/يوم
                  </span>
                  <span className="font-bold text-foreground">{s.riders}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Activity className="w-3 h-3" /> متزامنة
                  </span>
                  <span className="font-bold text-foreground">{s.concurrent}</span>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-border/30">
                <div>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-muted-foreground">Edge Functions</span>
                    <span>{s.edgePct}%</span>
                  </div>
                  <MiniBar pct={s.edgePct} />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-muted-foreground">Egress</span>
                    <span>{s.egressPct}%</span>
                  </div>
                  <MiniBar pct={s.egressPct} />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-muted-foreground">Realtime</span>
                    <span>{s.realtimePct}%</span>
                  </div>
                  <MiniBar pct={s.realtimePct} />
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground mt-3 text-center">
                عمر DB: {s.dbLifetime}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* ═══ القسم 6: Cron Jobs (حية) ═══ */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Timer className="w-4 h-4" />
              مهام التنظيف التلقائي
              {cronLoading && <span className="text-xs text-muted-foreground animate-pulse">جاري التحميل...</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cronJobs.length > 0 ? (
              <div className="space-y-2">
                {cronJobs.map((job: any) => (
                  <div key={job.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      job.status === "succeeded" ? "bg-emerald-500" : job.status === "failed" ? "bg-red-500" : "bg-muted-foreground"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{job.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {job.schedule} • {job.lastRun
                          ? `آخر تشغيل: ${job.lastRun.toLocaleDateString("ar-IQ")} ${job.lastRun.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })}`
                          : "لم يعمل بعد"}
                      </p>
                    </div>
                    {job.status === "succeeded" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    ) : job.status === "failed" ? (
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Timer className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">يتطلب RPC function: get_cron_job_status</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ القسم 7: التحسينات المطبقة ═══ */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              التحسينات المطبقة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute right-[11px] top-4 bottom-4 w-0.5 bg-emerald-500/30" />

              <div className="space-y-3">
                {OPTIMIZATIONS.map((opt, i) => (
                  <div key={i} className="flex gap-3 relative">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center flex-shrink-0 z-10">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-medium text-foreground">{opt.title}</p>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">✓ مطبّق</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                      <p className="text-[9px] text-muted-foreground/60 mt-0.5">{opt.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ القسم 8: متى تنتقل لـ Pro ═══ */}
      <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            متى تحتاج الترقية لـ Pro ($25/شهر)؟
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { trigger: "DB Size > 350 MB", action: "خطط للترقية", color: "text-amber-400", icon: Database },
              { trigger: "Egress > 3.5 GB", action: "راقب يومياً", color: "text-amber-400", icon: ArrowUpDown },
              { trigger: "50+ سائق أونلاين", action: "Egress سيقفز", color: "text-orange-400", icon: Car },
              { trigger: "300+ رحلة/يوم مستمر", action: "ارتقِ فوراً", color: "text-red-400", icon: Route },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.trigger} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <Icon className={`w-5 h-5 ${item.color} flex-shrink-0 mt-0.5`} />
                  <div>
                    <p className="text-xs font-medium text-foreground">{item.trigger}</p>
                    <p className="text-[10px] text-muted-foreground">{item.action}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default AdminSystemCapacity;
