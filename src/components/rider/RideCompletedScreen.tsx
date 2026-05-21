import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Route, Wallet, Clock,
  Star, Loader2, Send, Check, Calendar, EyeOff,
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
    metadata?: Record<string, unknown> | null;
  };
  driverName: string;
  onClose: () => void;
}

const BADGES = [
  { id: "clean",   emoji: "🧹", label: "سيارة نظيفة"       },
  { id: "ontime",  emoji: "⏱️", label: "دقيق في المواعيد"  },
  { id: "roads",   emoji: "🛣️", label: "خبير بالطرق"       },
  { id: "polite",  emoji: "💬", label: "أسلوب مهذب"        },
  { id: "ac",      emoji: "❄️", label: "مكيف ممتاز"        },
  { id: "safe",    emoji: "🚗", label: "قيادة آمنة"        },
];

const RATING_CONFIG = {
  5: { text: "ممتاز!",       emoji: "🌟", color: "text-emerald-400" },
  4: { text: "جيد جداً",     emoji: "👍", color: "text-green-400"   },
  3: { text: "متوسط",        emoji: "😐", color: "text-amber-400"   },
  2: { text: "يحتاج تحسين", emoji: "😕", color: "text-orange-400"  },
  1: { text: "سيء",          emoji: "😞", color: "text-red-400"     },
};

// خطوات التقييم
const STEPS = ["الرحلة", "التقييم", "الإطراء", "ملاحظات"];

export const RideCompletedScreen = ({
  ride, driverName, onClose,
}: RideCompletedScreenProps) => {
  const { toast } = useToast();
  const [step, setStep]               = useState(0); // 0=معلومات، 1=تقييم، 2=بادجات، 3=تعليق
  const [rating, setRating]           = useState(5);
  const [hovered, setHovered]         = useState(0);
  const [badges, setBadges]           = useState<string[]>([]);
  const [reviewText, setReviewText]   = useState("");
  const [loading, setLoading]         = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [driverAvatar, setDriverAvatar]       = useState<string | null>(null);
  const [realDriverName, setRealDriverName]   = useState<string>("");
  const [realDriverRating, setRealDriverRating] = useState<number | null>(null);
  const [vehicleModel, setVehicleModel]       = useState<string | null>(null);
  const [vehicleColor, setVehicleColor]       = useState<string | null>(null);
  const [vehiclePlate, setVehiclePlate]       = useState<string | null>(null);

  useEffect(() => {
    if (!ride.driver_id) return;
    const fetchDriverData = async () => {
      try {
        // جلب بيانات السائق الحقيقية من جدول drivers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from("drivers")
          .select("profile_image_url, full_name, rating, vehicle_model, vehicle_color, vehicle_plate")
          .eq("id", ride.driver_id)
          .maybeSingle();
        if (!error && data) {
          const d = data as {
            profile_image_url?: string | null;
            full_name?: string | null;
            rating?: number | null;
            vehicle_model?: string | null;
            vehicle_color?: string | null;
            vehicle_plate?: string | null;
          };
          if (d.profile_image_url) setDriverAvatar(d.profile_image_url);
          if (d.full_name) setRealDriverName(d.full_name);
          if (d.rating) setRealDriverRating(d.rating);
          if (d.vehicle_model) setVehicleModel(d.vehicle_model);
          if (d.vehicle_color) setVehicleColor(d.vehicle_color);
          if (d.vehicle_plate) setVehiclePlate(d.vehicle_plate);
        }
      } catch (err) {
        console.error("Error fetching driver data:", err);
      }
    };
    fetchDriverData();
  }, [ride.driver_id]);

  useEffect(() => {
    try {
      confetti({ particleCount: 20, spread: 70, origin: { y: 0.6 }, colors: ["#10b981","#fbbf24","#06b6d4"] });
    } catch { /* ignore */ }
  }, []);

  const display          = hovered || rating;
  const cfg              = RATING_CONFIG[display as keyof typeof RATING_CONFIG];
  const activeDriverName = realDriverName || driverName || "السائق";
  const driverInitials   = activeDriverName.slice(0, 2) || "أ";
  const fare             = ride.final_fare || ride.estimated_fare || 0;
  const paymentLabel     = ride.payment_method === "wallet" ? "محفظة" : ride.payment_method === "card" ? "بطاقة" : "نقداً";

  // جلب بيانات الإيصال من metadata الرحلة
  const receipt = (ride.metadata as Record<string, unknown>)?.receipt as {
    base_fare?: number;
    final_fare?: number;
    waiting_fare?: number;
    fare_adjusted?: boolean;
  } | undefined;

  // دالة تنسيق الأرقام بشكل ثابت بغض النظر عن لغة الجهاز
  const fmtNum = (n: number, decimals = 0) =>
    n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: true });

  const getFormattedDate = () => {
    const d = new Date();
    const days   = ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
    const months = ["كانون الثاني","شباط","آذار","نيسان","أيار","حزيران","تموز","آب","أيلول","تشرين الأول","تشرين الثاني","كانون الأول"];
    let period = "صباحاً";
    if (d.getHours() >= 12 && d.getHours() < 16) period = "ظهراً";
    else if (d.getHours() >= 16 && d.getHours() < 20) period = "عصراً";
    else if (d.getHours() >= 20) period = "مساءً";
    return `${days[d.getDay()]} ${period} ${d.getDate()} ${months[d.getMonth()]}`;
  };

  const toggleBadge = (id: string) => {
    try { navigator.vibrate?.(20); } catch { /* ignore */ }
    setBadges(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
  };

  const handleSubmit = async () => {
    if (!ride.driver_id) { onClose(); return; }
    setLoading(true);
    try {
      const badgePart  = badges.length > 0 ? `[بادجات: ${badges.join(",")}]` : null;
      const reviewPart = reviewText.trim() || null;
      const comment    = [badgePart, reviewPart].filter(Boolean).join(" | ") || null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: rideErr } = await (supabase as any)
        .from("rides")
        .update({ driver_rating: rating || 5 })
        .eq("id", ride.id);

      if (rideErr) console.warn("[Rating] rides update err:", rideErr);

      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: rProfile } = await (supabase as any)
            .from("profiles")
            .select("id")
            .eq("user_id", authData.user.id)
            .maybeSingle();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("ride_ratings").insert({
            ride_id: ride.id,
            rating: rating || 5,
            comment,
            driver_id: ride.driver_id,
            rider_id: (rProfile as { id?: string } | null)?.id ?? null,
          });
        }
      } catch { /* ignore */ }

      try { confetti({ particleCount: 30, spread: 90, origin: { y: 0.4 }, colors: ["#10b981","#fbbf24","#06b6d4","#8b5cf6"] }); } catch { /* ignore */ }
      setSubmitted(true);
      toast({ title: "شكراً لتقييمك! ⭐", description: "تقييمك يجعل الخدمة أفضل" });
      setTimeout(() => onClose(), 2200);
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
      <div className="fixed inset-0 z-[9999] bg-[#070b13] flex flex-col items-center justify-center" dir="rtl">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/50 to-[#070b13] pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 180 }}
          className="relative flex flex-col items-center gap-5 px-8 text-center"
        >

          <div>
            <h2 className="text-3xl font-black text-white mb-2 tracking-tight">شكراً لك! ✨</h2>
            <p className="text-white/40 text-sm font-medium">تقييمك يساعدنا على تحسين الخدمة</p>
          </div>
          <div className="flex gap-1.5 mt-2" style={{ direction: "ltr" }}>
            {[1,2,3,4,5].map(s => (
              <Star key={s} className={`w-8 h-8 ${s <= (rating || 5) ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" : "text-white/10"}`} />
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
      className="fixed inset-0 z-[9999] bg-[#070b13] font-sans flex flex-col"
      style={{ height: "100dvh" }}
      dir="rtl"
    >
      {/* ── خلفية متوهجة ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[140vw] h-[35vh] bg-[#5bdda6]/[0.06] rounded-[100%] blur-[80px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80vw] h-[25vh] bg-[#5bdda6]/[0.03] rounded-[100%] blur-[60px]" />
      </div>

      {/* ── هيدر ثابت ── */}
      <div
        className="relative z-10 flex flex-col items-center px-5 shrink-0"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 18px)", paddingBottom: "14px" }}
      >

        {/* عنوان الشاشة */}
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="flex flex-col items-center gap-0.5 mb-4"
        >
          <p className="text-[#5bdda6] text-[11px] font-bold tracking-[0.15em] uppercase opacity-80">الحمد لله على سلامتك</p>
          <h1 className="text-[20px] font-black text-white tracking-tight">الرحلة اكتملت</h1>
        </motion.div>

        {/* Stepper ─ مؤشر الخطوات */}
        <motion.div
          initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="flex items-center gap-0 w-full max-w-xs" dir="ltr"
        >
          {STEPS.map((label, idx) => {
            const isCompleted = idx < step;
            const isCurrent   = idx === step;
            return (
              <div key={label} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black transition-all duration-400 ${
                      isCompleted
                        ? "bg-[#5bdda6] shadow-[0_0_10px_rgba(91,221,166,0.5)]"
                        : isCurrent
                        ? "bg-transparent border-2 border-[#5bdda6] shadow-[0_0_10px_rgba(91,221,166,0.3)]"
                        : "bg-white/[0.05] border border-white/[0.1]"
                    }`}
                  >
                    {isCompleted
                      ? <Check className="w-3.5 h-3.5 text-[#070b13] stroke-[3]" />
                      : <span className={isCurrent ? "text-[#5bdda6]" : "text-white/20"}>{idx + 1}</span>
                    }
                  </div>
                  <span className={`text-[8px] font-bold mt-0.5 tracking-wide ${isCurrent ? "text-[#5bdda6]" : isCompleted ? "text-[#5bdda6]/60" : "text-white/20"}`}>
                    {label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`h-[1.5px] flex-1 mb-3 mx-0.5 rounded-full transition-all duration-500 ${isCompleted ? "bg-[#5bdda6]" : "bg-white/[0.07]"}`} />
                )}
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* ── المحتوى بالكامل قابل للتمرير ── */}
      <div className="relative flex-1 overflow-y-auto z-10" style={{ paddingBottom: "80px" }}>
        <div className="flex flex-col items-center w-full px-4 gap-3 max-w-md mx-auto pt-1">

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* ── الخطوة 0: ملخص الرحلة ─────────── */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
                transition={{ type: "spring", stiffness: 260, damping: 26 }}
                className="w-full flex flex-col gap-3"
              >
                {/* كارد المبلغ */}
                <div className="relative bg-[#0d1a2a] border border-white/[0.07] rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
                  <div className="absolute -top-8 -right-8 w-32 h-32 bg-[#5bdda6]/15 rounded-full blur-3xl pointer-events-none" />
                  <div className="px-5 pt-5 pb-4 text-center border-b border-white/[0.05] relative z-10">
                    <p className="text-[9px] text-white/35 mb-1 font-bold uppercase tracking-[0.25em]">المبلغ الإجمالي المدفوع</p>
                    <div className="flex items-end justify-center gap-1.5">
                      <span className="text-[42px] leading-none font-black text-transparent bg-clip-text bg-gradient-to-r from-[#5bdda6] to-[#34d399] tracking-tighter">
                        {fmtNum(fare)}
                      </span>
                      <span className="text-[16px] font-bold text-[#5bdda6]/50 mb-1.5">د.ع</span>
                    </div>

                    {/* تفاصيل الفاتورة من الإيصال */}
                    {receipt && (
                      <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-1.5">
                        {receipt.base_fare != null && receipt.base_fare !== receipt.final_fare && (
                          <div className="flex justify-between text-[11px] px-2">
                            <span className="text-white/40">الأجرة المقدّرة</span>
                            <span className="text-white/50">{fmtNum(receipt.base_fare)} د.ع</span>
                          </div>
                        )}
                        {(receipt.waiting_fare || 0) > 0 && (
                          <div className="flex justify-between text-[11px] px-2">
                            <span className="text-white/40">⏳ أجرة الانتظار</span>
                            <span className="text-amber-400/70">+{fmtNum(receipt.waiting_fare || 0)} د.ع</span>
                          </div>
                        )}
                        {receipt.fare_adjusted && (
                          <p className="text-[10px] text-amber-400/60 text-center mt-1">✦ تم تعديل الأجرة بناءً على المسار الفعلي</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-x-reverse divide-white/[0.05] relative z-10">
                    <div className="flex flex-col items-center py-3 gap-1">
                      <Route className="w-3.5 h-3.5 text-sky-400 opacity-80" />
                      <span className="text-[11px] font-bold text-white/70">{fmtNum(ride.distance_km || 0, 1)} كم</span>
                    </div>
                    <div className="flex flex-col items-center py-3 gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400 opacity-80" />
                      <span className="text-[11px] font-bold text-white/70">{ride.duration_minutes || 0} د</span>
                    </div>
                    <div className="flex flex-col items-center py-3 gap-1">
                      <Wallet className="w-3.5 h-3.5 text-[#5bdda6] opacity-80" />
                      <span className="text-[11px] font-bold text-white/70">{paymentLabel}</span>
                    </div>
                  </div>
                </div>

                {/* كارد السائق */}
                <div className="bg-[#0d1a2a] border border-white/[0.07] rounded-2xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
                  <div className="flex items-center gap-3">
                    {/* الصورة */}
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 bg-[#5bdda6]/20 rounded-full blur-md animate-pulse" />
                      <div className="relative w-14 h-14 rounded-full border-[1.5px] border-[#5bdda6]/30 overflow-hidden bg-[#0b1929] flex items-center justify-center shadow-[0_0_20px_rgba(91,221,166,0.12)]">
                        {driverAvatar ? (
                          <img src={driverAvatar} alt={activeDriverName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[18px] font-black text-[#5bdda6]">{driverInitials}</span>
                        )}
                      </div>
                      {/* نقطة أونلاين */}
                      <div className="absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-[#0d1a2a] shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                    </div>
                    {/* الاسم */}
                    <div className="flex-1">
                      <p className="text-[15px] font-black text-white">{activeDriverName}</p>
                      {/* بيانات السيارة الحقيقية */}
                      {vehicleModel ? (
                        <p className="text-[11px] text-white/40 mt-0.5">
                          {vehicleModel}
                          {vehicleColor ? ` • ${vehicleColor}` : ""}
                          {vehiclePlate ? ` — ${vehiclePlate}` : ""}
                        </p>
                      ) : (
                        <p className="text-[11px] text-white/20 mt-0.5">جاري التحميل...</p>
                      )}
                    </div>
                    {/* تقييم السائق الحقيقي */}
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span className="text-[13px] font-black text-amber-400">
                          {realDriverRating !== null ? realDriverRating.toFixed(1) : "—"}
                        </span>
                      </div>
                      <span className="text-[9px] text-white/30 font-medium">تقييم الكابتن</span>
                    </div>
                  </div>

                  <div className="w-full h-px bg-white/[0.05] my-3" />

                  {/* الموقع والتاريخ */}
                  <div className="flex flex-col gap-2">
                    {/* جهة الانطلاق */}
                    <div className="flex items-start gap-2.5">
                      <div className="flex flex-col items-center shrink-0 mt-0.5">
                        <div className="w-4 h-4 rounded-full bg-[#1e3a8a]/40 border border-[#3b82f6]/50 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-[#60a5fa] rounded-full" />
                        </div>
                        <div className="w-px h-4 bg-white/[0.08] my-0.5" />
                      </div>
                      <div className="flex-1 pb-1">
                        <p className="text-[9px] text-white/30 font-bold uppercase tracking-wider mb-0.5">الانطلاق</p>
                        <span className="text-[11px] text-white/60 leading-snug">{ride.pickup_address || "—"}</span>
                      </div>
                    </div>
                    {/* جهة الوصول */}
                    <div className="flex items-start gap-2.5">
                      <div className="flex flex-col items-center shrink-0 mt-0.5">
                        <div className="w-4 h-4 rounded-full bg-[#064e3b]/40 border border-[#5bdda6]/50 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-[#5bdda6] rounded-full" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-[9px] text-white/30 font-bold uppercase tracking-wider mb-0.5">الوصول</p>
                        <span className="text-[11px] text-white/60 leading-snug">{ride.dropoff_address || "—"}</span>
                      </div>
                    </div>
                    {/* التاريخ */}
                    <div className="flex items-center gap-2.5 mt-1 pt-2 border-t border-white/[0.04]">
                      <Calendar className="w-3.5 h-3.5 text-white/25 shrink-0" />
                      <span className="text-[11px] text-white/50">الرحلة {getFormattedDate()}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {/* ── الخطوة 1: التقييم بالنجوم ─────────── */}
            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
                transition={{ type: "spring", stiffness: 260, damping: 26 }}
                className="w-full"
              >
                <div className="bg-[#0d1a2a] border border-white/[0.07] rounded-2xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
                  {/* عنوان القسم */}
                  <div className="text-center mb-5">
                    <h2 className="text-[17px] font-black text-white">قيم الرحلة والسائق</h2>
                    <p className="text-[12px] text-white/40 mt-1">كيف كانت الرحلة؟</p>
                  </div>

                  {/* صورة السائق مجدداً في هذا القسم */}
                  <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/[0.06]">
                    <div className="relative w-11 h-11 rounded-full border border-[#5bdda6]/30 overflow-hidden bg-[#0b1929] flex items-center justify-center shrink-0">
                      {driverAvatar
                        ? <img src={driverAvatar} alt={activeDriverName} className="w-full h-full object-cover" />
                        : <span className="text-[14px] font-black text-[#5bdda6]">{driverInitials}</span>
                      }
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-white">{activeDriverName}</p>
                      <p className="text-[10px] text-white/35">كيف كانت تجربتك معه؟</p>
                    </div>
                  </div>

                  {/* النجوم */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2" style={{ direction: "ltr" }}>
                      {[1,2,3,4,5].map((star) => {
                        const isActive = star <= display;
                        return (
                          <button
                            key={star} type="button"
                            onClick={() => { setRating(star); try { navigator.vibrate?.(30); } catch { /* ok */ } }}
                            onMouseEnter={() => setHovered(star)}
                            onMouseLeave={() => setHovered(0)}
                            className="group relative p-1 transition-transform duration-200 active:scale-90 hover:scale-110"
                          >
                            <Star
                              className={`w-10 h-10 transition-all duration-300 ${
                                isActive
                                  ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_14px_rgba(251,191,36,0.65)] scale-105"
                                  : "text-white/10 group-hover:text-white/20 scale-95"
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>

                    {/* تسميات جيد / سيء */}
                    <div className="flex items-center justify-between w-full px-1">
                      <span className="text-[10px] font-bold text-white/25">سيء جداً</span>
                      <AnimatePresence mode="wait">
                        {display > 0 && (
                          <motion.div
                            key={display}
                            initial={{ opacity: 0, scale: 0.8, y: 4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: -4 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center gap-1.5 bg-white/[0.05] border border-white/[0.1] backdrop-blur-md rounded-full px-3 py-1"
                          >
                            <span className="text-[15px] leading-none">{cfg.emoji}</span>
                            <span className={`text-[11px] font-bold ${cfg.color}`}>{cfg.text}</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <span className="text-[10px] font-bold text-white/25">جيد جداً</span>
                    </div>

                    {/* ملاحظة السرية */}
                    <div className="flex items-center justify-center gap-1.5 mt-2 text-white/25">
                      <EyeOff className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-medium">سيتم الاحتفاظ بتقييمك بشكل سري ولن يعرف السائق به.</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {/* ── الخطوة 2: الإطراء (البادجات) ─────────── */}
            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
                transition={{ type: "spring", stiffness: 260, damping: 26 }}
                className="w-full"
              >
                <div className="bg-[#0d1a2a] border border-white/[0.07] rounded-2xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
                  <div className="text-center mb-4">
                    <h2 className="text-[17px] font-black text-white">ما الذي أعجبك في الكابتن؟</h2>
                    <p className="text-[12px] text-white/40 mt-1">اختر ما يناسب تجربتك (اختياري)</p>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-center">
                    {BADGES.map((badge) => {
                      const active = badges.includes(badge.id);
                      return (
                        <motion.button
                          key={badge.id} type="button"
                          onClick={() => toggleBadge(badge.id)}
                          whileTap={{ scale: 0.94 }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold border transition-all duration-250 ${
                            active
                              ? "bg-[#5bdda6]/15 border-[#5bdda6]/50 text-[#5bdda6] shadow-[0_0_12px_rgba(91,221,166,0.15)]"
                              : "bg-white/[0.03] border-white/[0.08] text-white/45 hover:bg-white/[0.06] hover:text-white/65"
                          }`}
                        >
                          <span className="text-[14px]">{badge.emoji}</span>
                          <span>{badge.label}</span>
                          {active && <Check className="w-3 h-3 mr-0.5" />}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {/* ── الخطوة 3: ملاحظات نصية (التعليق) ─────────── */}
            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
                transition={{ type: "spring", stiffness: 260, damping: 26 }}
                className="w-full"
              >
                <div className="bg-[#0d1a2a] border border-white/[0.07] rounded-2xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
                  <div className="text-center mb-4">
                    <h2 className="text-[17px] font-black text-white">شاركنا رأيك</h2>
                    <p className="text-[12px] text-white/40 mt-1">هل هناك شيء تريد إضافته؟ (اختياري)</p>
                  </div>

                  {/* حقل التعليق */}
                  <div className={`relative rounded-xl border transition-all duration-300 overflow-hidden ${
                    reviewText
                      ? "border-[#5bdda6]/40 bg-[#5bdda6]/[0.04] shadow-[0_0_20px_rgba(91,221,166,0.08)]"
                      : "border-white/[0.08] bg-white/[0.02]"
                  }`}>
                    <span className="absolute top-3 right-3.5 text-white/25 text-sm pointer-events-none select-none">✍️</span>
                    <textarea
                      value={reviewText}
                      onChange={e => setReviewText(e.target.value)}
                      placeholder="شارك تجربتك بمزيد من التفاصيل..."
                      maxLength={300}
                      rows={4}
                      dir="rtl"
                      className="w-full bg-transparent text-[13px] text-white/85 placeholder:text-white/25 resize-none px-4 pr-10 pt-3.5 pb-2 focus:outline-none leading-relaxed"
                    />
                    <div className="flex items-center justify-between px-4 pb-2.5">
                      <span className={`text-[10px] font-bold transition-colors ${reviewText.length > 250 ? "text-amber-400" : "text-white/25"}`}>
                        {reviewText.length}/300
                      </span>
                      {reviewText && (
                        <motion.button
                          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                          type="button"
                          onClick={() => setReviewText("")}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white/30 hover:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all"
                          aria-label="مسح التعليق"
                        >
                          مسح
                        </motion.button>
                      )}
                    </div>
                  </div>

                  {/* ملخص الاختيارات */}
                  {(rating > 0 || badges.length > 0) && (
                    <div className="mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                      <p className="text-[10px] font-bold text-white/30 mb-2 uppercase tracking-wider">ملخص تقييمك</p>
                      {rating > 0 && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className="flex gap-0.5" style={{ direction: "ltr" }}>
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} className={`w-3 h-3 ${s <= rating ? "text-amber-400 fill-amber-400" : "text-white/10"}`} />
                            ))}
                          </div>
                          <span className="text-[11px] text-white/50">{RATING_CONFIG[rating as keyof typeof RATING_CONFIG]?.text}</span>
                        </div>
                      )}
                      {badges.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {badges.map(id => {
                            const b = BADGES.find(b => b.id === id);
                            return b ? (
                              <span key={id} className="text-[10px] bg-[#5bdda6]/10 text-[#5bdda6] px-2 py-0.5 rounded-full border border-[#5bdda6]/25">
                                {b.emoji} {b.label}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── أزرار التنقل السفلية (ثابتة) ── */}
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ delay: 0.35, type: "spring", stiffness: 150, damping: 20 }}
        className="relative z-50 bg-[#070b13] border-t border-white/[0.06] shrink-0"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-stretch h-[58px]">
          {/* زر السابق / تخطي */}
          <button
            type="button"
            onClick={() => step > 0 ? setStep(s => s - 1) : onClose()}
            disabled={loading}
            className="w-[100px] h-full flex items-center justify-center text-[13px] font-bold text-white/40 bg-[#0a111c] hover:bg-[#0f192b] hover:text-white/60 transition-all border-t border-l border-white/[0.07] shrink-0"
          >
            {step > 0 ? "السابق" : "تخطي"}
          </button>

          {/* زر التالي / إرسال */}
          <button
            type="button"
            onClick={() => step < STEPS.length - 1 ? setStep(s => s + 1) : handleSubmit()}
            disabled={loading}
            className="flex-1 h-full flex items-center justify-center gap-2 text-[15px] font-black text-[#070b13] bg-[#5bdda6] shadow-[0_-4px_20px_rgba(91,221,166,0.2)] hover:bg-[#4ecf99] active:bg-[#34d399] transition-all border-t border-[#5bdda6]"
          >
            {loading
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : step < STEPS.length - 1
              ? <>التالي <span className="text-[#070b13]/60 font-medium">({step + 2}/{STEPS.length})</span></>
              : <><Send className="w-4 h-4 ml-1" /> إرسال التقييم</>
            }
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default RideCompletedScreen;
