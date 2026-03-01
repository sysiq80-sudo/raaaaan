import { useState, useEffect } from "react";
import { Wifi, WifiOff, Search, Loader2, PauseCircle, Coffee, Power } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { initAudioContext, resumeAudioContext } from "@/lib/audioContext";

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
}: StatusSearchBarProps) => {
  const [pulse, setPulse] = useState(false);

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

  const handleToggle = async () => {
    if (isDisabled) return;
    // تفعيل AudioContext عند أول تفاعل
    try {
      initAudioContext();
      resumeAudioContext();
    } catch {
      // silent
    }
    await onToggleOnline(!isOnline);
  };

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
          {/* شريط واحد: زر التفعيل + الحالة + الإيقاف المؤقت */}
          <div className="flex items-center justify-between px-2 py-2 gap-2">

            {/* ═══ زر التفعيل/الإطفاء (Power Toggle) — فقط عند ورود طلب ═══ */}
            {showPowerButton && (
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
            <div className="flex-1 flex flex-col items-start justify-center min-w-0 px-1">
              {/* Label + icon */}
              <div className="flex items-center gap-1.5">
                {isOnline ? (
                  isPaused ? <Coffee className={`w-3.5 h-3.5 ${statusColor}`} /> : <Wifi className={`w-3.5 h-3.5 ${statusColor}`} />
                ) : (
                  <WifiOff className={`w-3.5 h-3.5 ${statusColor}`} />
                )}
                <span className={`text-sm font-bold ${statusColor}`}>
                  {statusLabel}
                </span>
              </div>

              {/* Sublabel */}
              <div className="mt-0.5">
                {isPaused && isOnline ? (
                  <span className="text-[11px] text-amber-400/80 font-medium flex items-center gap-1">
                    <PauseCircle className="w-3 h-3" />
                    لن تصلك طلبات
                  </span>
                ) : isSearching && isOnline ? (
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full bg-amber-500 ${pulse ? "opacity-100" : "opacity-40"} transition-opacity`} />
                    <span className="text-[11px] text-amber-400/80 font-medium">بحث عن طلبات...</span>
                  </div>
                ) : isOnline && !locationTracking ? (
                  <span className="text-[11px] text-yellow-400/80 font-medium flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                    تفعيل الموقع...
                  </span>
                ) : isOnline ? (
                  <span className="text-[11px] text-emerald-400/80 font-medium flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    جاهز لاستقبال الطلبات
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    {driverStatus === "approved" ? "اضغط للاتصال" : "حسابك غير معتمد بعد"}
                  </span>
                )}
              </div>
            </div>

            {/* ═══ زر الإيقاف المؤقت (يمين) ═══ */}
            {isOnline && (
              <button
                onClick={onTogglePause}
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
            {!isOnline && (
              <div className="text-muted-foreground/30 shrink-0 pr-1">
                <Search className="w-4 h-4" />
              </div>
            )}
          </div>

          {/* Thin Border Bottom */}
          {isOnline && (isPaused ? (
            <div className="h-0.5 bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
          ) : isSearching ? (
            <div className="h-0.5 bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent animate-pulse" />
          ) : (
            <div className="h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
