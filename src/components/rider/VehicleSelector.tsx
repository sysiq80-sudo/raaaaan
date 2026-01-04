import React from 'react';
import { motion } from 'framer-motion';
import { Car, Users, Crown, UserCircle, Check, Sparkles, Zap } from 'lucide-react';

type VehicleType = 'economy' | 'comfort' | 'premium' | 'women_only';

interface VehicleOption {
  type: VehicleType;
  name: string;
  description: string;
  icon: React.ReactNode;
  emoji: string;
  multiplier: number;
  gradient: string;
  features: string[];
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
    description: 'الخيار الأسرع والأوفر',
    icon: <Car className="w-5 h-5" />,
    emoji: '🚗',
    multiplier: 1.0,
    gradient: 'from-emerald-500 to-green-600',
    features: ['الأرخص', 'الأسرع وصولاً']
  },
  { 
    type: 'comfort', 
    name: 'مريح', 
    description: 'سيارة أفضل وأكثر راحة',
    icon: <Users className="w-5 h-5" />,
    emoji: '🚙',
    multiplier: 1.3,
    gradient: 'from-blue-500 to-indigo-600',
    features: ['مساحة أكبر', 'تكييف ممتاز']
  },
  { 
    type: 'premium', 
    name: 'فاخر', 
    description: 'تجربة VIP مميزة',
    icon: <Crown className="w-5 h-5" />,
    emoji: '🚘',
    multiplier: 1.6,
    gradient: 'from-amber-500 to-orange-600',
    features: ['سيارة فاخرة', 'خدمة مميزة']
  },
  { 
    type: 'women_only', 
    name: 'نسائي', 
    description: 'سائقة أنثى للسيدات',
    icon: <UserCircle className="w-5 h-5" />,
    emoji: '👩',
    multiplier: 1.2,
    gradient: 'from-pink-500 to-rose-600',
    features: ['سائقة أنثى', 'للسيدات فقط']
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

  // If no drivers are available at all, show empty state
  if (filteredOptions.length === 0) {
    return (
      <div className={`${className}`}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-12 px-6 rounded-3xl bg-gradient-to-br from-muted/50 to-muted/20 border border-border/50"
        >
          <div className="w-20 h-20 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
            <Car className="w-10 h-10 text-muted-foreground/50" />
          </div>
          <p className="text-lg font-semibold text-foreground mb-1">لا يوجد سائقين متاحين</p>
          <p className="text-sm text-muted-foreground">حاول مرة أخرى بعد قليل</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {filteredOptions.map((vehicle, index) => {
        const isSelected = selectedVehicle === vehicle.type;
        const estimatedFare = baseFare ? Math.round(baseFare * vehicle.multiplier) : null;
        const driverCount = availableDrivers?.[vehicle.type];
        const isUnavailable = availableDrivers && (driverCount ?? 0) === 0;
        const isPopular = vehicle.type === 'economy';
        
        return (
          <motion.button
            key={vehicle.type}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => !isUnavailable && onSelect(vehicle.type)}
            disabled={isUnavailable}
            className={`relative w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 ${
              isUnavailable 
                ? 'bg-muted/30 opacity-50 cursor-not-allowed'
                : isSelected 
                  ? 'bg-gradient-to-r from-primary/15 to-primary/5 border-2 border-primary shadow-lg shadow-primary/10' 
                  : 'bg-card border-2 border-border/50 hover:border-primary/30 hover:bg-secondary/30'
            }`}
          >
            {/* Popular Badge */}
            {isPopular && !isUnavailable && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-2 -right-2 px-2.5 py-1 rounded-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-xs font-bold flex items-center gap-1 shadow-lg"
              >
                <Zap className="w-3 h-3" />
                الأكثر طلباً
              </motion.div>
            )}

            {/* Vehicle Icon */}
            <div className={`relative w-16 h-16 rounded-2xl flex items-center justify-center text-3xl transition-all duration-300 ${
              isSelected 
                ? `bg-gradient-to-br ${vehicle.gradient} shadow-lg` 
                : 'bg-secondary/80'
            }`}>
              <span className={isSelected ? 'scale-110 transition-transform' : ''}>
                {vehicle.emoji}
              </span>
              {isSelected && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg"
                >
                  <Check className="w-3.5 h-3.5 text-primary-foreground" />
                </motion.div>
              )}
            </div>
            
            {/* Vehicle Info */}
            <div className="flex-1 text-right min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`font-bold text-lg ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                  {vehicle.name}
                </span>
                {vehicle.multiplier > 1 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    ×{vehicle.multiplier}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {isUnavailable ? 'غير متوفر حالياً' : vehicle.description}
              </p>
              
              {/* Features */}
              {!isUnavailable && (
                <div className="flex flex-wrap gap-1.5">
                  {vehicle.features.map((feature, i) => (
                    <span 
                      key={i} 
                      className={`text-xs px-2 py-0.5 rounded-md ${
                        isSelected 
                          ? 'bg-primary/20 text-primary' 
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              )}
              
              {/* Driver Count */}
              {driverCount !== undefined && driverCount > 0 && (
                <p className="text-xs text-primary mt-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  {driverCount} سائق متاح
                </p>
              )}
            </div>
            
            {/* Estimated Fare */}
            {estimatedFare && !isUnavailable && (
              <div className="text-left pl-2">
                <p className={`font-bold text-xl ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                  {estimatedFare.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">د.ع</p>
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
};

export default VehicleSelector;
