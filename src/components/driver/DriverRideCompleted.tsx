import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Star, Loader2, Send, Sparkles, CheckCircle,
  Wallet, Route, Clock, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

/* ──────────────────────── Types ──────────────────────── */
interface DriverRideCompletedProps {
  ride: {
    id: string;
    final_fare: number;
    distance_km: number | null;
    duration_minutes: number | null;
    rider_id: string;
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

  /* صوت تنبيه + confetti */
  useEffect(() => {
    try {
      const audio = new Audio(
        "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQEcR6zg5N95ER9TsuHf1XQLAFe34NzWcxAAXLvg2tRwDwBgu+DZ1HAQAFu74NnUbxAAXLvg2dRwEABbu+Da1HAP"
      );
      audio.volume = 0.35;
      audio.play().catch(() => {});
    } catch { /* ignore */ }

    try {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 }, colors: ["#10b981","#fbbf24","#06b6d4"] });
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

      /* ✅ الاحتفال دائماً */
      try {
        confetti({ particleCount: 100, spread: 90, origin: { y: 0.5 }, colors: ["#10b981","#fbbf24","#06b6d4","#8b5cf6"] });
      } catch { /* ignore */ }

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

  /* ─── شاشة النجاح ─── */
  if (submitted) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center" dir="rtl">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/60 to-slate-950 pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 180 }}
          className="relative flex flex-col items-center gap-5 px-8 text-center"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center shadow-[0_0_60px_rgba(16,185,129,0.5)]">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white mb-1">أحسنت الكابتن! 💪</h2>
            <p className="text-slate-400 text-sm">أرباحك تتراكم — استمر بالعمل الرائع</p>
          </div>
          <div className="flex gap-1">
            {[1,2,3,4,5].map(s => (
              <Star key={s} className={`w-7 h-7 ${s <= rating ? "text-amber-400 fill-amber-400" : "text-slate-700"}`} />
            ))}
          </div>
        </motion.div>
      </div>,
      document.body
    );
  }

  /* ─── الشاشة الرئيسية ─── */
  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 28 }}
      className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col overflow-hidden min-h-dvh"
      dir="rtl"
    >
      {/* خلفية */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/55 via-slate-950/90 to-slate-950" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[280px] bg-emerald-500/7 rounded-full blur-3xl" />
      </div>

      {/* ═══ هيدر ═══ */}
      <div className="relative shrink-0 pt-8 pb-3 px-5 text-center">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.05 }}
          className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.4)] mb-2.5"
        >
          <CheckCircle className="w-7 h-7 text-white" strokeWidth={2.5} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <h1 className="text-base font-black text-white">الحمد لله على السلامة! 🤲</h1>
          <p className="text-slate-400 text-xs mt-0.5">رحلة ناجحة — أحسنت الكابتن!</p>
        </motion.div>
      </div>

      {/* ═══ كارد الأرباح ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="relative shrink-0 mx-4 mb-3"
      >
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-700/40 overflow-hidden">
          {/* الأرباح */}
          <div className="px-4 pt-4 pb-3 text-center border-b border-slate-700/30">
            <p className="text-xs text-slate-500 mb-1">أرباح هذه الرحلة</p>
            <div className="flex items-center justify-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-400" />
              <span className="text-3xl font-black text-emerald-400 tabular-nums tracking-tight">
                +{ride.final_fare.toLocaleString()}
              </span>
              <span className="text-sm font-semibold text-emerald-500/70">د.ع</span>
            </div>
          </div>
          {/* الإحصائيات */}
          <div className="flex items-center divide-x divide-x-reverse divide-slate-700/30">
            <div className="flex-1 flex items-center justify-center gap-1.5 py-3">
              <Route className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-bold text-slate-300">{(ride.distance_km || 0).toFixed(1)} كم</span>
            </div>
            <div className="flex-1 flex items-center justify-center gap-1.5 py-3">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-slate-300">{ride.duration_minutes || 0} دقيقة</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══ قسم التقييم المدمج ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="relative flex-1 min-h-0 flex flex-col"
      >
        {/* شريط علوي */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-t border-slate-700/30 bg-slate-900/30">
          <Zap className="w-4 h-4 text-amber-400 fill-amber-400/30" />
          <p className="text-sm font-bold text-slate-200">قيّم الراكب (٣ ثواني)</p>
        </div>

        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-5 gap-4">

          {/* أفاتار الراكب */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-slate-600/50 flex items-center justify-center shadow-lg">
            <span className="text-xl font-black text-white">{riderInitials}</span>
          </div>

          {/* النجوم */}
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <motion.button
                key={star}
                type="button"
                title={`${star} نجوم`}
                whileTap={{ scale: 0.78 }}
                whileHover={{ scale: 1.2 }}
                onClick={() => { setRating(star); try { navigator.vibrate?.(30); } catch { /* ok */ } }}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                className="relative focus:outline-none"
              >
                {star === rating && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-amber-400/20"
                    animate={{ scale: [1, 1.7, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1.2 }}
                  />
                )}
                <Star className={`w-11 h-11 transition-all duration-200 ${
                  star <= display
                    ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_14px_rgba(251,191,36,0.75)]"
                    : "text-slate-700"
                }`} />
              </motion.button>
            ))}
          </div>

          {/* رسالة التقييم */}
          <AnimatePresence mode="wait">
            <motion.div
              key={display}
              initial={{ opacity: 0, scale: 0.85, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: -6 }}
              transition={{ duration: 0.16 }}
              className="flex items-center gap-2 bg-slate-800/40 border border-slate-700/30 rounded-full px-4 py-1.5"
            >
              <span className="text-2xl">{cfg.emoji}</span>
              <span className={`text-sm font-black ${cfg.color}`}>{cfg.text}</span>
            </motion.div>
          </AnimatePresence>

          {/* ── البادجات السريعة ── */}
          <div className="w-full">
            <p className="text-xs text-slate-500 text-center mb-2">ما ميّزه؟ (اختياري)</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {RIDER_BADGES.map((badge) => {
                const active = badges.includes(badge.id);
                return (
                  <motion.button
                    key={badge.id}
                    type="button"
                    whileTap={{ scale: 0.88 }}
                    onClick={() => toggleBadge(badge.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 ${
                      active
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                        : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {badge.emoji} {badge.label}
                    {active && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-emerald-400">✓</motion.span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══ الأزرار ═══ */}
        <div className="shrink-0 flex w-full border-t border-slate-700/30 pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            title="تخطي"
            className="flex-1 h-14 flex items-center justify-center text-sm font-bold text-slate-400 hover:bg-slate-800/60 active:bg-slate-800 transition-colors disabled:opacity-50 rounded-none"
          >
            تخطي
          </button>
          <div className="w-px bg-slate-700/30 shrink-0" />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            title="إرسال التقييم"
            className="flex-1 h-14 flex items-center justify-center gap-2 text-sm font-bold text-white bg-gradient-to-l from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:from-emerald-700 transition-all disabled:opacity-50 rounded-none"
          >
            {loading
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <><Send className="w-4 h-4" />إرسال التقييم</>
            }
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
};

export default DriverRideCompleted;
