import React from 'react';
import { Car, Users, Crown, UserCircle } from 'lucide-react';
import { useVehicleTypes, type VehicleTypeKey } from '@/hooks/useVehicleTypes';

type VehicleType = VehicleTypeKey;

// أيقونات ثابتة لكل نوع — البيانات الباقية تأتي من DB
const VEHICLE_ICONS: Record<string, React.ReactNode> = {
  economy:    <Car className="w-5 h-5" />,
  comfort:    <Users className="w-5 h-5" />,
  premium:    <Crown className="w-5 h-5" />,
  women_only: <UserCircle className="w-5 h-5" />,
};
const DEFAULT_ICON = <Car className="w-5 h-5" />;

interface VehicleSelectorProps {
  selectedVehicle: VehicleType;
  onSelect: (type: VehicleType) => void;
  baseFare?: number;
  className?: string;
  availableDrivers?: Record<VehicleType, number>;
  showUnavailable?: boolean;
}

const VehicleSelector: React.FC<VehicleSelectorProps> = ({
  selectedVehicle,
  onSelect,
  baseFare,
  className = '',
  availableDrivers,
  showUnavailable = false
}) => {
  const { vehicleTypes, isLoading } = useVehicleTypes();

  // تصفية حسب التوفر
  const filteredOptions = availableDrivers
    ? vehicleTypes.filter(v => showUnavailable || (availableDrivers[v.id as VehicleType] ?? 0) > 0)
    : vehicleTypes;

  // حالة التحميل
  if (isLoading) {
    return (
      <div className={`space-y-2 ${className}`}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="w-full h-20 rounded-2xl bg-secondary/50 animate-pulse" />
        ))}
      </div>
    );
  }

  // لا يوجد سائقون متاحون
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
        const vehicleId = vehicle.id as VehicleType;
        const isSelected = selectedVehicle === vehicleId;
        const estimatedFare = baseFare ? Math.round(baseFare * vehicle.multiplier) : null;
        const driverCount = availableDrivers?.[vehicleId];
        const isUnavailable = availableDrivers && (driverCount ?? 0) === 0;
        const icon = VEHICLE_ICONS[vehicle.id] || DEFAULT_ICON;
        
        return (
          <button
            key={vehicleId}
            onClick={() => !isUnavailable && onSelect(vehicleId)}
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
              {vehicle.icon}
            </div>
            
            {/* Vehicle info */}
            <div className="flex-1 text-right">
              <div className="flex items-center gap-2">
                <span className={`font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                  {vehicle.name_ar}
                </span>
                {vehicle.multiplier > 1 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                    ×{vehicle.multiplier}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {isUnavailable ? 'غير متوفر حالياً' : (vehicle.description_ar || '')}
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
                  {estimatedFare.toLocaleString('en-US')}
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
