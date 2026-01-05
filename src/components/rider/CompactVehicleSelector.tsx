import React from 'react';

type VehicleType = 'economy' | 'comfort' | 'premium' | 'women_only';

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
  availableDrivers
}: CompactVehicleSelectorProps) => {
  const vehicles = [
    { type: 'economy' as VehicleType, name: 'اقتصادي', emoji: '🚗', multiplier: 1.0 },
    { type: 'comfort' as VehicleType, name: 'مريح', emoji: '🚙', multiplier: 1.3 },
    { type: 'premium' as VehicleType, name: 'فاخر', emoji: '🚘', multiplier: 1.6 },
    { type: 'women_only' as VehicleType, name: 'نسائي', emoji: '👩', multiplier: 1.2 },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {vehicles.map((vehicle) => {
        const isSelected = selectedVehicle === vehicle.type;
        const driverCount = availableDrivers?.[vehicle.type] ?? 0;
        const isUnavailable = availableDrivers && driverCount === 0;
        const fare = baseFare ? Math.round(baseFare * vehicle.multiplier) : null;

        return (
          <button
            key={vehicle.type}
            onClick={() => !isUnavailable && onSelect(vehicle.type)}
            disabled={isUnavailable}
            className={`flex-shrink-0 flex flex-col items-center p-3 rounded-2xl transition-all min-w-[80px] ${
              isUnavailable 
                ? 'bg-secondary/30 opacity-50 cursor-not-allowed'
                : isSelected 
                  ? 'bg-primary/15 border-2 border-primary shadow-md' 
                  : 'bg-secondary/50 border-2 border-transparent hover:bg-secondary'
            }`}
          >
            <span className="text-2xl mb-1">{vehicle.emoji}</span>
            <span className={`text-xs font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
              {vehicle.name}
            </span>
            {fare && !isUnavailable && (
              <span className={`text-xs mt-0.5 ${isSelected ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                {(fare / 1000).toFixed(1)}K
              </span>
            )}
            {isUnavailable && (
              <span className="text-[10px] text-muted-foreground">غير متوفر</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default CompactVehicleSelector;
