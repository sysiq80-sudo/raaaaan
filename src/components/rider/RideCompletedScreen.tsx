import { useEffect } from "react";
import {
  CheckCircle,
  Route,
  Wallet,
  Clock,
  Star,
} from "lucide-react";
import SmartRatingFlow from "./SmartRatingFlow";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";

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
  ride,
  driverName,
  onClose,
}: RideCompletedScreenProps) => {
  // Trigger confetti on mount
  useEffect(() => {
    const duration = 2500;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#10b981", "#06b6d4", "#fbbf24"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ["#10b981", "#06b6d4", "#fbbf24"],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  const fare = ride.final_fare || ride.estimated_fare || 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col h-[100dvh] overflow-hidden" dir="rtl">

      {/* ═══ خلفية متدرجة مع Pattern ═══ */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/50 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* ═══ المحتوى القابل للسحب ═══ */}
      <div className="relative flex-1 flex flex-col overflow-y-auto scrollbar-hide">

        {/* ═══ الهيدر — أيقونة النجاح ═══ */}
        <div className="pt-12 pb-6 px-6 text-center space-y-4 shrink-0">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
            className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.3)]"
          >
            <CheckCircle className="w-10 h-10 text-white" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-1"
          >
            <h1 className="text-2xl font-black text-white">
              الحمد لله على السلامة! 🤲
            </h1>
            <p className="text-slate-400 text-sm">شكراً لاستخدامك ران</p>
          </motion.div>
        </div>

        {/* ═══ كارد ملخص الأجرة ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="px-5 mb-4 shrink-0"
        >
          <div className="bg-slate-900/80 backdrop-blur-md rounded-[1.5rem] border border-slate-700/40 p-5 shadow-[0_8px_32px_rgba(16,185,129,0.08)]">
            {/* المبلغ */}
            <div className="text-center mb-4">
              <p className="text-xs text-slate-400 mb-1">المبلغ الإجمالي</p>
              <p className="text-3xl font-black text-emerald-400 tabular-nums">
                {fare.toLocaleString()} <span className="text-lg">د.ع</span>
              </p>
            </div>

            {/* شارات المعلومات */}
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-800/60 rounded-full px-3 py-2">
                <Route className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-bold text-slate-300">
                  {(ride.distance_km || 0).toFixed(1)} كم
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-800/60 rounded-full px-3 py-2">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-bold text-slate-300">
                  {ride.duration_minutes || 0} دقيقة
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-800/60 rounded-full px-3 py-2">
                <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-bold text-slate-300">
                  {ride.payment_method === "wallet" ? "محفظة" : ride.payment_method === "card" ? "بطاقة" : "نقداً"}
                </span>
              </div>
            </div>

            {/* المسار */}
            <div className="mt-4 pt-4 border-t border-slate-700/40">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center gap-0.5 shrink-0">
                  <div className="w-3 h-3 rounded-full bg-cyan-500 border-2 border-cyan-800" />
                  <div className="w-0.5 h-5 bg-gradient-to-b from-cyan-500 to-red-500" />
                  <div className="w-3 h-3 rounded-full bg-red-500/70 border-2 border-red-800/50" />
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <p className="text-sm text-slate-300 truncate">{ride.pickup_address}</p>
                  <p className="text-sm text-slate-300 truncate">{ride.dropoff_address}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ═══ كارد التقييم ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="px-5 pb-8 flex-1"
        >
          <div className="bg-slate-900/80 backdrop-blur-md rounded-[1.5rem] border border-slate-700/40 p-5 shadow-[0_8px_32px_rgba(16,185,129,0.08)]">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
              <h2 className="text-base font-bold text-white">قيّم تجربتك مع {driverName}</h2>
            </div>
            <SmartRatingFlow
              rideId={ride.id}
              driverId={ride.driver_id}
              driverName={driverName}
              onComplete={onClose}
              onSkip={onClose}
            />
          </div>
        </motion.div>

      </div>
    </div>
  );
};

export default RideCompletedScreen;
