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
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-200 min-h-[56px] text-right ${
        isUnavailable
          ? "border-border/30 bg-muted/20 opacity-50 cursor-not-allowed"
          : isSelected
          ? "border-ring bg-ring/5 shadow-glow-sm"
          : "border-border/40 bg-card hover:border-ring/30 hover:bg-secondary/40 active:scale-[0.98]"
      }`}
    >
      {/* Emoji icon */}
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 transition-colors ${
        isSelected ? "bg-ring/10" : "bg-secondary"
      }`}>
        {VEHICLE_EMOJI[type]}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`text-sm font-bold ${isSelected ? "text-ring" : "text-foreground"}`}>
            {name}
          </p>
          {driverCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              <Users className="w-2.5 h-2.5" />
              {driverCount}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{description}</p>
      </div>

      {/* Price + check */}
      <div className="flex items-center gap-2 shrink-0">
        {fare && !isUnavailable ? (
          <span className={`text-sm font-bold ${isSelected ? "text-ring" : "text-foreground"}`}>
            {roundFare(fare).toLocaleString()}
            <span className="text-[10px] font-medium text-muted-foreground mr-0.5">د.ع</span>
          </span>
        ) : isUnavailable ? (
          <span className="text-[11px] text-muted-foreground">غير متاح</span>
        ) : null}

        {isSelected && (
          <div className="w-5 h-5 rounded-full bg-ring flex items-center justify-center">
            <Check className="w-3 h-3 text-primary-foreground" />
          </div>
        )}
      </div>
    </button>
  );
};

export default VehicleOptionCard;
