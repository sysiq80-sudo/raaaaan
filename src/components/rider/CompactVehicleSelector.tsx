import React from 'react';
import { motion } from 'framer-motion';
import { Star, Users } from 'lucide-react';

type VehicleType = 'economy' | 'comfort' | 'premium' | 'women_only';

interface VehicleOption {
  type: VehicleType;
  name: string;
  description: string;
  emoji: string;
  multiplier: number;
  seats: number;
}

interface CompactVehicleSelectorProps {
  selectedVehicle: VehicleType;
  onSelect: (type: VehicleType) => void;
  baseFare?: number;
  availableDrivers?: Record<VehicleType, number>;
}

const vehicles: VehicleOption[] = [
  { 
    type: 'economy', 
    name: 'اقتصادي', 
    description: 'الخيار الأرخص',
    emoji: '🚗', 
    multiplier: 1.0,
    seats: 4
  },
  { 
    type: 'comfort', 
    name: 'مريح', 
    description: 'راحة أكثر',
    emoji: '🚙', 
    multiplier: 1.3,
    seats: 4
  },
  { 
    type: 'premium', 
    name: 'فاخر', 
    description: 'سيارات فخمة',
    emoji: '🚘', 
    multiplier: 1.6,
    seats: 4
  },
  { 
    type: 'women_only', 
    name: 'نسائي', 
    description: 'سائقة أنثى',
    emoji: '👩‍💼', 
    multiplier: 1.2,
    seats: 4
  },
];

const CompactVehicleSelector = ({
  selectedVehicle,
  onSelect,
  baseFare,
  availableDrivers
}: CompactVehicleSelectorProps) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      {vehicles.map((vehicle, index) => {
        const isSelected = selectedVehicle === vehicle.type;
        const driverCount = availableDrivers?.[vehicle.type] ?? 0;
        const isUnavailable = availableDrivers && driverCount === 0;
        const fare = baseFare ? Math.round(baseFare * vehicle.multiplier) : null;

        return (
          <motion.button
            key={vehicle.type}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: isUnavailable ? 1 : 1.02 }}
            whileTap={{ scale: isUnavailable ? 1 : 0.98 }}
            onClick={() => !isUnavailable && onSelect(vehicle.type)}
            disabled={isUnavailable}
            className={`relative flex flex-col p-4 rounded-2xl transition-all duration-300 ${
              isUnavailable 
                ? 'bg-secondary/30 opacity-50 cursor-not-allowed'
                : isSelected 
                  ? 'bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary shadow-glow-sm' 
                  : 'bg-secondary/50 border-2 border-transparent hover:bg-secondary hover:border-primary/20'
            }`}
          >
            {/* Selected indicator */}
            {isSelected && (
              <motion.div 
                layoutId="vehicle-selected"
                className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg"
              >
                <Star className="w-3 h-3 text-primary-foreground fill-current" />
              </motion.div>
            )}

            {/* Vehicle emoji */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-3xl">{vehicle.emoji}</span>
              {driverCount > 0 && (
                <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-medium">
                  {driverCount} متاح
                </span>
              )}
            </div>

            {/* Vehicle info */}
            <div className="text-right space-y-1">
              <p className={`font-bold text-base ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                {vehicle.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {vehicle.description}
              </p>
            </div>

            {/* Fare & seats */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users className="w-3 h-3" />
                <span className="text-xs">{vehicle.seats}</span>
              </div>
              
              {fare && !isUnavailable ? (
                <span className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                  {(fare / 1000).toFixed(1)}K
                </span>
              ) : isUnavailable ? (
                <span className="text-xs text-muted-foreground">غير متوفر</span>
              ) : null}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};

export default CompactVehicleSelector;
