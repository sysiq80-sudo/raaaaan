import { useEffect, useState } from "react";
import {
  CheckCircle, Route, Wallet, Clock, MapPin,
} from "lucide-react";
import SmartRatingFlow from "./SmartRatingFlow";
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

export const RideCompletedScreen = ({
  ride, driverName, onClose,
}: RideCompletedScreenProps) => {
  const [showRating, setShowRating] = useState(false);

  useEffect(() => {
    // كونفيتي احتفالي عند ظهور الشاشة
    const duration = 2800;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 3, angle: 60,  spread: 55, origin: { x: 0 }, colors: ["#10b981","#06b6d4","#fbbf24"] });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#10b981","#06b6d4","#fbbf24"] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();

    // فتح التقييم تلقائياً بعد 1.5 ثانية
    const t = setTimeout(() => setShowRating(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const fare = ride.final_fare || ride.estimated_fare || 0;
  const paymentLabel =
    ride.payment_method === "wallet" ? "محفظة" :
    ride.payment_method === "card"   ? "بطاقة" : "نقداً";

  return (
    <>
      {/* ═══ شاشة ملخص الرحلة ═══ */}
      <div
        className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden min-h-dvh"
        dir="rtl"
      >
        {/* الخلفية */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/60 via-slate-950/90 to-slate-950" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-emerald-500/8 rounded-full blur-3xl" />
        </div>

        {/* ── هيدر ── */}
        <div className="relative shrink-0 pt-10 pb-5 px-6 text-center">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.4)] mb-4"
          >
            <CheckCircle className="w-8 h-8 text-white" strokeWidth={2.5} />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <h1 className="text-xl font-black text-white tracking-tight">الحمد لله على السلامة! 🤲</h1>
            <p className="text-slate-400 text-sm mt-1">شكراً لاستخدامك ران</p>
          </motion.div>
        </div>

        {/* ── كارد الرحلة ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="relative mx-4"
        >
          <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-700/40 overflow-hidden">

            {/* السعر */}
            <div className="px-5 pt-5 pb-4 text-center border-b border-slate-700/30">
              <p className="text-xs text-slate-500 mb-1">المبلغ الإجمالي</p>
              <p className="text-4xl font-black text-emerald-400 tabular-nums tracking-tight">
                {fare.toLocaleString()}
                <span className="text-base font-semibold text-emerald-500/70 mr-2">د.ع</span>
              </p>
            </div>

            {/* الإحصائيات */}
            <div className="flex items-center divide-x divide-x-reverse divide-slate-700/30">
              <div className="flex-1 flex items-center justify-center gap-1.5 py-3.5">
                <Route className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-bold text-slate-300">{(ride.distance_km || 0).toFixed(1)} كم</span>
              </div>
              <div className="flex-1 flex items-center justify-center gap-1.5 py-3.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-bold text-slate-300">{ride.duration_minutes || 0} دقيقة</span>
              </div>
              <div className="flex-1 flex items-center justify-center gap-1.5 py-3.5">
                <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-bold text-slate-300">{paymentLabel}</span>
              </div>
            </div>

            {/* العناوين */}
            <div className="px-4 pb-4 pt-3 border-t border-slate-700/30">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex flex-col items-center gap-1 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                  <div className="w-px h-4 bg-gradient-to-b from-cyan-400/50 to-red-400/50" />
                  <MapPin className="w-2.5 h-2.5 text-red-400" />
                </div>
                <div className="flex-1 min-w-0 space-y-2.5">
                  <p className="text-xs text-slate-300 truncate">{ride.pickup_address  || "نقطة الانطلاق"}</p>
                  <p className="text-xs text-slate-300 truncate">{ride.dropoff_address || "الوجهة"}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── زر التقييم ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85 }}
          className="relative mt-auto shrink-0 px-4 pb-8 pt-4"
        >
          <button
            type="button"
            onClick={() => setShowRating(true)}
            className="w-full h-14 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:scale-[0.98] transition-all text-white font-black text-base shadow-[0_8px_30px_rgba(16,185,129,0.35)]"
          >
            ⭐ قيّم تجربتك مع {driverName}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-3 h-11 flex items-center justify-center text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors"
          >
            تخطي التقييم
          </button>
        </motion.div>
      </div>

      {/* ═══ Portal التقييم ═══ */}
      <AnimatePresence>
        {showRating && (
          <SmartRatingFlow
            rideId={ride.id}
            driverId={ride.driver_id}
            driverName={driverName}
            onComplete={onClose}
            onSkip={onClose}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default RideCompletedScreen;
