import { Bookmark, Loader2, Navigation } from "lucide-react";
import { motion } from "framer-motion";

interface LocationSelectionActionBarProps {
  savedPlacesOpen: boolean;
  hasAddress: boolean;
  selectionReady: boolean;
  isPickup: boolean;
  isCheckingService: boolean;
  isConfirming: boolean;
  confirmButtonLabel: string;
  onToggleSavedPlaces: () => void;
  onConfirm: () => void;
}

const LocationSelectionActionBar = ({
  savedPlacesOpen,
  hasAddress,
  selectionReady,
  isPickup,
  isCheckingService,
  isConfirming,
  confirmButtonLabel,
  onToggleSavedPlaces,
  onConfirm,
}: LocationSelectionActionBarProps) => {
  const confirmDisabled = !hasAddress || isCheckingService || isConfirming;

  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex z-[100] gap-2 p-3 bg-[linear-gradient(180deg,rgba(7,17,31,0),rgba(7,17,31,0.94)_36%,rgba(7,17,31,0.99)_100%)]"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom, 24px), 24px)" }}
    >
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onToggleSavedPlaces}
        className="w-[72px] shrink-0 flex flex-col items-center justify-center gap-1 bg-[#0f2922] border border-[#34d399]/20 transition-all hover:bg-[#5bdda6]/10 h-[72px] rounded-[18px]"
        title="الأماكن المحفوظة"
        aria-label="عرض الأماكن المحفوظة"
      >
        <Bookmark className={`w-6 h-6 transition-colors ${savedPlacesOpen ? "text-[#5bdda6] fill-[#5bdda6]/30" : "text-[#5bdda6]/70"}`} />
        <span className="text-[10px] font-bold text-[#5bdda6]/75">المحفوظة</span>
      </motion.button>

      <motion.button
        onClick={onConfirm}
        disabled={confirmDisabled}
        whileTap={confirmDisabled ? {} : { scale: 0.98 }}
        style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
        className={`flex-auto h-[72px] rounded-[18px] border flex items-center justify-center gap-2 text-lg font-black transition-all duration-300 touch-manipulation shadow-[0_12px_28px_rgba(0,0,0,0.22)] ${
          selectionReady
            ? isPickup
              ? "bg-gradient-to-r from-[#7cf0bd] via-[#5bdda6] to-[#27b481] text-[#064e3b] border-emerald-400/30 hover:brightness-105 active:brightness-95"
              : "bg-gradient-to-r from-[#5fd0ff] via-[#38bdf8] to-[#0ea5e9] text-white border-sky-400/30 hover:brightness-105 active:brightness-95"
            : "bg-slate-800 text-slate-500 cursor-not-allowed"
        }`}
      >
        {isCheckingService || isConfirming ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin ml-1" />
            <span>{isConfirming ? "جاري التأكيد..." : "جاري التحقق..."}</span>
          </>
        ) : !hasAddress ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin ml-1 text-slate-500" />
            <span>جاري تحديد العنوان...</span>
          </>
        ) : (
          <>
            <Navigation className="w-6 h-6 ml-1" />
            <span className="tracking-tight">{confirmButtonLabel}</span>
          </>
        )}
      </motion.button>
    </div>
  );
};

export default LocationSelectionActionBar;
