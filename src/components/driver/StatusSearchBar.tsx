import { useState, useEffect } from "react";
import { Wifi, WifiOff, Search, Loader2, PauseCircle, Coffee, Power } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { initAudioContext, resumeAudioContext } from "@/lib/audioContext";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatusSearchBarProps {
  isOnline: boolean;
  isPaused: boolean;
  isSearching: boolean;
  onToggleOnline: (online: boolean) => Promise<void>;
  onTogglePause: () => Promise<void>;
  isLoading: boolean;
  locationTracking: boolean;
  driverStatus?: string;
  showPowerButton?: boolean;
  hasRideRequest?: boolean;
}

export const StatusSearchBar = ({
  isOnline,
  isPaused,
  isSearching,
  onToggleOnline,
  onTogglePause,
  isLoading,
  locationTracking,
  driverStatus = "approved",
  showPowerButton = false,
  hasRideRequest = false,
}: StatusSearchBarProps) => {
  const [pulse, setPulse] = useState(false);
  const [pressing, setPressing] = useState(false);

  // Pulse animation for search state
  useEffect(() => {
    if (!isSearching) {
      setPulse(false);
      return;
    }

    const interval = setInterval(() => {
      setPulse((prev) => !prev);
    }, 1000);

    return () => clearInterval(interval);
  }, [isSearching]);

  const isDisabled = isLoading || driverStatus !== "approved";
  const isApproved = driverStatus === "approved";

  const handleToggle = async () => {
    if (isDisabled) return;
    // تفعيل AudioContext عند أول تفاعل
    try {
      initAudioContext();
      resumeAudioContext();
    } catch {
      // silent
    }
    setPressing(true);
    try {
      await onToggleOnline(!isOnline);
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
        // حالة عدم الاتصال (Offline) - أصفر
        bg: "bg-gradient-to-br from-yellow-500 to-yellow-600",
        glow: "shadow-[0_0_20px_rgba(234,179,8,0.3)]",
        ringColor: "border-yellow-500/20",
        pulseColor: "bg-yellow-500/10",
        textColor: "text-yellow-400",
        label: "غير متصل",
        sublabel: isApproved ? "اضغط للاتصال والبحث عن طلبات" : "حسابك غير معتمد بعد",
        icon: WifiOff,
        borderColor: "border-yellow-500/30",
      };

  const StatusIcon = stateConfig.icon;

  // الحالة الحالية
  const statusLabel = isOnline ? (isPaused ? "مشغول" : "متصل") : "غير متصل";
  const statusColor = isOnline
    ? isPaused
      ? "text-amber-500"
      : "text-emerald-500"
    : "text-slate-400";

  return (
    <Card className="border-none shadow-lg rounded-2xl overflow-hidden">
      <CardContent className="p-0">
        <div
          className={`transition-all duration-300 ${
            isOnline
              ? isPaused
                ? "bg-gradient-to-r from-amber-900/20 via-amber-800/5 to-background"
                : "bg-gradient-to-r from-emerald-900/20 via-emerald-800/5 to-background"
              : "bg-gradient-to-r from-slate-800/30 via-slate-800/10 to-background"
          }`}
        >
          {/* شريط واحد: زر DutyToggle الكبير + معلومات الحالة */}
          <div className="flex items-center justify-between px-4 py-4 gap-4">

            {/* ═══ زر DutyToggle الكبير (يسار) ═══ */}
            {!hasRideRequest && (
              <div className="relative flex-shrink-0">
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
                  onClick={handleToggle}
                  disabled={isDisabled}
                  whileTap={{ scale: isDisabled ? 1 : 0.9 }}
                  whileHover={{ scale: isDisabled ? 1 : 1.05 }}
                  animate={{
                    scale: pressing ? 0.92 : 1,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className={cn(
                    "relative z-10 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500",
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
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </motion.div>
                    ) : isPaused && isOnline ? (
                      <motion.div
                        key="paused"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      >
                        <Coffee className="w-6 h-6 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" strokeWidth={2.5} />
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
                          "w-6 h-6 transition-colors duration-300",
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
            )}

            {/* ═══ زر Power الصغير (فقط عند ورود طلب) ═══ */}
            {showPowerButton && hasRideRequest && (
              <button
                onClick={handleToggle}
                disabled={isDisabled}
                className={`
                  relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 shrink-0
                  ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-90"}
                  ${
                    isOnline
                      ? isPaused
                        ? "bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-500/30"
                        : "bg-gradient-to-br from-emerald-500 to-green-600 shadow-md shadow-emerald-500/30"
                      : "bg-gradient-to-br from-slate-500 to-slate-600 shadow-md shadow-slate-500/20"
                  }
                `}
                aria-label={isOnline ? "قطع الاتصال" : "الاتصال"}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : isOnline && isPaused ? (
                  <Coffee className="w-5 h-5 text-white" />
                ) : (
                  <Power className={`w-5 h-5 ${isOnline ? "text-white" : "text-slate-300"}`} />
                )}

                {/* Pulse ring when online */}
                {isOnline && !isPaused && !isLoading && (
                  <span className="absolute inset-0 rounded-xl border-2 border-emerald-400/40 animate-ping" />
                )}
              </button>
            )}

            {/* ═══ معلومات الحالة (الوسط) ═══ */}
            <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-2">
              {/* Label + icon */}
              <div className="flex items-center gap-1.5">
                {isOnline ? (
                  isPaused ? <Coffee className={`w-4 h-4 ${stateConfig.textColor}`} /> : <Wifi className={`w-4 h-4 ${stateConfig.textColor}`} />
                ) : (
                  <WifiOff className={`w-4 h-4 ${stateConfig.textColor}`} />
                )}
                <span className={`text-sm font-bold ${stateConfig.textColor}`}>
                  {stateConfig.label}
                </span>
              </div>

              {/* Sublabel */}
              <div className="mt-1">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full bg-amber-500 ${pulse ? "opacity-100" : "opacity-40"} transition-opacity`} />
                  <span className="text-[11px] text-amber-400/80 font-medium">
                    {isSearching ? "جاري البحث عن الطلبات..." : stateConfig.sublabel}
                  </span>
                </div>
              </div>
            </div>

            {/* ═══ زر الإيقاف المؤقت (يمين) ═══ */}
            {isOnline && (
              <button
                onClick={handlePausePress}
                className={`
                  flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-300 shrink-0 text-xs font-semibold
                  ${
                    isPaused
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                      : "bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25"
                  }
                `}
                aria-label={isPaused ? "استئناف" : "إيقاف مؤقت"}
              >
                {isPaused ? (
                  <>
                    <Wifi className="w-3.5 h-3.5" />
                    استئناف
                  </>
                ) : (
                  <>
                    <PauseCircle className="w-3.5 h-3.5" />
                    إيقاف
                  </>
                )}
              </button>
            )}

            {/* أيقونة بحث عندما يكون غير متصل */}
            {!isOnline && !hasRideRequest && (
              <div className="text-muted-foreground/30 shrink-0 pr-1">
                <Search className="w-4 h-4" />
              </div>
            )}
          </div>

          {/* Thin Border Bottom */}
          {isOnline && (isPaused ? (
            <div className="h-0.5 bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
          ) : (
            <div className="h-0.5 bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent animate-pulse" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
