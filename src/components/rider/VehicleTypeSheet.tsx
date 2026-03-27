import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Check } from "lucide-react";
import { roundFare } from "@/lib/constants";

type VehicleType = "economy" | "comfort" | "premium" | "women_only";

interface VehicleTypeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedVehicle: VehicleType;
  onSelect: (type: VehicleType) => void;
  baseFare?: number;
  availableDrivers?: Record<string, number>;
}

const VEHICLES: {
  type: VehicleType;
  name: string;
  desc: string;
  multiplier: number;
  color: string;
}[] = [
  { type: "economy",    name: "اقتصادي",  desc: "مناسب وبسعر معقول",       multiplier: 1.0, color: "text-primary"  },
  { type: "comfort",    name: "مريح",      desc: "سيارة مريحة وأوسع",       multiplier: 1.3, color: "text-blue-500" },
  { type: "premium",    name: "فاخر",      desc: "تجربة متميزة وفاخرة",     multiplier: 1.6, color: "text-amber-500"},
  { type: "women_only", name: "نسائي",     desc: "سائقة متخصصة للسيدات",    multiplier: 1.2, color: "text-pink-500" },
];

const VehicleTypeSheet: React.FC<VehicleTypeSheetProps> = ({
  open,
  onOpenChange,
  selectedVehicle,
  onSelect,
  baseFare,
  availableDrivers,
}) => {
  const handleSelect = (type: VehicleType) => {
    onSelect(type);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-8">
        <SheetHeader className="text-center mb-4">
          <SheetTitle className="text-lg font-bold">اختر نوع السيارة</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-2">
          {VEHICLES.map((v) => {
            const isSelected = selectedVehicle === v.type;
            const driverCount = availableDrivers?.[v.type] ?? 0;
            const isUnavailable = availableDrivers !== undefined && driverCount === 0;
            const fare = baseFare ? Math.round(baseFare * v.multiplier) : null;

            return (
              <button
                key={v.type}
                onClick={() => !isUnavailable && handleSelect(v.type)}
                disabled={isUnavailable}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-150 ${
                  isUnavailable
                    ? "border-border/20 bg-muted/20 opacity-40 cursor-not-allowed"
                    : isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border/40 bg-card hover:bg-muted/40"
                }`}
              >
                <div className="text-right">
                  <p className={`font-bold text-sm ${isSelected ? "text-primary" : "text-foreground"}`}>
                    {v.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{v.desc}</p>
                </div>

                <div className="flex items-center gap-3">
                  {fare && !isUnavailable && (
                    <span className={`text-sm font-bold ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                      {roundFare(fare).toLocaleString()} د.ع
                    </span>
                  )}
                  {isUnavailable && (
                    <span className="text-xs text-muted-foreground">غير متاح</span>
                  )}
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default VehicleTypeSheet;

// اسم النوع المختصر للزر
export const VEHICLE_NAMES: Record<string, string> = {
  economy:    "اقتصادي",
  comfort:    "مريح",
  premium:    "فاخر",
  women_only: "نسائي",
};
