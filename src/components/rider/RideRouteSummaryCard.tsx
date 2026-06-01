import React from "react";
import { motion } from "framer-motion";
import { MapPin, Navigation, ArrowUpDown, Clock, Route } from "lucide-react";

interface RideRouteSummaryCardProps {
  pickupAddress: string;
  dropoffAddress: string;
  distance: number | null;
  duration: number | null;
  onEditPickup: () => void;
  onEditDropoff: () => void;
  onSwap: () => void;
}

/**
 * Clean route summary card with vertical route line (green → blue),
 * edit buttons, distance/duration chips, and swap button.
 */
const RideRouteSummaryCard: React.FC<RideRouteSummaryCardProps> = ({
  pickupAddress,
  dropoffAddress,
  distance,
  duration,
  onEditPickup,
  onEditDropoff,
  onSwap,
}) => {
  return (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.05 }}
      className="bg-card rounded-2xl border border-border/30 p-4 shadow-sm text-foreground"
    >
      {/* Distance & Duration chips — فوق العناوين */}
      {(distance || duration) && (
        <div className="flex items-center justify-center gap-2 mb-2 pb-2 border-b border-border/20">
          {distance && (
            <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-full">
              <Route className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">{distance.toFixed(1)} كم</span>
            </div>
          )}
          {duration && (
            <div className="flex items-center gap-1.5 bg-cyan-500/10 text-cyan-500 px-3 py-1.5 rounded-full">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">{Math.ceil(duration)} دقيقة</span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 items-stretch">
        {/* Vertical route line */}
        <div className="flex flex-col items-center pt-1 shrink-0">
          <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-card shadow-[0_0_0_2px_rgba(16,185,129,0.2)]" />
          <div className="w-0.5 flex-1 my-1 bg-gradient-to-b from-emerald-500 via-border/50 to-cyan-500 rounded-full min-h-[28px]" />
          <div className="w-3 h-3 rounded-full bg-cyan-500 border-2 border-card shadow-[0_0_0_2px_rgba(6,182,212,0.2)]" />
        </div>

        {/* Addresses */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Pickup */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-0.5">الانطلاق</p>
              <p className="text-[15px] font-extrabold text-foreground line-clamp-1">{pickupAddress || "جاري التحديد..."}</p>
            </div>
            <button
              onClick={onEditPickup}
              className="text-xs font-bold text-emerald-400 bg-[#5bdda6]/15 hover:bg-[#5bdda6]/25 hover:text-emerald-300 px-2.5 py-1 rounded-lg transition-colors shrink-0"
            >
              تغيير
            </button>
          </div>

          {/* Dropoff */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-cyan-500 uppercase tracking-wider mb-0.5">الوجهة</p>
              <p className="text-[15px] font-extrabold text-foreground line-clamp-1">{dropoffAddress || "جاري التحديد..."}</p>
            </div>
            <button
              onClick={onEditDropoff}
              className="text-xs font-bold text-emerald-400 bg-[#5bdda6]/15 hover:bg-[#5bdda6]/25 hover:text-emerald-300 px-2.5 py-1 rounded-lg transition-colors shrink-0"
            >
              تغيير
            </button>
          </div>
        </div>

        {/* Swap button */}
        <div className="flex items-center shrink-0">
          <button
            onClick={onSwap}
            className="w-9 h-9 rounded-xl bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors active:scale-95"
            aria-label="عكس الاتجاه"
          >
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default RideRouteSummaryCard;
