import React from 'react';
import { Car, Users, Crown, UserCircle } from 'lucide-react';

type VehicleType = 'economy' | 'comfort' | 'premium' | 'women_only';

interface VehicleOption {
  type: VehicleType;
  name: string;
  description: string;
  icon: React.ReactNode;
  emoji: string;
  multiplier: number;
}

interface VehicleSelectorProps {
  selectedVehicle: VehicleType;
  onSelect: (type: VehicleType) => void;
  baseFare?: number;
  className?: string;
  availableDrivers?: Record<VehicleType, number>;
  showUnavailable?: boolean;
}

const vehicleOptions: VehicleOption[] = [
  { 
    type: 'economy', 
    name: 'اقتصادي', 
    description: 'الأسرع والأوفر',
    icon: <Car className="w-5 h-5" />,
    emoji: '🚗',
    multiplier: 1.0
  },
  { 
    type: 'comfort', 
    name: 'مريح', 
    description: 'سيارة أفضل',
    icon: <Users className="w-5 h-5" />,
    emoji: '🚙',
    multiplier: 1.3
  },
  { 
    type: 'premium', 
    name: 'فاخر', 
    description: 'تجربة مميزة',
    icon: <Crown className="w-5 h-5" />,
    emoji: '🚘',
    multiplier: 1.6
  },
  { 
    type: 'women_only', 
    name: 'نسائي', 
    description: 'سائقة أنثى',
    icon: <UserCircle className="w-5 h-5" />,
    emoji: '👩',
    multiplier: 1.2
  },
];

const VehicleSelector: React.FC<VehicleSelectorProps> = ({
  selectedVehicle,
  onSelect,
  baseFare,
  className = '',
  availableDrivers,
  showUnavailable = false
}) => {
  // Filter options based on availability if availableDrivers is provided
  const filteredOptions = availableDrivers 
    ? vehicleOptions.filter(v => showUnavailable || (availableDrivers[v.type] ?? 0) > 0)
    : vehicleOptions;

  // If no drivers are available at all, show economy as default
  if (filteredOptions.length === 0) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="text-center py-6 text-muted-foreground">
          <Car className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>لا يوجد سائقين متاحين حالياً</p>
          <p className="text-sm">حاول مرة أخرى بعد قليل</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {filteredOptions.map((vehicle) => {
        const isSelected = selectedVehicle === vehicle.type;
        const estimatedFare = baseFare ? Math.round(baseFare * vehicle.multiplier) : null;
        const driverCount = availableDrivers?.[vehicle.type];
        const isUnavailable = availableDrivers && (driverCount ?? 0) === 0;
        
        return (
          <button
            key={vehicle.type}
            onClick={() => !isUnavailable && onSelect(vehicle.type)}
            disabled={isUnavailable}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
              isUnavailable 
                ? 'bg-secondary/30 opacity-50 cursor-not-allowed'
                : isSelected 
                  ? 'bg-primary/10 border-2 border-primary shadow-lg' 
                  : 'bg-secondary/50 border-2 border-transparent hover:bg-secondary'
            }`}
          >
            {/* Vehicle icon */}
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${
              isSelected ? 'bg-primary/20' : 'bg-background'
            }`}>
              {vehicle.emoji}
            </div>
            
            {/* Vehicle info */}
            <div className="flex-1 text-right">
              <div className="flex items-center gap-2">
                <span className={`font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                  {vehicle.name}
                </span>
                {vehicle.multiplier > 1 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                    ×{vehicle.multiplier}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {isUnavailable ? 'غير متوفر حالياً' : vehicle.description}
              </p>
              {/* Show driver count if available */}
              {driverCount !== undefined && driverCount > 0 && (
                <p className="text-xs text-primary mt-0.5">
                  {driverCount} سائق متاح
                </p>
              )}
            </div>
            
            {/* Estimated fare */}
            {estimatedFare && !isUnavailable && (
              <div className="text-left">
                <p className={`font-bold text-lg ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                  {estimatedFare.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">د.ع</p>
              </div>
            )}
            
            {/* Selection indicator */}
            {!isUnavailable && (
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                isSelected 
                  ? 'border-primary bg-primary' 
                  : 'border-muted-foreground/30'
              }`}>
                {isSelected && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default VehicleSelector;
