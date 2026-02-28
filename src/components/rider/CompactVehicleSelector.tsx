import React from "react";
import { motion } from "framer-motion";
import { Car, Armchair, Crown, Users } from "lucide-react";
import { roundFare } from "@/lib/constants";

type VehicleType = "economy" | "comfort" | "premium" | "women_only";

interface CompactVehicleSelectorProps {
  selectedVehicle: VehicleType;
  onSelect: (type: VehicleType) => void;
  baseFare?: number;
  availableDrivers?: Record<VehicleType, number>;
}

const CompactVehicleSelector = ({
  selectedVehicle,
  onSelect,
  baseFare,
  availableDrivers,
}: CompactVehicleSelectorProps) => {
  // Using semantic design tokens for consistent theming
  const vehicles = [
    {
      type: "economy" as VehicleType,
      name: "اقتصادي",
      emoji: "🚗",
      icon: Car,
      multiplier: 1.0,
      gradient: "from-primary to-primary/80",
      bgGradient: "from-primary/10 to-primary/5",
      iconColor: "text-primary",
    },
    {
      type: "comfort" as VehicleType,
      name: "مريح",
      emoji: "🚙",
      icon: Armchair,
      multiplier: 1.3,
      gradient: "from-info to-info/80",
      bgGradient: "from-info/10 to-info/5",
      iconColor: "text-info",
    },
    {
      type: "premium" as VehicleType,
      name: "فاخر",
      emoji: "🚘",
      icon: Crown,
      multiplier: 1.6,
      gradient: "from-warning to-warning/80",
      bgGradient: "from-warning/10 to-warning/5",
      iconColor: "text-warning",
    },
    {
      type: "women_only" as VehicleType,
      name: "نسائي",
      emoji: "👩",
      icon: Users,
      multiplier: 1.2,
      gradient: "from-accent to-accent/80",
      bgGradient: "from-accent/10 to-accent/5",
      iconColor: "text-accent-foreground",
    },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
      {vehicles.map((vehicle, index) => {
        const isSelected = selectedVehicle === vehicle.type;
        const driverCount = availableDrivers?.[vehicle.type] ?? 0;
        const isUnavailable = availableDrivers && driverCount === 0;
        const fare = baseFare
          ? Math.round(baseFare * vehicle.multiplier)
          : null;
        const Icon = vehicle.icon;

        return (
          <motion.button
            key={vehicle.type}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => !isUnavailable && onSelect(vehicle.type)}
            disabled={isUnavailable}
            className={`flex-shrink-0 flex flex-col items-center justify-center p-3 rounded-2xl transition-all min-w-[85px] relative overflow-hidden snap-center ${
              isUnavailable
                ? "bg-secondary/30 opacity-50 cursor-not-allowed"
                : isSelected
                ? `bg-gradient-to-br ${vehicle.bgGradient} border-2 border-primary shadow-lg shadow-primary/20`
                : "bg-secondary/50 border-2 border-transparent hover:bg-secondary hover:border-border"
            }`}
          >
            {/* Selection glow effect */}
            {isSelected && (
              <motion.div
                layoutId="vehicleGlow"
                className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}

            {/* Emoji + Icon */}
            <div className="relative z-10 mb-1.5">
              <span className="text-2xl">{vehicle.emoji}</span>
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-2"
                >
                  <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${vehicle.gradient} flex items-center justify-center`}>
                    <Icon className="w-2.5 h-2.5 text-white" />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Name */}
            <span
              className={`text-sm font-bold mb-1 relative z-10 ${
                isSelected ? "text-primary" : "text-foreground"
              }`}
            >
              {vehicle.name}
            </span>

            {/* Fare */}
            {fare && !isUnavailable && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`text-xs font-semibold relative z-10 ${
                  isSelected
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {roundFare(fare).toLocaleString()} د.ع
              </motion.span>
            )}

            {/* Driver count badge - enhanced */}
            {!isUnavailable && driverCount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium relative z-10 ${
                  isSelected
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {driverCount} متاح
              </motion.div>
            )}

            {/* Unavailable badge */}
            {isUnavailable && (
              <span className="text-[10px] text-muted-foreground relative z-10 mt-1">
                غير متوفر
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
};

export default CompactVehicleSelector;
