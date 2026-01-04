import React from 'react';
import { Car, Clock, Users } from 'lucide-react';

interface EnhancedDriverIndicatorProps {
  vehicleType: 'economy' | 'comfort' | 'premium' | 'women_only';
  availableDrivers?: number;
  estimatedArrival?: number; // بالدقائق
}

export const EnhancedDriverIndicator: React.FC<EnhancedDriverIndicatorProps> = ({
  vehicleType,
  availableDrivers = 0,
  estimatedArrival
}) => {
  const getAvailabilityColor = () => {
    if (availableDrivers === 0) return 'text-destructive';
    if (availableDrivers <= 2) return 'text-amber-500';
    return 'text-primary';
  };

  const getAvailabilityText = () => {
    if (availableDrivers === 0) return 'غير متوفر';
    if (availableDrivers === 1) return 'سائق واحد';
    if (availableDrivers <= 5) return `${availableDrivers} سائقين`;
    return 'متوفر بكثرة';
  };

  const getAvailabilityLevel = () => {
    if (availableDrivers === 0) return 'منخفض';
    if (availableDrivers <= 2) return 'متوسط';
    if (availableDrivers <= 5) return 'عالي';
    return 'عالي جداً';
  };

  return (
    <div className="w-full bg-secondary/50 rounded-xl p-3 space-y-2">
      {/* السائقين المتاحين */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{getAvailabilityText()}</span>
        </div>
        <div className={`flex items-center gap-1.5 ${getAvailabilityColor()}`}>
          <div className={`w-2 h-2 rounded-full ${
            availableDrivers > 0 ? 'bg-current animate-pulse' : 'bg-current'
          }`} />
          <span className="text-xs font-semibold">{getAvailabilityLevel()}</span>
        </div>
      </div>

      {/* وقت الوصول المتوقع */}
      {estimatedArrival !== undefined && (
        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="text-sm">وقت الوصول</span>
          </div>
          <span className="text-sm font-bold text-foreground">
            {estimatedArrival} - {estimatedArrival + 2} دقيقة
          </span>
        </div>
      )}

      {/* رسالة تحذيرية إذا كان التوفر منخفضاً */}
      {availableDrivers === 0 && (
        <div className="pt-2 border-t border-destructive/20 text-xs text-destructive">
          قد يستغرق البحث وقتاً أطول. حاول لاحقاً أو غيّر نوع السيارة.
        </div>
      )}
    </div>
  );
};

export default EnhancedDriverIndicator;
