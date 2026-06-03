import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Star, Loader2, Send, Sparkles, CheckCircle,
  Wallet, Route, Clock, Zap, TrendingDown, TrendingUp, Percent,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";


/* ──────────────────────── Types ──────────────────────── */
interface DriverRideCompletedProps {
  ride: {
    id: string;
    final_fare: number;
    distance_km: number | null;
    duration_minutes: number | null;
    rider_id: string;
    metadata?: Record<string, unknown> | null;
  };
  riderName: string;
  onClose: () => void;
}

const RIDER_BADGES = [
  { id: "ready",    emoji: "⏱️", label: "جاهز عند الوصول" },
  { id: "respect",  emoji: "🤝", label: "تعامل محترم"      },
  { id: "location", emoji: "📍", label: "موقع دقيق"        },
  { id: "quiet",    emoji: "🤫", label: "هادئ ومؤدب"       },
  { id: "clean",    emoji: "✨", label: "محافظ على النظافة" },
];

const RATING_CONFIG = {
  5: { text: "راكب ممتاز!",    emoji: "🌟", color: "text-emerald-400" },
  4: { text: "جيد جداً",        emoji: "👍", color: "text-green-400"   },
  3: { text: "متوسط",           emoji: "😐", color: "text-amber-400"  },
  2: { text: "يحتاج تحسين",    emoji: "😕", color: "text-orange-400" },
  1: { text: "سيء",             emoji: "😞", color: "text-red-400"    },
};

/* ──────────────────────── Component ──────────────────────── */
export const DriverRideCompleted = ({ ride, riderName, onClose }: DriverRideCompletedProps) => {
  const { toast } = useToast();
  const [rating, setRating]   = useState(5);
  const [hovered, setHovered] = useState(0);
  const [badges, setBadges]   = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const display = hovered || rating;
  const cfg     = RATING_CONFIG[display as keyof typeof RATING_CONFIG];
  const riderInitials = riderName?.slice(0, 2) || "ر";

  // بيانات الإيصال المالي
  const receipt = (ride.metadata as Record<string, unknown>)?.receipt as {
    monetization_mode?: string;
    commission_rate_percent?: number;
    commission_amount?: number;
    driver_earning?: number;
    tier_discount?: number;
    tier_name?: string;
    subscription_discount?: number;
    subscription_name?: string;
    payment_method?: string;
    daily_fee_charged?: boolean;
    daily_fee_amount?: number;
    daily_fee_reason?: string;
  } | undefined;

  const hasReceipt = !!receipt;
  const isDailySub = receipt?.monetization_mode === "daily_subscription";
  const netEarning = receipt?.driver_earning ?? ride.final_fare;
  const commissionAmount = receipt?.commission_amount ?? 0;

  /* صوت تنبيه + confetti */
  useEffect(() => {
    try {
      const audio = new Audio(
        "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQEcR6zg5N95ER9TsuHf1XQLAFe34NzWcxAAXLvg2tRwDwBgu+DZ1HAQAFu74NnUbxAAXLvg2dRwEABbu+Da1HAP"
      );
      audio.volume = 0.35;
      audio.play().catch(() => {});
    } catch { /* ignore */ }


  }, []);

  const toggleBadge = (id: string) => {
    try { navigator.vibrate?.(20); } catch { /* ignore */ }
    setBadges(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      /* 1️⃣ تحديث تقييم الراكب في الرحلة — الأهم */
      const { error: rideErr } = await supabase
        .from("rides")
        .update({ rider_rating: rating })
        .eq("id", ride.id);

      if (rideErr) {
        console.warn("[DriverRating] rides.update error:", rideErr.message);
      }

      /* 2️⃣ إدراج ride_ratings — اختياري، لا يمنع الإتمام */
      try {
        const { data: authData } = await supabase.auth.getUser();
        const { data: driver } = await supabase
          .from("drivers")
          .select("id")
          .eq("user_id", authData?.user?.id)
          .maybeSingle();

        const { data: riderProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", ride.rider_id)
          .maybeSingle();

        await supabase.from("ride_ratings").insert({
          ride_id: ride.id,
          rating,
          comment: badges.length > 0 ? `[بادجات: ${badges.join(",")}]` : null,
          driver_id: driver?.id ?? null,
          rider_id: riderProfile?.id ?? null,
        });
      } catch (innerErr) {
        console.warn("[DriverRating] ride_ratings insert skipped:", innerErr);
      }

      /* 3️⃣ ملاحظة: متوسط تقييم الراكب يُحسب عند الحاجة من rides.rider_rating
         لأن جدول profiles لا يحتوي على عمود rider_rating حالياً */



      setSubmitted(true);
      toast({ title: "شكراً لتقييمك! ⭐", description: "تم الحفظ بنجاح" });
      setTimeout(() => onClose(), 2000);

    } catch (error: unknown) {
      console.error("[DriverRating] handleSubmit error:", error);
      toast({
        title: "خطأ في الإرسال",
        description: error instanceof Error ? error.message : "حدث خطأ، حاول مجدداً",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /* ─── شاشة النجاح (Dark Luxury) ─── */
  if (submitted) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-[#0b1326] flex flex-col items-center justify-center" dir="rtl">
        <div className="absolute inset-0 bg-gradient-to-b from-[#5bdda6]/10 to-[#0b1326] pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 180 }}
          className="relative flex flex-col items-center gap-5 px-8 text-center"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#5bdda6] to-[#3eba89] flex items-center justify-center shadow-[0_0_60px_rgba(91,221,166,0.3)] border border-[#5bdda6]/30">
            <Sparkles className="w-12 h-12 text-[#0b1326]" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white mb-2 tracking-tight" style={{ fontFamily: "Cairo, sans-serif" }}>أحسنت الكابتن! 💪</h2>
            <p className="text-[#5bdda6]/70 text-sm font-medium">أرباحك تتراكم — استمر بالعمل الرائع</p>
          </div>
          <div className="flex gap-1.5 mt-2">
            {[1,2,3,4,5].map(s => (
              <Star key={s} className={`w-8 h-8 ${s <= rating ? "text-[#5bdda6] fill-[#5bdda6] drop-shadow-[0_0_8px_rgba(91,221,166,0.5)]" : "text-slate-700/50"}`} />
            ))}
          </div>
        </motion.div>
      </div>,
      document.body
    );
  }

  /* ─── الشاشة الرئيسية (Dark Luxury) ─── */
  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 28 }}
      className="fixed inset-0 z-[9999] bg-[#0b1326] flex flex-col overflow-hidden min-h-dvh font-sans"
      dir="rtl"
    >
      {/* خلفية */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-[#5bdda6]/5 to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#5bdda6]/10 rounded-full blur-[80px]" />
      </div>

      {/* ═══ هيدر ═══ */}
      <div className="relative shrink-0 pt-[calc(env(safe-area-inset-top)+2rem)] pb-3 px-5 text-center">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h1 className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: "Cairo, sans-serif" }}>الحمد لله على السلامة!</h1>
        </motion.div>
      </div>

      {/* ═══ كارد الأرباح (Bento Style) ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="relative shrink-0 mx-5 mb-5"
      >
        <div className="bg-[#171f33] rounded-3xl border border-slate-700/30 overflow-hidden shadow-xl shadow-black/20">
          {/* الأرباح */}
          <div className="px-5 pt-6 pb-4 text-center border-b border-slate-700/30 relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#5bdda6]/40 to-transparent" />
            <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
              {hasReceipt ? "صافي ربحك من الرحلة" : "أرباح هذه الرحلة"}
            </p>
            <div className="flex items-center justify-center gap-1.5" style={{ fontFamily: "Cairo, sans-serif" }}>
              <Wallet className="w-6 h-6 text-[#5bdda6] mb-1" />
              <span className="text-4xl font-black text-white tabular-nums tracking-tighter">
                {netEarning.toLocaleString('en-US')}
              </span>
              <span className="text-base font-bold text-[#5bdda6]/80 self-end mb-1">د.ع</span>
            </div>

            {/* تفصيل مالي */}
            {hasReceipt && isDailySub ? (
              /* ═══ وضع الاشتراك اليومي — لا عمولة ═══ */
              <div className="mt-3 pt-3 border-t border-slate-700/20 space-y-1.5">
                <div className="flex justify-between text-[11px] px-1">
                  <span className="text-[#5bdda6] flex items-center gap-1 font-bold">
                    <TrendingUp className="w-3 h-3" />
                    بدون عمولة — الأجرة لك كاملةً ✓
                  </span>
                </div>
                {receipt?.daily_fee_charged && (receipt?.daily_fee_amount || 0) > 0 && (
                  <div className="flex justify-between text-[10px] px-1 pt-1.5 border-t border-slate-700/15">
                    <span className="text-amber-400/70 flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      اشتراك يومي (أول رحلة اليوم)
                    </span>
                    <span className="text-amber-400/80 font-bold">-{(receipt.daily_fee_amount || 0).toLocaleString('en-US')} د.ع</span>
                  </div>
                )}
                {receipt?.daily_fee_reason === "already_charged_today" && (
                  <div className="flex justify-between text-[10px] px-1">
                    <span className="text-slate-500 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      الاشتراك مدفوع — رحلات اليوم المتبقية مجانية
                    </span>
                  </div>
                )}
                {receipt?.daily_fee_reason === "free_period" && (
                  <div className="flex justify-between text-[10px] px-1">
                    <span className="text-green-400/70 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      فترة مجانية — أهلاً بك في ران!
                    </span>
                  </div>
                )}
              </div>
            ) : hasReceipt && commissionAmount > 0 ? (
              /* ═══ وضع العمولة الكلاسيكي ═══ */
              <div className="mt-3 pt-3 border-t border-slate-700/20 space-y-1.5">
                <div className="flex justify-between text-[11px] px-1">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Wallet className="w-3 h-3" />
                    أجرة الرحلة
                  </span>
                  <span className="text-slate-300 font-bold">{ride.final_fare.toLocaleString('en-US')} د.ع</span>
                </div>
                <div className="flex justify-between text-[11px] px-1">
                  <span className="text-red-400/70 flex items-center gap-1">
                    <Percent className="w-3 h-3" />
                    عمولة ({receipt?.commission_rate_percent || 0}%)
                  </span>
                  <span className="text-red-400/80 font-bold">-{commissionAmount.toLocaleString('en-US')} د.ع</span>
                </div>

                {/* خصومات مُطبّقة */}
                {(receipt?.tier_discount || 0) > 0 && (
                  <div className="flex justify-between text-[10px] px-1">
                    <span className="text-green-400/70 flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" />
                      خصم {receipt?.tier_name} (-{receipt?.tier_discount}%)
                    </span>
                    <span className="text-green-400/70">مُطبّق ✓</span>
                  </div>
                )}
                {(receipt?.subscription_discount || 0) > 0 && (
                  <div className="flex justify-between text-[10px] px-1">
                    <span className="text-green-400/70 flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" />
                      خصم {receipt?.subscription_name} (-{receipt?.subscription_discount}%)
                    </span>
                    <span className="text-green-400/70">مُطبّق ✓</span>
                  </div>
                )}

                <div className="flex justify-between text-[12px] px-1 pt-2 border-t border-slate-700/20">
                  <span className="text-[#5bdda6] font-bold flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    صافي ربحك
                  </span>
                  <span className="text-[#5bdda6] font-black text-[14px]">{netEarning.toLocaleString('en-US')} د.ع</span>
                </div>
              </div>
            ) : null}
          </div>
          {/* الإحصائيات */}
          <div className="flex items-center divide-x divide-x-reverse divide-slate-700/30 bg-slate-900/20">
            <div className="flex-1 flex flex-col items-center justify-center py-3">
              <Route className="w-4 h-4 text-slate-400 mb-1" />
              <span className="text-sm font-bold text-slate-200 tabular-nums" style={{ fontFamily: "Cairo, sans-serif" }}>{(ride.distance_km || 0).toFixed(1)} كم</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center py-3">
              <Clock className="w-4 h-4 text-slate-400 mb-1" />
              <span className="text-sm font-bold text-slate-200 tabular-nums" style={{ fontFamily: "Cairo, sans-serif" }}>{ride.duration_minutes || 0} د</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══ قسم التقييم ═══ */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.55 }}
        className="flex-1 min-h-0 flex flex-col bg-[#171f33]/30 mx-5 rounded-3xl border border-slate-700/30 mb-4 overflow-hidden"
      >
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-4 gap-3">

          {/* أفاتار الراكب و النجوم */}
          <div className="flex flex-col items-center gap-2">

            <p className="text-sm font-bold text-slate-300">كيف كانت تجربتك مع الراكب؟</p>
          </div>

          {/* النجوم */}
          <div className="flex gap-1.5" style={{ direction: "ltr" }}>
            {[1, 2, 3, 4, 5].map((star) => {
              const isActive = star <= display;
              return (
                <motion.button
                  key={star}
                  type="button"
                  whileTap={{ scale: 0.8 }}
                  onClick={() => { setRating(star); try { navigator.vibrate?.(30); } catch { /* ok */ } }}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  className="relative focus:outline-none p-1 shrink-0"
                >
                  <Star className={`w-10 h-10 transition-colors duration-200 ${isActive ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]" : "text-slate-700"}`} />
                </motion.button>
              );
            })}
          </div>

          {/* رسالة التقييم */}
          <div className="h-8 flex items-center justify-center shrink-0">
            <AnimatePresence mode="sync">
              <motion.div
                key={display}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-1.5 bg-[#171f33] border border-slate-700/50 rounded-full px-4 py-1.5 shadow-sm"
              >
                <span className="text-lg">{cfg.emoji}</span>
                <span className={`text-sm font-bold ${cfg.color}`}>{cfg.text}</span>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── البادجات السريعة ── */}
          <div className="w-full shrink-0 overflow-y-auto scrollbar-hide">
            <div className="flex flex-wrap gap-2 justify-center">
              {RIDER_BADGES.map((badge) => {
                const active = badges.includes(badge.id);
                return (
                  <motion.button
                    key={badge.id}
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => toggleBadge(badge.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-200 ${
                      active
                        ? "bg-[#5bdda6]/15 border-[#5bdda6]/40 text-[#5bdda6] shadow-[0_0_10px_rgba(91,221,166,0.1)]"
                        : "bg-[#0b1326]/50 border-slate-700/50 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <span>{badge.emoji}</span>
                    <span>{badge.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══ الأزرار السفلية الحادة ممتدة للجوانب ═══ */}
      <div className="shrink-0 w-full pointer-events-auto bg-[#171f33] border-t border-white/[0.06] relative z-[10]" style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}>
        <div className="flex items-stretch h-[58px]">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-[100px] h-full flex items-center justify-center text-[13px] font-bold text-slate-300 bg-[#121929] hover:bg-slate-800 transition-all disabled:opacity-50 rounded-none pointer-events-auto touch-manipulation border-l border-white/[0.07] shrink-0"
            style={{ fontFamily: "Cairo, sans-serif" }}
          >
            تخطي
          </button>
          <button
             type="button"
             onClick={handleSubmit}
             disabled={loading}
             style={{ fontFamily: "Cairo, sans-serif" }}
             className="flex-1 h-full flex items-center justify-center gap-2 text-[15px] font-black text-[#0b1326] bg-[#5bdda6] shadow-[0_-4px_20px_rgba(91,221,166,0.2)] hover:bg-[#4bcc98] active:bg-[#3eba89] transition-all disabled:opacity-50 rounded-none pointer-events-auto touch-manipulation border-t border-[#5bdda6]"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <div className="flex items-center gap-1.5">
                <Send className="w-4 h-4" />
                <span>تأكيد التقييم</span>
              </div>
            )}
          </button>
        </div>
      </div>
    </motion.div>,
    document.body
  );
};

export default DriverRideCompleted;
