import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle, Route, Wallet, Clock,
  Star, Loader2, Send, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";

interface RideCompletedScreenProps {
  ride: {
    id: string;
    pickup_address: string | null;
    dropoff_address: string | null;
    final_fare: number | null;
    estimated_fare: number | null;
    distance_km: number | null;
    duration_minutes: number | null;
    driver_id: string | null;
    payment_method?: string | null;
  };
  driverName: string;
  onClose: () => void;
}

const BADGES = [
  { id: "clean",    emoji: "🧹", label: "سيارة نظيفة"  },
  { id: "ontime",   emoji: "⏱️", label: "دقيق في المواعيد" },
  { id: "roads",    emoji: "🛣️", label: "خبير بالطرق"  },
  { id: "polite",   emoji: "💬", label: "أسلوب مهذب"   },
  { id: "ac",       emoji: "❄️", label: "مكيف ممتاز"   },
  { id: "safe",     emoji: "🚗", label: "قيادة آمنة"   },
];

const RATING_CONFIG = {
  5: { text: "ممتاز!",        emoji: "🌟", color: "text-emerald-400" },
  4: { text: "جيد جداً",      emoji: "👍", color: "text-green-400"   },
  3: { text: "متوسط",         emoji: "😐", color: "text-amber-400"  },
  2: { text: "يحتاج تحسين",  emoji: "😕", color: "text-orange-400" },
  1: { text: "سيء",           emoji: "😞", color: "text-red-400"    },
};

export const RideCompletedScreen = ({
  ride, driverName, onClose,
}: RideCompletedScreenProps) => {
  const { toast } = useToast();
  const [rating, setRating]     = useState(5);
  const [hovered, setHovered]   = useState(0);
  const [badges, setBadges]     = useState<string[]>([]);
  const [loading, setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const display   = hovered || rating;
  const cfg       = RATING_CONFIG[display as keyof typeof RATING_CONFIG];
  const driverInitials = driverName?.slice(0, 2) || "أ";
  const fare = ride.final_fare || ride.estimated_fare || 0;
  const paymentLabel = ride.payment_method === "wallet" ? "محفظة" : ride.payment_method === "card" ? "بطاقة" : "نقداً";

  useEffect(() => {
    const duration = 2800;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 3, angle: 60,  spread: 55, origin: { x: 0 }, colors: ["#10b981","#06b6d4","#fbbf24"] });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#10b981","#06b6d4","#fbbf24"] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  const toggleBadge = (id: string) => {
    try { navigator.vibrate?.(20); } catch { /* ignore */ }
    setBadges(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
  };

  const handleSubmit = async () => {
    if (!ride.driver_id) { onClose(); return; }
    setLoading(true);
    try {
      const badgeComment = badges.length > 0 ? `[بادجات: ${badges.join(",")}]` : null;

      const { error: rideErr } = await supabase
        .from("rides")
        .update({ driver_rating: rating })
        .eq("id", ride.id);

      if (rideErr) console.warn("[Rating] rides update err:", rideErr);

      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const { data: rProfile } = await supabase.from("profiles").select("id").eq("user_id", authData.user.id).maybeSingle();
          await supabase.from("ride_ratings").insert({
            ride_id: ride.id,
            rating,
            comment: badgeComment,
            driver_id: ride.driver_id,
            rider_id: rProfile?.id ?? null,
          });
        }
      } catch (innerErr) { /* ignore */ }

      try {
        const { data: ridesData } = await supabase.from("rides").select("driver_rating").eq("driver_id", ride.driver_id).eq("status", "completed").not("driver_rating", "is", null);
        if (ridesData?.length) {
          const avg = Math.round((ridesData.reduce((s, r) => s + (r.driver_rating ?? 0), 0) / ridesData.length) * 10) / 10;
          await supabase.from("drivers").update({ rating: avg }).eq("id", ride.driver_id);
        }
      } catch { /* ignore */ }

      try { confetti({ particleCount: 100, spread: 90, origin: { y: 0.5 }, colors: ["#10b981","#fbbf24","#06b6d4","#8b5cf6"] }); } catch { /* ignore */ }
      setSubmitted(true);
      toast({ title: "شكراً لتقييمك! ⭐", description: "تقييمك يجعل الخدمة أفضل" });
      setTimeout(() => onClose(), 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "حدث خطأ";
      toast({ title: "خطأ", description: message, variant: "destructive" });
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
           initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 180 }}
           className="relative flex flex-col items-center gap-5 px-8 text-center"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center shadow-[0_0_60px_rgba(16,185,129,0.5)]">
             <Sparkles className="w-12 h-12 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white mb-2 tracking-tight">شكراً لك! ✨</h2>
            <p className="text-slate-400 text-sm font-medium">تقييمك يساعدنا على تحسين الخدمة</p>
          </div>
          <div className="flex gap-1.5 mt-2">
            {[1,2,3,4,5].map(s => (
              <Star key={s} className={`w-8 h-8 ${s <= rating ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" : "text-slate-700/50"}`} />
            ))}
          </div>
        </motion.div>
      </div>,
      document.body
    );
  }

  /* ─── الشاشة الرئيسية ─── */
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col font-sans"
      style={{ height: "100dvh" }}
      dir="rtl"
    >
      {/* ── الخلفية ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/60 via-slate-950/90 to-slate-950" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-emerald-500/8 rounded-full blur-3xl" />
      </div>

      {/* ── هيدر ── */}
      <div className="relative shrink-0 pt-[calc(env(safe-area-inset-top)+2rem)] pb-3 px-6 text-center">
        <h1 className="text-xl font-black text-white tracking-tight">الحمد لله على السلامة!</h1>
      </div>

      {/* ── كارد الرحلة ── */}
      <div className="relative shrink-0 mx-5 mb-3">
        <div className="bg-slate-900/70 backdrop-blur-md rounded-3xl border border-slate-700/40 overflow-hidden shadow-xl">
          <div className="px-5 pt-4 pb-3 text-center border-b border-slate-700/50">
            <p className="text-[11px] text-slate-500 mb-1 font-bold uppercase tracking-widest">المبلغ الإجمالي</p>
            <div className="flex items-center justify-center gap-1.5" style={{ fontFamily: "Inter, sans-serif" }}>
              <span className="text-4xl font-black text-emerald-400 tabular-nums tracking-tighter">
                {fare.toLocaleString()}
              </span>
              <span className="text-base font-bold text-emerald-500/70 self-end mb-1">د.ع</span>
            </div>
          </div>
          <div className="flex items-center divide-x divide-x-reverse divide-slate-700/50 bg-slate-900/40">
            <div className="flex-1 flex flex-col items-center justify-center py-2.5">
              <Route className="w-3.5 h-3.5 text-cyan-400 mb-1" />
              <span className="text-xs font-bold text-slate-300" style={{ fontFamily: "Inter, sans-serif" }}>{(ride.distance_km || 0).toFixed(1)} كم</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center py-2.5">
              <Clock className="w-3.5 h-3.5 text-amber-400 mb-1" />
              <span className="text-xs font-bold text-slate-300" style={{ fontFamily: "Inter, sans-serif" }}>{ride.duration_minutes || 0} د</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center py-2.5">
              <Wallet className="w-3.5 h-3.5 text-emerald-400 mb-1" />
              <span className="text-xs font-bold text-slate-300">{paymentLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── كارد التقييم ── */}
      <div className="relative flex-1 min-h-0 flex flex-col bg-slate-900/50 backdrop-blur-sm mx-5 rounded-3xl border border-slate-700/30 overflow-hidden mb-[100px]">
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-4 gap-3 overflow-y-auto">

          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-600/50 flex items-center justify-center shadow-lg relative">
               <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full w-5 h-5 flex items-center justify-center border-2 border-slate-900">
                  <Star className="w-3 h-3 text-white fill-white" />
               </div>
               <span className="text-xl font-black text-slate-200">{driverInitials}</span>
            </div>
            <p className="text-sm font-bold text-slate-300 text-center">كيف كانت تجربتك مع {driverName}؟</p>
          </div>

          <div className="flex gap-1.5 shrink-0" style={{ direction: "ltr" }}>
            {[1, 2, 3, 4, 5].map((star) => {
              const isActive = star <= display;
              return (
                <button
                  key={star} type="button" 
                  onClick={() => { setRating(star); try { navigator.vibrate?.(30); } catch { /* ok */ } }}
                  onMouseEnter={() => setHovered(star)} onMouseLeave={() => setHovered(0)}
                  className="relative focus:outline-none p-1 transition-transform active:scale-95"
                >
                  <Star className={"w-10 h-10 transition-colors duration-200 " + (isActive ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" : "text-slate-700/40")} />
                </button>
              );
            })}
          </div>

          <div className="h-8 flex items-center justify-center shrink-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={display} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.15 }}
                className="flex items-center gap-1.5 bg-slate-800 border border-slate-700/50 rounded-full px-4 py-1.5 shadow-sm"
              >
                <span className="text-lg">{cfg.emoji}</span>
                <span className={`text-sm font-bold ${cfg.color}`}>{cfg.text}</span>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="w-full shrink-0 pt-2 pb-2">
            <div className="flex flex-wrap gap-2 justify-center">
              {BADGES.map((badge) => {
                const active = badges.includes(badge.id);
                return (
                  <button
                    key={badge.id} type="button" onClick={() => toggleBadge(badge.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-200 active:scale-95 ${
                      active ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <span>{badge.emoji}</span>
                    <span>{badge.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── أزرار التقييم — ثابتة أسفل الشاشة ── */}
      <div className="absolute bottom-0 left-0 right-0 flex z-50 bg-[#163d30]" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}>
        <button
          type="button" onClick={onClose} disabled={loading}
          className="flex-1 h-[72px] flex items-center justify-center text-sm font-bold text-emerald-300 bg-[#0f2922] hover:bg-[#163d30] transition-colors disabled:opacity-50 touch-manipulation border-t border-l border-emerald-500/20"
        >
          تخطي
        </button>
        <button
           type="button" onClick={handleSubmit} disabled={loading} style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
           className="flex-[2] h-[72px] flex items-center justify-center gap-2 text-lg font-black text-[#064e3b] bg-[#34d399] shadow-[0_-5px_30px_rgba(52,211,153,0.25)] hover:bg-[#2dd392] active:bg-[#10b981] transition-colors disabled:opacity-50 touch-manipulation border-t border-[#34d399]"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <><Send className="w-5 h-5 ml-1" />تأكيد التقييم</>}
        </button>
      </div>
    </div>,
    document.body
  );
};

export default RideCompletedScreen;
