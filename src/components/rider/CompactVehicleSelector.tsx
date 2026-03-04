import React, { useMemo } from "react";
import { roundFare } from "@/lib/constants";
import { useVehicleTypes, type VehicleTypeKey } from "@/hooks/useVehicleTypes";

interface CompactVehicleSelectorProps {
  selectedVehicle: VehicleTypeKey;
  onSelect: (type: VehicleTypeKey) => void;
  baseFare?: number;
  availableDrivers?: Record<VehicleTypeKey, number>;
}

// ألوان CSS لكل نوع مركبة
const VEHICLE_COLORS: Record<string, { color: string; selectedBg: string; selectedBorder: string; selectedText: string }> = {
  economy: {
    color: "text-primary",
    selectedBg: "bg-primary/10",
    selectedBorder: "border-primary",
    selectedText: "text-primary",
  },
  comfort: {
    color: "text-blue-500",
    selectedBg: "bg-blue-500/10",
    selectedBorder: "border-blue-500",
    selectedText: "text-blue-600",
  },
  premium: {
    color: "text-amber-500",
    selectedBg: "bg-amber-500/10",
    selectedBorder: "border-amber-500",
    selectedText: "text-amber-600",
  },
  women_only: {
    color: "text-pink-500",
    selectedBg: "bg-pink-500/10",
    selectedBorder: "border-pink-500",
    selectedText: "text-pink-600",
  },
};

const DEFAULT_COLORS = {
  color: "text-primary",
  selectedBg: "bg-primary/10",
  selectedBorder: "border-primary",
  selectedText: "text-primary",
};

const CompactVehicleSelector = ({
  selectedVehicle,
  onSelect,
  baseFare,
  availableDrivers,
}: CompactVehicleSelectorProps) => {
  const { vehicleTypes } = useVehicleTypes();

  // تحويل بيانات DB إلى عناصر العرض
  const vehicles = useMemo(() => {
    return vehicleTypes.map((vt) => ({
      type: vt.id as VehicleTypeKey,
      name: vt.name_ar,
      multiplier: vt.multiplier,
      ...(VEHICLE_COLORS[vt.id] || DEFAULT_COLORS),
    }));
  }, [vehicleTypes]);

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
