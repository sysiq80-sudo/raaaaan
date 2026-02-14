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

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Power, Loader2, WifiOff, Wifi, Shield, PauseCircle, Coffee } from "lucide-react";
import { cn } from "@/lib/utils";
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
}: DutyToggleProps) => {
  const [pressing, setPressing] = useState(false);

  const isDisabled = isLoading || driverStatus !== "approved";
  const isApproved = driverStatus === "approved";

  const handlePress = async () => {
    if (isDisabled) return;
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

  const handlePausePress = async () => {
    if (isDisabled || !isOnline) return;
    // Haptic feedback for pause
    if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
    await onPauseToggle();
  };

  // الحالة الرئيسية: 3 حالات - متصل / مشغول / غير متصل
  const stateConfig = isOnline
    ? isPaused
      ? {
          // حالة الإيقاف المؤقت (Paused/Busy)
          bg: "bg-gradient-to-br from-amber-500 to-orange-600",
          glow: "shadow-[0_0_35px_rgba(245,158,11,0.45)]",
          ringColor: "border-amber-500/30",
          pulseColor: "bg-amber-500/20",
          textColor: "text-amber-400",
          label: "مشغول",
          sublabel: "إيقاف مؤقت - لن تصلك طلبات",
          icon: Coffee,
          borderColor: "border-amber-500/50",
        }
      : {
          // حالة الاتصال الكامل (Online)
          bg: "bg-gradient-to-br from-[#00E676] to-[#00C853]",
          glow: "shadow-[0_0_40px_rgba(0,230,118,0.5)]",
          ringColor: "border-[#00E676]/30",
          pulseColor: "bg-[#00E676]/20",
          textColor: "text-[#00E676]",
          label: "متصل",
          sublabel: isSearching ? "جاري البحث عن طلبات..." : locationTracking ? "جاهز لاستقبال الطلبات" : "تفعيل الموقع...",
          icon: Wifi,
          borderColor: "border-[#00E676]/50",
        }
    : {
        // حالة عدم الاتصال (Offline)
        bg: "bg-gradient-to-br from-gray-600 to-gray-700",
        glow: "shadow-[0_0_20px_rgba(107,114,128,0.3)]",
        ringColor: "border-gray-500/20",
        pulseColor: "bg-gray-500/10",
        textColor: "text-gray-400",
        label: "غير متصل",
        sublabel: isApproved ? "اضغط للاتصال" : "حسابك غير معتمد بعد",
        icon: WifiOff,
        borderColor: "border-gray-500/30",
      };

  const StatusIcon = stateConfig.icon;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* الزر الرئيسي العائم */}
      <div className="relative">
        {/* Pulse rings - فقط عند الاتصال الكامل (ليس عند الإيقاف المؤقت) */}
        <AnimatePresence>
          {isOnline && !isPaused && !isLoading && (
            <>
              <motion.div
                key="ring-1"
                className={cn("absolute inset-0 rounded-full border-2", stateConfig.ringColor)}
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 2.2, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
              />
              <motion.div
                key="ring-2"
                className={cn("absolute inset-0 rounded-full border-2", stateConfig.ringColor)}
                initial={{ scale: 1, opacity: 0.4 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.7 }}
              />
            </>
          )}
          {/* Slow pulse ring for paused state */}
          {isOnline && isPaused && !isLoading && (
            <motion.div
              key="ring-paused"
              className="absolute inset-0 rounded-full border-2 border-amber-500/25"
              initial={{ scale: 1, opacity: 0.4 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>

        {/* Glow Background */}
        <motion.div
          className={cn(
            "absolute inset-[-8px] rounded-full blur-xl transition-colors duration-500",
            isOnline 
              ? isPaused ? "bg-amber-500/20" : "bg-[#00E676]/25" 
              : "bg-gray-500/10"
          )}
          animate={{
            scale: isOnline && !isPaused ? [1, 1.15, 1] : 1,
            opacity: isOnline ? (isPaused ? 0.3 : [0.4, 0.7, 0.4]) : 0.2,
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Main Button */}
        <motion.button
          onClick={handlePress}
          disabled={isDisabled}
          whileTap={{ scale: isDisabled ? 1 : 0.9 }}
          whileHover={{ scale: isDisabled ? 1 : 1.05 }}
          animate={{
            scale: pressing ? 0.92 : 1,
          }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className={cn(
            "relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500",
            stateConfig.bg,
            stateConfig.glow,
            isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-95",
            "border-2",
            stateConfig.borderColor
          )}
          aria-label={isOnline ? (isPaused ? "استئناف استقبال الطلبات" : "قطع الاتصال") : "الاتصال واستقبال الطلبات"}
          aria-pressed={isOnline}
        >
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, rotate: -180 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 180 }}
                transition={{ duration: 0.3 }}
              >
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </motion.div>
            ) : isPaused && isOnline ? (
              <motion.div
                key="paused"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                <Coffee className="w-8 h-8 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" strokeWidth={2.5} />
              </motion.div>
            ) : (
              <motion.div
                key="power"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                <Power className={cn(
                  "w-8 h-8 transition-colors duration-300",
                  isOnline ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "text-gray-300"
                )} strokeWidth={2.5} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Inner ring highlight */}
          <div className={cn(
            "absolute inset-1 rounded-full border transition-colors duration-500",
            isOnline ? (isPaused ? "border-white/15" : "border-white/20") : "border-white/5"
          )} />
        </motion.button>
      </div>

      {/* Pause/Resume Button - يظهر فقط عند الاتصال */}
      <AnimatePresence>
        {isOnline && !isLoading && (
          <motion.button
            initial={{ opacity: 0, y: -10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={handlePausePress}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300",
              "border shadow-md active:scale-95",
              isPaused 
                ? "bg-[#00E676]/15 text-[#00E676] border-[#00E676]/30 hover:bg-[#00E676]/25" 
                : "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
            )}
            aria-label={isPaused ? "استئناف" : "إيقاف مؤقت"}
          >
            {isPaused ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span>استئناف</span>
              </>
            ) : (
              <>
                <PauseCircle className="w-3.5 h-3.5" />
                <span>إيقاف مؤقت</span>
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Status Label */}
      <motion.div
        className="text-center"
        animate={{ opacity: isLoading ? 0.5 : 1 }}
      >
        <motion.div
          key={stateConfig.label}
          initial={{ y: 5, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-center gap-1.5"
        >
          <StatusIcon className={cn("w-4 h-4", stateConfig.textColor)} />
          <span className={cn("text-sm font-bold", stateConfig.textColor)}>
            {stateConfig.label}
          </span>
        </motion.div>
        <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[160px]">
          {stateConfig.sublabel}
        </p>
      </motion.div>

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

export default DutyToggle;
