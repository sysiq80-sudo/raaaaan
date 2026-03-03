import React from "react";
import { roundFare } from "@/lib/constants";

type VehicleType = "economy" | "comfort" | "premium" | "women_only";

interface CompactVehicleSelectorProps {
  selectedVehicle: VehicleType;
  onSelect: (type: VehicleType) => void;
  baseFare?: number;
  availableDrivers?: Record<VehicleType, number>;
}

const vehicles: {
  type: VehicleType;
  name: string;
  multiplier: number;
  color: string;
  selectedBg: string;
  selectedBorder: string;
  selectedText: string;
}[] = [
  {
    type: "economy",
    name: "اقتصادي",
    multiplier: 1.0,
    color: "text-primary",
    selectedBg: "bg-primary/10",
    selectedBorder: "border-primary",
    selectedText: "text-primary",
  },
  {
    type: "comfort",
    name: "مريح",
    multiplier: 1.3,
    color: "text-blue-500",
    selectedBg: "bg-blue-500/10",
    selectedBorder: "border-blue-500",
    selectedText: "text-blue-600",
  },
  {
    type: "premium",
    name: "فاخر",
    multiplier: 1.6,
    color: "text-amber-500",
    selectedBg: "bg-amber-500/10",
    selectedBorder: "border-amber-500",
    selectedText: "text-amber-600",
  },
  {
    type: "women_only",
    name: "نسائي",
    multiplier: 1.2,
    color: "text-pink-500",
    selectedBg: "bg-pink-500/10",
    selectedBorder: "border-pink-500",
    selectedText: "text-pink-600",
  },
];

const CompactVehicleSelector = ({
  selectedVehicle,
  onSelect,
  baseFare,
  availableDrivers,
}: CompactVehicleSelectorProps) => {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {vehicles.map((v) => {
        const isSelected = selectedVehicle === v.type;
        const driverCount = availableDrivers?.[v.type] ?? 0;
        const isUnavailable = availableDrivers !== undefined && driverCount === 0;
        const fare = baseFare ? Math.round(baseFare * v.multiplier) : null;

        return (
          <button
            key={v.type}
            onClick={() => !isUnavailable && onSelect(v.type)}
            disabled={isUnavailable}
            className={`
              flex flex-col items-center justify-center py-2 px-1 rounded-xl border-2 transition-all duration-150
              ${isUnavailable
                ? "border-transparent bg-muted/30 opacity-40 cursor-not-allowed"
                : isSelected
                ? `${v.selectedBg} ${v.selectedBorder}`
                : "border-transparent bg-card hover:bg-muted/50"
              }
            `}
          >
            {/* اسم النوع */}
            <span
              className={`text-xs font-bold leading-tight ${
                isSelected ? v.selectedText : "text-foreground"
              }`}
            >
              {v.name}
            </span>

            {/* الأجرة */}
            {fare && !isUnavailable ? (
              <span
                className={`text-[10px] font-semibold mt-0.5 ${
                  isSelected ? v.selectedText : "text-muted-foreground"
                }`}
              >
                {roundFare(fare).toLocaleString()}
              </span>
            ) : isUnavailable ? (
              <span className="text-[9px] text-muted-foreground mt-0.5">غير متاح</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};

export default CompactVehicleSelector;
