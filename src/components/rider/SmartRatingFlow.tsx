import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Star, Loader2, CheckCircle, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";

/* ─────────────────────── Types ─────────────────────── */
interface SmartRatingFlowProps {
  rideId: string;
  driverId: string | null;
  driverName: string;
  onComplete: () => void;
  onSkip: () => void;
}

type Step = "rating" | "done";

interface Badge { id: string; emoji: string; label: string }

const BADGES: Badge[] = [
  { id: "clean",    emoji: "🧹", label: "سيارة نظيفة"  },
  { id: "ontime",   emoji: "⏱️", label: "دقيق في المواعيد" },
  { id: "roads",    emoji: "🛣️", label: "خبير بالطرق"  },
  { id: "polite",   emoji: "💬", label: "أسلوب مهذب"   },
  { id: "ac",       emoji: "❄️", label: "مكيف ممتاز"   },
  { id: "safe",     emoji: "🚗", label: "قيادة آمنة"   },
];

const RATING_CONFIG = {
  5: { text: "ممتاز!",        emoji: "🌟", color: "text-emerald-400", ring: "ring-emerald-500/40", bg: "from-emerald-500/15 to-transparent" },
  4: { text: "جيد جداً",      emoji: "👍", color: "text-green-400",   ring: "ring-green-500/40",   bg: "from-green-500/12 to-transparent"   },
  3: { text: "متوسط",         emoji: "😐", color: "text-amber-400",  ring: "ring-amber-500/40",   bg: "from-amber-500/12 to-transparent"   },
  2: { text: "يحتاج تحسين",  emoji: "😕", color: "text-orange-400", ring: "ring-orange-500/40",  bg: "from-orange-500/12 to-transparent"  },
  1: { text: "سيء",           emoji: "😞", color: "text-red-400",    ring: "ring-red-500/40",     bg: "from-red-500/12 to-transparent"     },
};

/* ─────────────────────── Component ─────────────────────── */
const SmartRatingFlow = ({ rideId, driverId, driverName, onComplete, onSkip }: SmartRatingFlowProps) => {
  const { toast } = useToast();
  const [step, setStep]         = useState<Step>("rating");
  const [rating, setRating]     = useState(5);
  const [hovered, setHovered]   = useState(0);
  const [badges, setBadges]     = useState<string[]>([]);
  const [reviewText, setReviewText] = useState("");
  const [loading, setLoading]   = useState(false);

  const display   = hovered || rating;
  const cfg       = RATING_CONFIG[display as keyof typeof RATING_CONFIG];
  const driverInitials = driverName?.slice(0, 2) || "أ";

  /* vibrate helper */
  const vibrate = (ms = 30) => {
    try { navigator.vibrate?.(ms); } catch { /* ignore */ }
  };

  /* confetti burst */
  const burst = useCallback(() => {
    const fire = (opts: confetti.Options) =>
      confetti({ ...opts, disableForReducedMotion: true });
    fire({ particleCount: 20, spread: 80, origin: { y: 0.55 }, colors: ["#10b981","#fbbf24","#06b6d4","#f59e0b","#8b5cf6"] });
    setTimeout(() =>
      fire({ particleCount: 10, spread: 100, origin: { y: 0.55 }, colors: ["#ec4899","#fbbf24","#10b981"] }), 250);
  }, []);

  /* stars entrance confetti */
  useEffect(() => {
    try {
      confetti({ particleCount: 15, spread: 65, origin: { y: 0.6 }, colors: ["#10b981","#fbbf24","#06b6d4"] });
    } catch { /* ignore */ }
  }, []);

  const toggleBadge = (id: string) => {
    vibrate(20);
    setBadges(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
  };

  const handleStarClick = (star: number) => {
    vibrate(30);
    setRating(star);
  };

  const handleSubmit = async () => {
    if (!driverId) { onComplete(); return; }
    setLoading(true);

    try {
      // بناء التعليق: البادجات + نص المراجعة الحرة
      const badgePart = badges.length > 0
        ? `[بادجات: ${badges.join(",")}]`
        : null;
      const reviewPart = reviewText.trim() || null;
      const comment = [badgePart, reviewPart].filter(Boolean).join(" | ") || null;

      /* 1️⃣ تحديث تقييم الرحلة — الأهم */
      const { error: rideErr } = await supabase
        .from("rides")
        .update({ driver_rating: rating })
        .eq("id", rideId);

      if (rideErr) {
        console.warn("[Rating] rides.update error:", rideErr.message);
      }

      /* 2️⃣ حفظ ride_ratings — اختياري، لا يمنع الإتمام */
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const { data: riderProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("user_id", authData.user.id)
            .maybeSingle();

          const { error: ratingErr } = await supabase.from("ride_ratings").insert({
            ride_id: rideId,
            rating,
            comment,
            driver_id: driverId,
            rider_id: riderProfile?.id ?? null,
          });
          if (ratingErr) console.warn("[Rating] ride_ratings insert error:", ratingErr.message);
        }
      } catch (innerErr) {
        console.warn("[Rating] ride_ratings insert skipped:", innerErr);
      }

      /* 3️⃣ تحديث متوسط تقييم الكابتن — اختياري */
      try {
        const { data: rides } = await supabase
          .from("rides")
          .select("driver_rating")
          .eq("driver_id", driverId)
          .eq("status", "completed")
          .not("driver_rating", "is", null);

        if (rides?.length) {
          const avg = Math.round(
            (rides.reduce((s, r) => s + (r.driver_rating ?? 0), 0) / rides.length) * 10
          ) / 10;
          const { error: avgErr2 } = await supabase.from("drivers").update({ rating: avg }).eq("id", driverId);
          if (avgErr2) console.warn("[Rating] driver avg update error:", avgErr2.message);
        }
      } catch (avgErr) {
        console.warn("[Rating] driver avg update skipped:", avgErr);
      }

      /* ✅ النجاح دائماً */
      burst();
      setStep("done");
      toast({ title: "شكراً لتقييمك! ⭐", description: "تقييمك يجعل الخدمة أفضل" });
      setTimeout(() => onComplete(), 2200);

    } catch (err: unknown) {
      console.error("[Rating] handleSubmit error:", err);
      toast({
        title: "خطأ في الإرسال",
        description: err instanceof Error ? err.message : "حدث خطأ، حاول مجدداً",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /* ─── Done screen ─── */
  if (step === "done") {
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
            <h2 className="text-2xl font-black text-white mb-1">شكراً لك! ✨</h2>
            <p className="text-slate-400 text-sm">تقييمك يساعدنا على تحسين الخدمة</p>
          </div>
          <div className="flex gap-1">
            {[1,2,3,4,5].map(s => (
              <Star key={s} className={`w-7 h-7 ${s <= rating ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" : "text-slate-700"}`} />
            ))}
          </div>
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {BADGES.filter(b => badges.includes(b.id)).map(b => (
                <span key={b.id} className="text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-full px-3 py-1">
                  {b.emoji} {b.label}
                </span>
              ))}
            </div>
          )}
          {reviewText.trim() && (
            <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl px-4 py-3 max-w-xs text-center">
              <p className="text-sm text-slate-300 leading-relaxed">“{reviewText.trim()}”</p>
            </div>
          )}
        </motion.div>
      </div>,
      document.body
    );
  }

  /* ─── Main portal ─── */
  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", stiffness: 220, damping: 28 }}
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ height: "100dvh" }}
      dir="rtl"
    >
      {/* ── خلفية زجاجية ── */}
      <div className={`absolute inset-0 bg-gradient-to-b ${cfg.bg} transition-all duration-500`} />
      <div className="absolute inset-0 bg-slate-950/92 backdrop-blur-2xl" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-emerald-500/6 rounded-full blur-3xl pointer-events-none" />

      {/* ════════════════════════════════════════
          حالة: التقييم الرئيسية
      ════════════════════════════════════════ */}
      {step === "rating" && (
        <div className="relative flex-1 min-h-0 flex flex-col">

          {/* صورة الكابتن + النجوم */}
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 gap-4">

            {/* أفاتار الكابتن بـ ring */}
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              className={`w-20 h-20 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center ring-4 ${cfg.ring} transition-all duration-500 shadow-lg`}
            >
              <span className="text-2xl font-black text-white">{driverInitials}</span>
            </motion.div>

            {/* الاسم */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <p className="text-xs text-slate-500 mb-0.5">كيف كانت رحلتك مع</p>
              <h2 className="text-lg font-black text-white">{driverName}</h2>
            </motion.div>

            {/* ── النجوم ── */}
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <motion.button
                  key={star}
                  type="button"
                  title={`${star} نجوم`}
                  whileTap={{ scale: 0.75 }}
                  whileHover={{ scale: 1.2 }}
                  onClick={() => handleStarClick(star)}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  className="relative focus:outline-none"
                >
                  {/* نبض عند التحديد */}
                  {star === rating && (
                    <motion.div
                      layoutId="star-pulse"
                      className="absolute inset-0 rounded-full bg-amber-400/20"
                      animate={{ scale: [1, 1.6, 1] }}
                      transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
                    />
                  )}
                  <Star className={`w-12 h-12 transition-all duration-200 ${
                    star <= display
                      ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_14px_rgba(251,191,36,0.75)]"
                      : "text-slate-700"
                  }`} />
                </motion.button>
              ))}
            </div>

            {/* رسالة التقييم */}
            <AnimatePresence mode="sync">
              <motion.div
                key={display}
                initial={{ opacity: 0, scale: 0.8, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -8 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-2 bg-slate-800/40 border border-slate-700/30 rounded-full px-4 py-1.5"
              >
                <span className="text-2xl">{cfg.emoji}</span>
                <span className={`text-sm font-black ${cfg.color}`}>{cfg.text}</span>
              </motion.div>
            </AnimatePresence>

            {/* ── البادجات ── */}
            <div className="w-full">
              <p className="text-xs text-slate-500 text-center mb-2">ما الذي أعجبك؟ (اختياري)</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {BADGES.map((badge) => {
                  const active = badges.includes(badge.id);
                  return (
                    <motion.button
                      key={badge.id}
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => toggleBadge(badge.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 ${
                        active
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                          : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      <span>{badge.emoji}</span>
                      <span>{badge.label}</span>
                      {active && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-emerald-400">✓</motion.span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* ── حقل التعليق الحر ── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="w-full"
            >
              <label className="block text-xs text-slate-500 text-center mb-2">
                اكتب تعليقك (اختياري)
              </label>
              <div className={`relative rounded-2xl border transition-all duration-300 ${
                reviewText
                  ? 'border-emerald-500/50 shadow-[0_0_0_3px_rgba(52,211,153,0.08)]'
                  : 'border-slate-700/50'
              } bg-slate-900/60 backdrop-blur-sm`}>
                {/* أيقونة القلم */}
                <span className="absolute top-3 right-3 text-slate-500 text-sm pointer-events-none select-none">✍️</span>
                <textarea
                  value={reviewText}
                  onChange={e => setReviewText(e.target.value)}
                  placeholder="شارك تجربتك مع هذا الكابتن..."
                  maxLength={300}
                  rows={3}
                  dir="rtl"
                  className="w-full bg-transparent text-sm text-white placeholder:text-slate-600 resize-none px-4 pt-3 pb-2 pr-9 rounded-2xl focus:outline-none leading-relaxed"
                />
                {/* عداد الأحرف */}
                <div className="flex items-center justify-between px-4 pb-2">
                  <span className={`text-[10px] transition-colors ${
                    reviewText.length > 250 ? 'text-amber-400' : 'text-slate-600'
                  }`}>
                    {reviewText.length}/300
                  </span>
                  {reviewText && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      type="button"
                      onClick={() => setReviewText('')}
                      className="text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                    >
                      مسح
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* الأزرار */}
          <div className="shrink-0 flex border-t-2 border-emerald-500/20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]" style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}>
            <button
              type="button" onClick={onSkip} title="تخطي"
              className="flex-1 h-[72px] flex items-center justify-center text-sm font-bold text-slate-200 bg-[#1a2333] hover:bg-[#212d42] active:bg-[#283a52] transition-all rounded-none touch-manipulation border-r border-slate-600/40"
            >
              تخطي
            </button>
            <button
              type="button" onClick={handleSubmit} disabled={loading} title="إرسال التقييم"
              className="flex-[2] h-[72px] flex items-center justify-center gap-2 text-lg font-black text-white bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 shadow-[0_-4px_20px_rgba(16,185,129,0.25)] hover:from-emerald-500 hover:to-emerald-400 active:from-emerald-700 transition-all disabled:opacity-50 rounded-none touch-manipulation"
            >
              {loading
                ? <Loader2 className="w-6 h-6 animate-spin" />
                : <><CheckCircle className="w-5 h-5" />تأكيد التقييم</>
              }
            </button>
          </div>
        </div>
      )}


    </motion.div>,
    document.body
  );
};

export default SmartRatingFlow;
