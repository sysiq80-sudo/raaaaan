import React from "react";
import { Check, Users } from "lucide-react";
import { roundFare } from "@/lib/constants";

type VehicleType = "economy" | "comfort" | "premium" | "women_only";

interface VehicleOptionCardProps {
  type: VehicleType;
  name: string;
  description: string;
  fare: number | null;
  driverCount: number;
  isSelected: boolean;
  onSelect: () => void;
}

const VEHICLE_EMOJI: Record<VehicleType, string> = {
  economy: "🚗",
  comfort: "🚙",
  premium: "✨",
  women_only: "🌸",
};

/**
 * Modern selectable vehicle card — inline style (not a sheet).
 * Selected state has a strong accent border and soft background.
 */
const VehicleOptionCard: React.FC<VehicleOptionCardProps> = ({
  type,
  name,
  description,
  fare,
  driverCount,
  isSelected,
  onSelect,
}) => {
  const isUnavailable = driverCount === 0;

  return (
    <button
      onClick={onSelect}
      disabled={isUnavailable}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all duration-200 min-h-[64px] text-right ${
        isUnavailable
          ? "border-gray-100 bg-gray-50/50 opacity-50 cursor-not-allowed"
          : isSelected
          ? "border-[#00B3B0] bg-[#00B3B0]/5 shadow-sm"
          : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50/50 active:scale-[0.98]"
      }`}
    >
      {/* Emoji icon */}
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${
        isSelected ? "bg-[#00B3B0]/10" : "bg-gray-50"
      }`}>
        {VEHICLE_EMOJI[type]}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`text-sm font-bold ${isSelected ? "text-[#0A2F6E]" : "text-[#101828]"}`}>
            {name}
          </p>
          {driverCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-[#667085] bg-gray-100 px-1.5 py-0.5 rounded-full">
              <Users className="w-2.5 h-2.5" />
              {driverCount}
            </span>
          )}
        </div>
        <p className="text-[11px] text-[#667085] mt-0.5 line-clamp-1">{description}</p>
      </div>

      {/* Price + check */}
      <div className="flex items-center gap-2 shrink-0">
        {fare && !isUnavailable ? (
          <span className={`text-sm font-bold ${isSelected ? "text-[#00B3B0]" : "text-[#101828]"}`}>
            {roundFare(fare).toLocaleString()}
            <span className="text-[10px] font-medium text-[#667085] mr-0.5">د.ع</span>
          </span>
        ) : isUnavailable ? (
          <span className="text-[11px] text-[#667085]">غير متاح</span>
        ) : null}

        {isSelected && (
          <div className="w-5 h-5 rounded-full bg-[#00B3B0] flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
    </button>
  );
};

export default VehicleOptionCard;
