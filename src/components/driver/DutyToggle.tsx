/**
 * ران - زر التبديل بين متصل/مشغول/غير متصل (Duty Toggle)
 * Floating Go Online/Paused/Offline button with dynamic animations
 * Features: 3-state toggle, Pulse rings, status glow, smooth transitions, haptic feedback
 * 
 * الحالات الثلاث:
 * 1. Online (أخضر) - متصل ويستقبل الطلبات
 * 2. Paused (برتقالي) - متصل لكن لا يستقبل طلبات جديدة
 * 3. Offline (رمادي) - غير متصل
 */

import { useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Power, Loader2, Wifi, Shield, Coffee } from "lucide-react";
import { initAudioContext, resumeAudioContext } from "@/lib/audioContext";

interface DutyToggleProps {
  isOnline: boolean;
  isPaused: boolean;
  isLoading: boolean;
  isSearching: boolean;
  driverStatus?: string | null;
  locationTracking: boolean;
  onToggle: (online: boolean) => Promise<void>;
  onPauseToggle: () => Promise<void>;
  hasRideRequest?: boolean;
  hasActiveRide?: boolean;
  showPowerButton?: boolean;
  driverLocation?: { lat: number; lng: number } | null;
  maxPickupRadius?: number;
}

const DutyToggle = ({
  isOnline,
  isPaused,
  isLoading,
  isSearching,
  driverStatus = "approved",
  locationTracking,
  onToggle,
  onPauseToggle,
  hasRideRequest = false,
  hasActiveRide = false,
  driverLocation = null,
  maxPickupRadius = 10,
}: DutyToggleProps) => {
  const [pressing, setPressing] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);

  const isDisabled = isLoading || driverStatus !== "approved";
  const isApproved = driverStatus === "approved";

  const handlePress = async () => {
    setClickCount(prev => prev + 1);
    if (isDisabled) {
      return;
    }
    // تهيئة AudioContext عند أول تفاعل مستخدم (Go Online)
    initAudioContext();
    resumeAudioContext();

    if (isOnline) {
      // إظهار نافذة تأكيد قبل قطع الاتصال
      setShowConfirm(true);
    } else {
      // Haptic feedback للاتصال المباشر
      if (navigator.vibrate) navigator.vibrate([50, 50, 150]);
      performToggle();
    }
  };

  const performToggle = async () => {
    setPressing(true);
    try {
      await onToggle(!isOnline);
    } finally {
      setPressing(false);
    }
  };

  const handleConfirmOffline = () => {
    setShowConfirm(false);
    if (navigator.vibrate) navigator.vibrate([100]);
    performToggle();
  };



  return (
    <div className="flex flex-col-reverse items-center gap-3 w-full">

      {/* ═══ الزر الرئيسي — نفس تنسيق زر "احجز الآن" ═══ */}
      {!hasActiveRide && (
        <div className="shrink-0 w-full pointer-events-auto relative z-[10] shadow-[0_-18px_34px_rgba(10,15,28,0.72)]">
          <button
            onClick={handlePress}
            disabled={isDisabled}
            style={{
              fontFamily: "Cairo, sans-serif",
              paddingTop: "26px",
              paddingBottom: "calc(26px + var(--safe-area-bottom, 0px))"
            }}
            className={`w-full min-w-0 px-4 flex items-center justify-center gap-2 text-[18px] font-black leading-normal touch-manipulation transition-all duration-150 rounded-none ${
              isOnline
                ? isPaused
                  ? "border-t border-amber-500/30 text-white bg-amber-500 hover:bg-amber-600 active:bg-amber-700"
                  : "border-t border-emerald-500/20 text-[#34d399] bg-[#0f2922] hover:bg-[#163d30] active:bg-[#0c261e]"
                : "border-t border-yellow-500/30 text-[#064e3b] bg-yellow-400 hover:bg-yellow-500 active:bg-yellow-600"
            }`}
            aria-label={isOnline ? (isPaused ? "استئناف استقبال الطلبات" : "قطع الاتصال") : "الاتصال واستقبال الطلبات"}
            aria-pressed={isOnline}
          >
            {isPaused && isOnline ? (
              <div className="flex min-w-0 items-center justify-center gap-2 w-full text-center">
                <Coffee className="w-4 h-4" strokeWidth={2.5} />
                <span className="truncate text-center">استئناف</span>
              </div>
            ) : isOnline ? (
              <div className="flex min-w-0 items-center justify-center gap-2 w-full text-center">
                <Wifi className="w-4 h-4" />
                <span className="truncate text-white text-center">نشط - جاهز لاستقبال الطلبات</span>
              </div>
            ) : (
              <div className="flex min-w-0 items-center justify-center gap-2 w-full text-center">
                <Power className="w-4 h-4" strokeWidth={2.5} />
                <span className="truncate text-center">غير نشط - الطلبات لا تصلك الان</span>
              </div>
            )}
          </button>
        </div>
      )}



      {/* حالة غير معتمد */}
      {!isApproved && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg"
        >
          <Shield className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs text-amber-500 font-medium">
            {driverStatus === "pending" ? "قيد المراجعة" : driverStatus === "rejected" ? "مرفوض" : "موقوف"}
          </span>
        </motion.div>
      )}

      {/* نافذة تأكيد قطع الاتصال */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            {/* Content Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-sm overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-b from-[#181d2a] to-[#0f131e] p-6 shadow-2xl z-10"
              style={{ fontFamily: "Cairo, sans-serif" }}
            >
              {/* Decorative background glow */}
              <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full bg-rose-500/10 blur-xl pointer-events-none" />

              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
                  <Power className="w-6 h-6 text-rose-400" />
                </div>
                
                <h3 className="text-lg font-black text-white mb-2">تأكيد قطع الاتصال</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-6">
                  هل أنت متأكد من رغبتك في قطع الاتصال؟ لن تتمكن من استقبال طلبات رحلات جديدة حتى تقوم بإعادة الاتصال بالشبكة.
                </p>
                
                <div className="flex flex-col gap-2 w-full">
                  <button
                    onClick={handleConfirmOffline}
                    className="w-full h-11 flex items-center justify-center rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm transition-colors"
                  >
                    تأكيد قطع الاتصال
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="w-full h-11 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 font-bold text-sm transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(DutyToggle, (prevProps, nextProps) => {
  return (
    prevProps.isOnline === nextProps.isOnline &&
    prevProps.isPaused === nextProps.isPaused &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.isSearching === nextProps.isSearching &&
    prevProps.driverStatus === nextProps.driverStatus &&
    prevProps.locationTracking === nextProps.locationTracking &&
    prevProps.onToggle === nextProps.onToggle &&
    prevProps.onPauseToggle === nextProps.onPauseToggle &&
    prevProps.hasRideRequest === nextProps.hasRideRequest &&
    prevProps.hasActiveRide === nextProps.hasActiveRide &&
    prevProps.maxPickupRadius === nextProps.maxPickupRadius &&
    // نتأكد فقط من وجود الموقع أو عدمه، التجاهل يمنع الوميض!
    !!prevProps.driverLocation === !!nextProps.driverLocation
  );
});
