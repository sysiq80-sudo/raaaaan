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
import { Power, Loader2, WifiOff, Wifi, Shield, PauseCircle, Coffee, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import { initAudioContext, resumeAudioContext } from "@/lib/audioContext";
import { Card, CardContent } from "@/components/ui/card";

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
  showPowerButton = false,
  driverLocation = null,
  maxPickupRadius = 10,
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

  return (
    <div className="flex flex-col items-center gap-3">

      {/* ═══ الزر الرئيسي ═══ */}
      <div className="relative">
        {/* Pulse rings */}
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

        {/* Glow */}
        <motion.div
          className={cn(
            "absolute inset-[-8px] rounded-full blur-xl transition-colors duration-500",
            isOnline ? (isPaused ? "bg-amber-500/20" : "bg-[#00E676]/25") : "bg-gray-500/10"
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
          animate={{ scale: pressing ? 0.92 : 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className={cn(
            "relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500",
            stateConfig.bg, stateConfig.glow,
            isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-95",
            "border-2", stateConfig.borderColor
          )}
          aria-label={isOnline ? (isPaused ? "استئناف استقبال الطلبات" : "قطع الاتصال") : "الاتصال واستقبال الطلبات"}
          aria-pressed={isOnline}
        >
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </motion.div>
            ) : isPaused && isOnline ? (
              <motion.div key="paused" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ type: "spring", stiffness: 500, damping: 25 }}>
                <Coffee className="w-8 h-8 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" strokeWidth={2.5} />
              </motion.div>
            ) : (
              <motion.div key="power" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ type: "spring", stiffness: 500, damping: 25 }}>
                <Power className={cn("w-8 h-8 transition-colors duration-300", isOnline ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "text-gray-300")} strokeWidth={2.5} />
              </motion.div>
            )}
          </AnimatePresence>
          <div className={cn("absolute inset-1 rounded-full border transition-colors duration-500", isOnline ? (isPaused ? "border-white/15" : "border-white/20") : "border-white/5")} />
        </motion.button>
      </div>

      {/* ═══ كارد الحالة — يختفي بالكامل عند ورود طلب رحلة ═══ */}
      {isApproved && !hasRideRequest && (
        <AnimatePresence mode="wait">
          <motion.div
            key={isOnline ? (isPaused ? "paused" : isSearching ? "searching" : "online") : "offline"}
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-sm"
          >
            <Card className="border border-border/30 shadow-md rounded-2xl overflow-hidden">
              <CardContent className="p-0">

                {/* ── حالة البحث الفعّال ── */}
                {isOnline && !isPaused && isSearching && !isDisabled ? (
                  <div className="px-4 py-3 bg-emerald-950/30">
                    <div className="flex items-center gap-3">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0"
                      >
                        <Navigation className="w-4 h-4 text-emerald-400" />
                      </motion.div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-emerald-300 leading-tight">جاري البحث عن طلبات</p>
                        <p className="text-xs text-emerald-400/60 mt-0.5">
                          {driverLocation ? `نطاق ${maxPickupRadius} كم` : "جاري تحديد الموقع..."}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {[0, 0.25, 0.5].map((delay, i) => (
                          <motion.div
                            key={i}
                            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1.2, repeat: Infinity, delay }}
                            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                          />
                        ))}
                      </div>
                    </div>
                    <div className="mt-2.5 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
                  </div>

                /* ── متصل لكن لم يبدأ البحث بعد ── */
                ) : isOnline && !isPaused ? (
                  <div className="px-4 py-3 bg-emerald-950/20">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                        <Wifi className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-emerald-300 leading-tight">متصل</p>
                        <p className="text-xs text-emerald-400/60 mt-0.5">
                          {locationTracking ? "جاهز لاستقبال الطلبات" : "جاري تفعيل الموقع..."}
                        </p>
                      </div>
                      <button
                        onClick={handlePausePress}
                        disabled={isDisabled}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-semibold hover:bg-amber-500/25 active:scale-95 transition-all shrink-0"
                        aria-label="إيقاف مؤقت"
                      >
                        <PauseCircle className="w-3.5 h-3.5" />
                        إيقاف
                      </button>
                    </div>
                  </div>

                /* ── إيقاف مؤقت ── */
                ) : isOnline && isPaused ? (
                  <div className="px-4 py-3 bg-amber-950/25">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                        <Coffee className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-amber-300 leading-tight">إيقاف مؤقت</p>
                        <p className="text-xs text-amber-400/60 mt-0.5">لن تصلك طلبات جديدة</p>
                      </div>
                      <button
                        onClick={handlePausePress}
                        disabled={isDisabled}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 active:scale-95 transition-all shrink-0"
                        aria-label="استئناف"
                      >
                        <Wifi className="w-3.5 h-3.5" />
                        استئناف
                      </button>
                    </div>
                    <div className="mt-2.5 h-px bg-gradient-to-r from-transparent via-amber-500/35 to-transparent" />
                  </div>

                /* ── غير متصل ── */
                ) : (
                  <div className="px-4 py-3 bg-slate-800/25">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-500/15 border border-slate-500/20 flex items-center justify-center shrink-0">
                        <WifiOff className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-300 leading-tight">غير متصل</p>
                        <p className="text-xs text-slate-400/60 mt-0.5">
                          {isApproved ? "اضغط الزر للاتصال" : "حسابك غير معتمد بعد"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
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

export default DutyToggle;
