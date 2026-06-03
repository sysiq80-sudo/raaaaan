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
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(isOnline ? [100] : [50, 50, 150]);
    setPressing(true);
    try {
      await onToggle(!isOnline);
    } finally {
      setPressing(false);
    }
  };



  return (
    <div className="flex flex-col-reverse items-center gap-3 w-full">

      {/* ═══ الزر الرئيسي — نفس تنسيق زر "احجز الآن" ═══ */}
      {!hasActiveRide && (
        <div className="shrink-0 w-full pointer-events-auto bg-[#0a0f1c] border-t border-[#34d399]/10 relative z-[10] shadow-[0_-18px_34px_rgba(10,15,28,0.72)]" style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}>
          <div className="flex items-stretch h-[58px]">
            <button
              onClick={handlePress}
              disabled={isDisabled}
              style={{ fontFamily: "Cairo, sans-serif" }}
              className={`flex-1 h-full min-w-0 px-4 flex items-center justify-center gap-2 text-[14px] font-black leading-none touch-manipulation transition-colors duration-150 rounded-none ${
                isOnline
                  ? isPaused
                    ? "border-t border-amber-500/30 text-white bg-amber-500 hover:bg-amber-600 active:bg-amber-700"
                    : "border-t border-[#34d399]/30 text-[#064e3b] bg-[#34d399] hover:bg-[#2dd392] active:bg-[#10b981]"
                  : "border-t border-yellow-500/30 text-[#064e3b] bg-yellow-400 hover:bg-yellow-500 active:bg-yellow-600"
              }`}
              aria-label={isOnline ? (isPaused ? "استئناف استقبال الطلبات" : "قطع الاتصال") : "الاتصال واستقبال الطلبات"}
              aria-pressed={isOnline}
            >
              <AnimatePresence mode="sync">
                {isLoading ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-w-0 items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="truncate">جاري التحميل...</span>
                  </motion.div>
                ) : isPaused && isOnline ? (
                  <motion.div key="paused" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-w-0 items-center justify-center gap-2">
                    <Coffee className="w-4 h-4" strokeWidth={2.5} />
                    <span className="truncate">استئناف</span>
                  </motion.div>
                ) : isOnline ? (
                  <motion.div key="online" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-w-0 items-center justify-center gap-2">
                    <Wifi className="w-4 h-4" />
                    <span className="truncate">نشط - جاهز لاستقبال الطلبات</span>
                  </motion.div>
                ) : (
                  <motion.div key="offline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-w-0 items-center justify-center gap-2">
                    <Power className="w-4 h-4" strokeWidth={2.5} />
                    <span className="truncate">غير نشط - الطلبات لا تصلك الان</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
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
