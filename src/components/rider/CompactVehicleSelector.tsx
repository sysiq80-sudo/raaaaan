import React, { useMemo } from "react";
import { roundFare } from "@/lib/constants";
import { useVehicleTypes, type VehicleTypeKey } from "@/hooks/useVehicleTypes";
import { Leaf, Car, Gem, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompactVehicleSelectorProps {
  selectedVehicle: VehicleTypeKey;
  onSelect: (type: VehicleTypeKey) => void;
  baseFare?: number;
  availableDrivers?: Record<VehicleTypeKey, number>;
}

// أيقونات وألوان كل مركبة
const VEHICLE_META: Record<string, { icon: React.ElementType, eta: string, isPopular?: boolean }> = {
  economy: { icon: Leaf, eta: "٤ دقائق" },
  comfort: { icon: Car, eta: "٥ دقائق" },
  premium: { icon: Gem, eta: "٧ دقائق", isPopular: true },
  women_only: { icon: Shield, eta: "٩ دقائق" },
};

const CompactVehicleSelector = ({
  selectedVehicle,
  onSelect,
  baseFare,
  availableDrivers,
}: CompactVehicleSelectorProps) => {
  const { vehicleTypes } = useVehicleTypes();

  const vehicles = useMemo(() => {
    return vehicleTypes.map((vt) => ({
      type: vt.id as VehicleTypeKey,
      name: vt.name_ar,
      multiplier: vt.multiplier,
      ...(VEHICLE_META[vt.id] || { icon: Car, eta: "٥ دقائق" }),
    }));
  }, [vehicleTypes]);

  return (
    <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-2 px-2 pb-4 pt-4 shrink-0">
      {vehicles.map((v) => {
        const isSelected = selectedVehicle === v.type;
        const driverCount = availableDrivers?.[v.type] ?? 0;
        const isUnavailable = availableDrivers !== undefined && driverCount === 0;
        const fare = baseFare ? Math.round(baseFare * v.multiplier) : null;
        
        const Icon = v.icon;

        return (
          <button
            key={v.type}
            onClick={() => !isUnavailable && onSelect(v.type)}
            disabled={isUnavailable}
            className={cn(
              "flex-shrink-0 w-36 rounded-2xl p-4 flex flex-col items-center text-center transition-all relative group",
              isUnavailable 
                ? "bg-[#171f33]/50 border border-white/5 opacity-50 cursor-not-allowed"
                : isSelected
                ? "bg-[#5bdda6]/10 border-2 border-[#5bdda6]"
                : "bg-[#171f33] border border-white/5 hover:border-[#5bdda6]/30"
            )}
          >
            {/* رسالة الأكثر طلباً */}
            {Boolean((v as { isPopular?: boolean }).isPopular) && (
              <div className={cn(
                "absolute -top-3 px-3 py-0.5 rounded-full z-10 transition-colors",
                isSelected ? "bg-[#5bdda6]" : "bg-[#2d3449]"
              )}>
                <span className={cn(
                  "text-[10px] font-bold whitespace-nowrap",
                  isSelected ? "text-[#003825]" : "text-white"
                )}>
                  الأكثر طلباً
                </span>
              </div>
            )}

            {/* الأيقونة */}
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-colors",
              isSelected ? "bg-[#5bdda6]/20 text-[#5bdda6]" : "bg-[#2d3449] text-[#5bdda6]/60 group-hover:text-[#5bdda6]"
            )}>
              <Icon className="w-7 h-7" />
            </div>

            {/* اسم النوع */}
            <h4 className="text-[15px] font-bold text-white mb-1">
              {v.name}
            </h4>

            {/* الوقت */}
            <p className={cn(
              "text-[10px] mb-3",
              isSelected ? "text-[#5bdda6]/80" : "text-[#bccac0]"
            )}>
              {v.eta}
            </p>

            {/* السعر */}
            {fare && !isUnavailable ? (
              <p className={cn(
                "font-bold text-base mt-auto",
                isSelected ? "text-[#5bdda6]" : "text-white"
              )}>
                {roundFare(fare).toLocaleString('en-US')} <span className="text-[10px] font-normal">د.ع</span>
              </p>
            ) : isUnavailable ? (
              <p className="text-[9px] text-red-400 mt-auto">غير متاح</p>
            ) : (
              <p className="text-[10px] text-white/40 mt-auto">--</p>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default CompactVehicleSelector;
