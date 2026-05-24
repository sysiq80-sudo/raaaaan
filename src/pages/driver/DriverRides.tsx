import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Car, MapPin, Clock, CheckCircle, XCircle, Navigation, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import DriverPageHeader from "@/components/driver/DriverPageHeader";
import SplashScreen from "@/components/common/SplashScreen";
import { useDriverSession } from "@/hooks/useDriverSession";

interface Ride {
  id: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  status: string | null;
  final_fare: number | null;
  estimated_fare: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  created_at: string;
  completed_at: string | null;
  payment_method: string | null;
}

// ── كاش الرحلات في الذاكرة ──
let _ridesCache: Ride[] | null = null;
let _ridesCacheKey = "";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:     { label: "قيد الانتظار", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  accepted:    { label: "مقبولة",       color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  arrived:     { label: "وصلت",         color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  in_progress: { label: "جارية",        color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  completed:   { label: "مكتملة",       color: "bg-[#5bdda6]/20 text-[#5bdda6] border-[#5bdda6]/30" },
  cancelled:   { label: "ملغاة",        color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقدي", nas_wallet: "المحفظة", nass: "البطاقة",
  wallet: "المحفظة", card: "البطاقة", zain_cash: "نقدي",
  asia_hawala: "نقدي", qi_card: "البطاقة",
};

const DriverRides = () => {
  const { driver, loading: authLoading } = useDriverSession();
  const [rides, setRides] = useState<Ride[]>(_ridesCache ?? []);
  const [ridesLoading, setRidesLoading] = useState(!_ridesCache);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "completed" | "cancelled">("all");
  const [pages, setPages] = useState({ all: 1, completed: 1, cancelled: 1 });
  const PAGE_SIZE = 10;
  const abortRef = useRef<AbortController | null>(null);

  // إزالة driver-mode لتفعيل السكرول
  useEffect(() => {
    const had = document.body.classList.contains("driver-mode");
    document.body.classList.remove("driver-mode");
    document.body.style.overflow = "auto";
    document.body.style.position = "static";
    return () => {
      if (had) document.body.classList.add("driver-mode");
      document.body.style.overflow = "";
      document.body.style.position = "";
    };
  }, []);

  const fetchRides = useCallback(async (force = false) => {
    if (!driver) return;
    const cacheKey = driver.driverId;

    // إذا الكاش صالح وليس إعادة تحميل
    if (!force && _ridesCache && _ridesCacheKey === cacheKey) {
      setRides(_ridesCache);
      setRidesLoading(false);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const { data, error } = await supabase
        .from("rides")
        .select("id, pickup_address, dropoff_address, status, final_fare, estimated_fare, distance_km, duration_minutes, created_at, completed_at, payment_method")
        .eq("driver_id", driver.driverId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const result = (data ?? []) as Ride[];
      _ridesCache = result;
      _ridesCacheKey = cacheKey;
      setRides(result);
    } catch (err: any) {
      if (err?.name !== "AbortError") console.error("[DriverRides]", err);
    } finally {
      setRidesLoading(false);
      setRefreshing(false);
    }
  }, [driver]);

  useEffect(() => {
    if (driver) fetchRides();
    return () => { abortRef.current?.abort(); };
  }, [driver, fetchRides]);

  const completedRides  = useMemo(() => rides.filter(r => r.status === "completed"), [rides]);
  const activeRides     = useMemo(() => rides.filter(r => ["pending","accepted","arrived","in_progress"].includes(r.status ?? "")), [rides]);
  const cancelledRides  = useMemo(() => rides.filter(r => r.status === "cancelled"), [rides]);

  // دالة تقسيم الصفحات
  const paginate = (list: Ride[], page: number) =>
    list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = (list: Ride[]) => Math.max(1, Math.ceil(list.length / PAGE_SIZE));

  const resetPages = () => setPages({ all: 1, completed: 1, cancelled: 1 });

  if (authLoading || ridesLoading) return <SplashScreen />;


  return (
    <div className="min-h-screen bg-[#0b1326] overflow-y-auto" dir="rtl">
      <DriverPageHeader title="رحلاتي" />

      {/* خلفية ديكورية */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-[#5bdda6]/4 blur-[120px]" />
      </div>

      <main className="relative z-10 pt-[calc(3.5rem+env(safe-area-inset-top)+1rem)] pb-8 px-5">
        <div className="max-w-lg mx-auto space-y-4">

          {/* بطاقات ملخص */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: CheckCircle, count: completedRides.length,  label: "مكتملة", color: "text-[#5bdda6]", glow: "bg-[#5bdda6]/10 border-[#5bdda6]/20" },
              { icon: Navigation,  count: activeRides.length,     label: "نشطة",   color: "text-blue-400", glow: "bg-blue-500/10 border-blue-500/20" },
              { icon: XCircle,     count: cancelledRides.length,  label: "ملغاة",  color: "text-red-400",  glow: "bg-red-500/10 border-red-500/20" },
            ].map(({ icon: Icon, count, label, color, glow }) => (
              <div key={label} className="bg-[#171f33] rounded-2xl border border-slate-700/30 p-4 text-center shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center mx-auto mb-2 ${glow}`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <p className={`text-xl font-black ${color}`}>{count}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* زر تحديث */}
          <div className="flex justify-end">
            <button
              onClick={() => { setRefreshing(true); resetPages(); fetchRides(true); }}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#5bdda6] transition-colors"
            >
              <Loader2 className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              تحديث
            </button>
          </div>

          {/* تبويبات الرحلات */}
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as typeof activeTab); setPages(p => ({ ...p, [v]: 1 })); }} className="space-y-3">
            <TabsList className="w-full bg-[#171f33] border border-slate-700/30 rounded-2xl p-1">
              <TabsTrigger value="all"       className="flex-1 rounded-xl data-[state=active]:bg-[#5bdda6] data-[state=active]:text-[#0b1326] data-[state=active]:font-bold text-slate-400 text-sm">الكل</TabsTrigger>
              <TabsTrigger value="completed" className="flex-1 rounded-xl data-[state=active]:bg-[#5bdda6] data-[state=active]:text-[#0b1326] data-[state=active]:font-bold text-slate-400 text-sm">مكتملة</TabsTrigger>
              <TabsTrigger value="cancelled" className="flex-1 rounded-xl data-[state=active]:bg-[#5bdda6] data-[state=active]:text-[#0b1326] data-[state=active]:font-bold text-slate-400 text-sm">ملغاة</TabsTrigger>
            </TabsList>

            {([  
              { value: "all",       list: rides,          emptyIcon: Car,          emptyText: "لا توجد رحلات بعد",        pageKey: "all" as const },
              { value: "completed", list: completedRides, emptyIcon: CheckCircle,  emptyText: "لا توجد رحلات مكتملة",    pageKey: "completed" as const },
              { value: "cancelled", list: cancelledRides, emptyIcon: XCircle,      emptyText: "لا توجد رحلات ملغاة",     pageKey: "cancelled" as const },
            ]).map(({ value, list, emptyIcon: EmptyIcon, emptyText, pageKey }) => (
              <TabsContent key={value} value={value} className="space-y-3 mt-0">
                {list.length === 0 ? (
                  <div className="bg-[#171f33] rounded-2xl border border-slate-700/30 p-10 text-center">
                    <EmptyIcon className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                    <p className="text-slate-500 text-sm">{emptyText}</p>
                  </div>
                ) : (
                  <>
                    {paginate(list, pages[pageKey]).map(ride => <RideCard key={ride.id} ride={ride} />)}
                    {/* Pagination */}
                    {totalPages(list) > 1 && (
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <button
                          onClick={() => setPages(p => ({ ...p, [pageKey]: Math.max(1, p[pageKey] - 1) }))}
                          disabled={pages[pageKey] === 1}
                          className="w-9 h-9 rounded-xl bg-[#171f33] border border-slate-700/30 flex items-center justify-center text-slate-400 disabled:opacity-30 hover:border-[#5bdda6]/40 transition-all text-sm"
                        >
                          ›
                        </button>
                        <span className="text-xs text-slate-500 min-w-[60px] text-center">
                          {pages[pageKey]} / {totalPages(list)}
                        </span>
                        <button
                          onClick={() => setPages(p => ({ ...p, [pageKey]: Math.min(totalPages(list), p[pageKey] + 1) }))}
                          disabled={pages[pageKey] === totalPages(list)}
                          className="w-9 h-9 rounded-xl bg-[#171f33] border border-slate-700/30 flex items-center justify-center text-slate-400 disabled:opacity-30 hover:border-[#5bdda6]/40 transition-all text-sm"
                        >
                          ‹
                        </button>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </main>
    </div>
  );
};

/* ── كارد الرحلة ── */
const RideCard = ({ ride }: { ride: Ride }) => {
  const statusCfg = STATUS_LABELS[ride.status ?? "pending"] ?? STATUS_LABELS.pending;
  const payLabel  = PAYMENT_LABELS[ride.payment_method ?? "cash"] ?? "نقدي";
  const fare = (ride.final_fare || ride.estimated_fare || 0).toLocaleString("ar-IQ");

  return (
    <div className="bg-[#171f33] rounded-2xl border border-slate-700/30 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
      <div className="p-4">
        {/* رأس الكارد */}
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
          <span className="text-xs text-slate-500">
            {format(new Date(ride.created_at), "d MMM yyyy - HH:mm", { locale: ar })}
          </span>
        </div>

        {/* المسار */}
        <div className="space-y-2 mb-3 pr-1">
          <div className="flex items-start gap-2.5">
            <div className="w-2 h-2 rounded-full bg-[#5bdda6] mt-1.5 flex-shrink-0" />
            <p className="text-sm text-slate-300 leading-tight">{ride.pickup_address || "نقطة الانطلاق"}</p>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
            <p className="text-sm text-slate-300 leading-tight">{ride.dropoff_address || "الوجهة"}</p>
          </div>
        </div>

        {/* التفاصيل */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-700/30">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {ride.distance_km?.toFixed(1) ?? "0"} كم
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {ride.duration_minutes ?? "0"} د
            </span>
            <span className="text-slate-600">|</span>
            <span>{payLabel}</span>
          </div>
          <span className="font-black text-[#5bdda6] text-sm">{fare} د.ع</span>
        </div>
      </div>
    </div>
  );
};

export default DriverRides;
