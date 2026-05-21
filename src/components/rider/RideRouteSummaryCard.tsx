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
      className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
    >
      <div className="flex gap-3 items-stretch">
        {/* Vertical route line */}
        <div className="flex flex-col items-center pt-1 shrink-0">
          <div className="w-3 h-3 rounded-full bg-[#12B76A] border-2 border-white shadow-[0_0_0_2px_#12B76A33]" />
          <div className="w-0.5 flex-1 my-1 bg-gradient-to-b from-[#12B76A] via-gray-200 to-[#0A2F6E] rounded-full min-h-[28px]" />
          <div className="w-3 h-3 rounded-full bg-[#0A2F6E] border-2 border-white shadow-[0_0_0_2px_#0A2F6E33]" />
        </div>

        {/* Addresses */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Pickup */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-[#12B76A] uppercase tracking-wider mb-0.5">الانطلاق</p>
              <p className="text-sm font-semibold text-[#101828] line-clamp-1">{pickupAddress || "جاري التحديد..."}</p>
            </div>
            <button
              onClick={onEditPickup}
              className="text-[11px] font-semibold text-[#667085] hover:text-[#0A2F6E] px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
            >
              تغيير
            </button>
          </div>

          {/* Dropoff */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-[#0A2F6E] uppercase tracking-wider mb-0.5">الوجهة</p>
              <p className="text-sm font-semibold text-[#101828] line-clamp-1">{dropoffAddress || "جاري التحديد..."}</p>
            </div>
            <button
              onClick={onEditDropoff}
              className="text-[11px] font-semibold text-[#667085] hover:text-[#0A2F6E] px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
            >
              تغيير
            </button>
          </div>
        </div>

        {/* Swap button */}
        <div className="flex items-center shrink-0">
          <button
            onClick={onSwap}
            className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors active:scale-95"
            aria-label="عكس الاتجاه"
          >
            <ArrowUpDown className="w-4 h-4 text-[#667085]" />
          </button>
        </div>
      </div>

      {/* Distance & Duration chips */}
      {(distance || duration) && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
          {distance && (
            <div className="flex items-center gap-1.5 bg-[#0A2F6E]/5 text-[#0A2F6E] px-3 py-1.5 rounded-full">
              <Route className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">{distance.toFixed(1)} كم</span>
            </div>
          )}
          {duration && (
            <div className="flex items-center gap-1.5 bg-[#00B3B0]/8 text-[#00B3B0] px-3 py-1.5 rounded-full">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">{Math.ceil(duration)} دقيقة</span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default RideRouteSummaryCard;
