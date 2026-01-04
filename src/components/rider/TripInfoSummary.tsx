import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Route, Coins, Zap, Car, Shield, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TripInfoSummaryProps {
  distance?: number | null;
  duration?: number | null;
  estimatedFare?: number | null;
  fareBreakdown?: {
    baseFare?: number;
    distanceFare?: number;
    timeFare?: number;
    serviceFee?: number;
    total?: number;
    total_fare?: number;
  };
  vehicleType?: string;
  className?: string;
  isLoading?: boolean;
  compact?: boolean;
}

const TripInfoSummary: React.FC<TripInfoSummaryProps> = ({
  distance,
  duration,
  estimatedFare,
  fareBreakdown,
  vehicleType,
  className,
  isLoading = false,
  compact = false
}) => {
  // Calculate values - distance is in km, duration is in minutes
  const distanceKm = distance || 0;
  const durationMins = duration ? Math.ceil(duration) : 0;
  const totalFare = estimatedFare || fareBreakdown?.total_fare || fareBreakdown?.total || 0;

  const vehicleConfig: Record<string, { name: string; emoji: string; color: string }> = {
    economy: { name: 'اقتصادي', emoji: '🚗', color: 'text-emerald-500' },
    comfort: { name: 'مريح', emoji: '🚙', color: 'text-blue-500' },
    premium: { name: 'فاخر', emoji: '🚘', color: 'text-amber-500' },
    women_only: { name: 'نسائي', emoji: '👩', color: 'text-pink-500' }
  };

  const currentVehicle = vehicleType ? vehicleConfig[vehicleType] : null;

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("rounded-2xl bg-card/90 backdrop-blur-xl border border-border/50 p-5", className)}
      >
        <div className="flex items-center justify-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-6 h-6 rounded-full border-3 border-primary/30 border-t-primary"
          />
          <p className="text-sm text-muted-foreground font-medium">جاري حساب تفاصيل الرحلة...</p>
        </div>
      </motion.div>
    );
  }

  // Compact version for quick view
  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20 p-4",
          className
        )}
      >
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center mx-auto">
              <Route className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-lg font-bold">{distanceKm.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">كم</p>
          </div>
          <div className="space-y-1">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center mx-auto">
              <Clock className="w-5 h-5 text-violet-500" />
            </div>
            <p className="text-lg font-bold">{durationMins || '--'}</p>
            <p className="text-xs text-muted-foreground">دقيقة</p>
          </div>
          <div className="space-y-1">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center mx-auto">
              <Coins className="w-5 h-5 text-primary" />
            </div>
            <p className="text-lg font-bold text-primary">{totalFare.toLocaleString('ar-IQ')}</p>
            <p className="text-xs text-muted-foreground">د.ع</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-3xl bg-card/95 backdrop-blur-xl border border-border/50 overflow-hidden shadow-xl",
        className
      )}
    >
      {/* Header with Vehicle Type */}
      <div className="p-5 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <Car className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">ملخص الرحلة</h3>
              <p className="text-xs text-muted-foreground">تقديرات قبل الحجز</p>
            </div>
          </div>
          
          {currentVehicle && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50"
            >
              <span className="text-lg">{currentVehicle.emoji}</span>
              <span className={cn("text-sm font-bold", currentVehicle.color)}>
                {currentVehicle.name}
              </span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="p-5">
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Distance */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                <Route className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">المسافة</p>
                <p className="text-xl font-bold">{distanceKm.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">كم</span></p>
              </div>
            </div>
          </motion.div>

          {/* Duration */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-violet-500/10 to-violet-600/5 border border-violet-500/20"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">المدة</p>
                <p className="text-xl font-bold">{durationMins || '--'} <span className="text-sm font-normal text-muted-foreground">دقيقة</span></p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Total Fare - Prominent */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          className="p-5 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border-2 border-primary/30"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/30">
                <Coins className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-xs text-primary font-medium">التكلفة التقديرية</p>
                <p className="text-2xl font-bold text-primary">{totalFare.toLocaleString('ar-IQ')} <span className="text-sm font-normal">د.ع</span></p>
              </div>
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>سعر ثابت</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Fare Breakdown */}
        {fareBreakdown && totalFare > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 pt-4 border-t border-border/30 space-y-2"
          >
            <p className="text-xs font-bold text-muted-foreground mb-3">تفاصيل السعر</p>
            
            {fareBreakdown.baseFare !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">السعر الأساسي</span>
                <span className="font-medium">{fareBreakdown.baseFare.toLocaleString('ar-IQ')} د.ع</span>
              </div>
            )}
            {fareBreakdown.distanceFare !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">سعر المسافة ({distanceKm.toFixed(1)} كم)</span>
                <span className="font-medium">{fareBreakdown.distanceFare.toLocaleString('ar-IQ')} د.ع</span>
              </div>
            )}
            {fareBreakdown.serviceFee !== undefined && fareBreakdown.serviceFee > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">رسوم الخدمة</span>
                <span className="font-medium">{fareBreakdown.serviceFee.toLocaleString('ar-IQ')} د.ع</span>
              </div>
            )}
          </motion.div>
        )}

        {/* Trust Badges */}
        <div className="mt-4 flex items-center justify-center gap-4 pt-4 border-t border-border/30">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            <span>رحلة آمنة</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>وصول سريع</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TripInfoSummary;
