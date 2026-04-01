import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Gift, Trophy, Target, Clock, CheckCircle2, Star, Zap, Loader2 } from "lucide-react";
import DriverPageHeader from "@/components/driver/DriverPageHeader";
import SplashScreen from "@/components/common/SplashScreen";
import { useDriverSession } from "@/hooks/useDriverSession";

interface IncentiveProgress {
  incentive_id: string;
  name: string;
  description: string | null;
  period: string;
  rides_required: number;
  bonus_amount: number;
  rides_completed: number;
  is_claimed: boolean;
  period_start: string;
  period_end: string;
}

const DriverIncentives = () => {
  const { driver, loading: authLoading } = useDriverSession();
  const [loading, setLoading] = useState(true);
  const [incentives, setIncentives] = useState<IncentiveProgress[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // إزالة driver-mode لتفعيل السكرول
  useEffect(() => {
    const had = document.body.classList.contains('driver-mode');
    document.body.classList.remove('driver-mode');
    document.body.style.overflow = 'auto';
    document.body.style.position = 'static';
    return () => {
      if (had) document.body.classList.add('driver-mode');
      document.body.style.overflow = '';
      document.body.style.position = '';
    };
  }, []);

  const fetchIncentives = useCallback(async () => {
    if (!driver) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      const [progressRes, claimsRes] = await Promise.all([
        supabase.rpc("get_driver_incentive_progress", { p_driver_id: driver.driverId }),
        supabase.from("driver_incentive_claims").select("bonus_earned").eq("driver_id" as any, driver.driverId),
      ]);
      if (progressRes.data) setIncentives(progressRes.data as any);
      const total = ((claimsRes.data ?? []) as any[]).reduce((s: number, c: any) => s + (c.bonus_earned ?? 0), 0);
      setTotalEarned(total);
    } catch (err) {
      console.error("[DriverIncentives]", err);
    } finally {
      setLoading(false);
    }
  }, [driver]);

  useEffect(() => {
    if (driver) fetchIncentives();
    return () => { abortRef.current?.abort(); };
  }, [driver, fetchIncentives]);

  const periodConfig: Record<string, { label: string; icon: React.ReactNode; color: string; glow: string }> = {
    daily:   { label: "يومي",    icon: <Clock className="w-4 h-4" />,  color: "text-blue-400",   glow: "bg-blue-500/10 border-blue-500/20" },
    weekly:  { label: "أسبوعي", icon: <Target className="w-4 h-4" />, color: "text-purple-400", glow: "bg-purple-500/10 border-purple-500/20" },
    monthly: { label: "شهري",   icon: <Trophy className="w-4 h-4" />, color: "text-amber-400",  glow: "bg-amber-500/10 border-amber-500/20" },
  };

  const periodBar: Record<string, string> = {
    daily:   "bg-blue-500",
    weekly:  "bg-purple-500",
    monthly: "bg-amber-500",
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0b1326]" dir="rtl">
        <DriverPageHeader title="المكافآت والحوافز" />
        <div className="pt-20 px-5 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#171f33] rounded-2xl h-32 animate-pulse border border-slate-700/30" />
          ))}
        </div>
      </div>
    );
  }

  const dailyIncentives   = incentives.filter(i => i.period === "daily");
  const weeklyIncentives  = incentives.filter(i => i.period === "weekly");
  const monthlyIncentives = incentives.filter(i => i.period === "monthly");
  const groups = [
    { key: "daily",   list: dailyIncentives,   label: "الحوافز اليومية",   icon: <Clock className="w-5 h-5 text-blue-400" /> },
    { key: "weekly",  list: weeklyIncentives,  label: "الحوافز الأسبوعية", icon: <Target className="w-5 h-5 text-purple-400" /> },
    { key: "monthly", list: monthlyIncentives, label: "الحوافز الشهرية",   icon: <Trophy className="w-5 h-5 text-amber-400" /> },
  ];

  return (
    <div className="min-h-screen bg-[#0b1326] pb-8 overflow-y-auto" dir="rtl">
      <DriverPageHeader title="المكافآت والحوافز" />

      {/* خلفية ديكورية */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-amber-500/5 blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-[#5bdda6]/3 blur-[100px]" />
      </div>

      <div className="relative z-10 pt-[calc(3.5rem+env(safe-area-inset-top)+1rem)] px-5 space-y-4">
        <div className="max-w-lg mx-auto space-y-4">

          {/* Hero Card — إجمالي المكافآت */}
          <div className="bg-[#171f33] rounded-2xl border border-slate-700/30 overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="h-1 bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.15)] flex-shrink-0">
                  <Trophy className="w-7 h-7 text-amber-400" />
                </div>
                <div className="text-right">
                  <p className="text-slate-500 text-xs font-medium mb-1">إجمالي المكافآت المكتسبة</p>
                  <div className="flex items-baseline gap-1.5 justify-end">
                    <p className="text-4xl font-black text-white tracking-tight tabular-nums">
                      {totalEarned.toLocaleString()}
                    </p>
                    <p className="text-amber-400 text-sm font-semibold">د.ع</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* مجموعات الحوافز */}
          {groups.map(group => group.list.length > 0 && (
            <div key={group.key} className="space-y-3">
              {/* عنوان القسم */}
              <div className="flex items-center gap-2.5">
                {group.icon}
                <h2 className="font-bold text-white text-sm">{group.label}</h2>
                <div className="flex-1 h-px bg-slate-700/50" />
              </div>

              {/* كاردات الحوافز */}
              {group.list.map(incentive => {
                const progress = Math.min((incentive.rides_completed / incentive.rides_required) * 100, 100);
                const remaining = Math.max(incentive.rides_required - incentive.rides_completed, 0);
                const cfg = periodConfig[incentive.period] || periodConfig.daily;
                const bar = periodBar[incentive.period] || "bg-[#5bdda6]";

                return (
                  <div
                    key={incentive.incentive_id}
                    className={`bg-[#171f33] rounded-2xl border p-5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] ${
                      incentive.is_claimed ? "border-emerald-500/30" : "border-slate-700/30"
                    }`}
                  >
                    {/* رأس الكارد */}
                    <div className="flex items-start justify-between mb-4">
                      {/* القيمة + الوحدة */}
                      <div className="text-left">
                        <span className="text-xl font-black text-white tabular-nums">{incentive.bonus_amount.toLocaleString()}</span>
                        <span className="text-slate-500 text-xs font-medium mr-1">د.ع</span>
                      </div>

                      {/* الاسم + الشارة */}
                      <div className="text-right flex-1 mr-3">
                        <div className="flex items-center gap-2 justify-end mb-1">
                          {incentive.is_claimed && (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                              ✓ تم الحصول عليها
                            </span>
                          )}
                          <h3 className="font-bold text-white text-sm">{incentive.name}</h3>
                        </div>
                        {incentive.description && (
                          <p className="text-xs text-slate-500">{incentive.description}</p>
                        )}
                      </div>

                      {/* أيقونة النوع */}
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${cfg.glow}`}>
                        <span className={cfg.color}>{cfg.icon}</span>
                      </div>
                    </div>

                    {/* شريط التقدم */}
                    {!incentive.is_claimed && (
                      <>
                        <div className="h-2 bg-[#0b1326] rounded-full overflow-hidden border border-slate-800/50 mb-2">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${bar}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          {remaining > 0 ? (
                            <span className="text-slate-500">متبقي <span className="text-white font-bold">{remaining}</span> رحلات</span>
                          ) : (
                            <span className="text-[#5bdda6] font-bold flex items-center gap-1">
                              <Star className="w-3.5 h-3.5" /> مكتمل!
                            </span>
                          )}
                          <span className="text-slate-500 tabular-nums">
                            {incentive.rides_completed} / {incentive.rides_required} رحلة
                          </span>
                        </div>
                      </>
                    )}

                    {/* حالة مكتمل */}
                    {incentive.is_claimed && (
                      <div className="flex items-center gap-2 text-emerald-400 text-xs">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <span>تمت إضافة المكافأة لمحفظتك</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* حالة فراغ */}
          {incentives.length === 0 && (
            <div className="bg-[#171f33] rounded-2xl border border-slate-700/30 p-10 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#0b1326] border border-slate-700/50 flex items-center justify-center mx-auto mb-4">
                <Gift className="w-8 h-8 text-slate-600" />
              </div>
              <p className="text-slate-500 font-medium text-sm">لا توجد حوافز متاحة حالياً</p>
              <p className="text-slate-600 text-xs mt-1">تابع التحديثات لعروض جديدة</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default DriverIncentives;
