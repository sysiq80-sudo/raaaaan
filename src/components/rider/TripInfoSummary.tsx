import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Route, Coins, TrendingUp, Zap, Info } from 'lucide-react';
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
    total_fare?: number; // Support both naming conventions
  };
  vehicleType?: string;
  className?: string;
  isLoading?: boolean;
}

const TripInfoSummary: React.FC<TripInfoSummaryProps> = ({
  distance,
  duration,
  estimatedFare,
  fareBreakdown,
  vehicleType,
  className,
  isLoading = false
}) => {
  // Calculate values
  const formattedDistance = distance ? `${(distance / 1000).toFixed(1)} كم` : '--';
  const formattedDuration = duration ? `${Math.ceil(duration / 60)} د` : '--';
  const totalFare = fareBreakdown?.total_fare || fareBreakdown?.total;
  const formattedFare = estimatedFare 
    ? `${estimatedFare.toLocaleString('ar-IQ')} د.ع` 
    : totalFare
    ? `${totalFare.toLocaleString('ar-IQ')} د.ع`
    : '--';

  const stats = [
    {
      icon: Route,
      label: 'المسافة',
      value: formattedDistance,
      color: 'from-blue-500 to-cyan-500',
      textColor: 'text-blue-600 dark:text-blue-400'
    },
    {
      icon: Clock,
      label: 'المدة',
      value: formattedDuration,
      color: 'from-violet-500 to-purple-500',
      textColor: 'text-violet-600 dark:text-violet-400'
    },
    {
      icon: Coins,
      label: 'التكلفة',
      value: formattedFare,
      color: 'from-amber-500 to-orange-500',
      textColor: 'text-amber-600 dark:text-amber-400',
      highlight: true
    }
  ];

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("rounded-3xl bg-card/80 backdrop-blur-xl border border-border/50 p-6", className)}
      >
        <div className="flex items-center justify-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary"
          />
          <p className="text-sm text-muted-foreground font-medium">جاري حساب تفاصيل الرحلة...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-3xl bg-gradient-to-br from-card/90 via-card/80 to-card/70 backdrop-blur-xl border border-border/50 overflow-hidden",
        className
      )}
    >
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_var(--primary)_1px,_transparent_1px)] bg-[length:24px_24px]" />
      </div>

      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <Info className="w-5 h-5 text-primary" />
            </div>
            <div className="text-right">
              <h3 className="font-bold text-sm text-foreground">ملخص الرحلة</h3>
              <p className="text-xs text-muted-foreground">تفاصيل تقديرية</p>
            </div>
          </div>
          
          {vehicleType && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              className="px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30"
            >
              <p className="text-xs font-bold text-primary">
                {vehicleType === 'economy' ? 'اقتصادي' :
                 vehicleType === 'comfort' ? 'مريح' :
                 vehicleType === 'premium' ? 'فاخر' :
                 vehicleType === 'women_only' ? 'نسائي' : vehicleType}
              </p>
            </motion.div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "relative group rounded-2xl p-4 transition-all duration-300",
                stat.highlight 
                  ? "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-2 border-primary/30 col-span-3" 
                  : "bg-secondary/30 border border-border/30 hover:border-primary/30"
              )}
            >
              {/* Icon */}
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className={cn(
                  "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3 shadow-lg",
                  stat.highlight ? "from-primary/30 to-primary/20" : "from-secondary to-secondary/50"
                )}
              >
                <stat.icon className={cn("w-5 h-5", stat.highlight ? "text-primary" : stat.textColor)} />
              </motion.div>

              {/* Label */}
              <p className="text-xs text-muted-foreground mb-1 font-medium">{stat.label}</p>

              {/* Value */}
              <p className={cn(
                "font-bold transition-colors",
                stat.highlight ? "text-2xl text-primary" : "text-lg text-foreground"
              )}>
                {stat.value}
              </p>

              {/* Highlight Glow */}
              {stat.highlight && (
                <motion.div
                  className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity -z-10 blur-xl"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </motion.div>
          ))}
        </div>

        {/* Fare Breakdown (if available) */}
        {fareBreakdown && (fareBreakdown.total || fareBreakdown.total_fare) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 pt-4 border-t border-border/30 space-y-2"
          >
            {fareBreakdown.baseFare !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">السعر الأساسي</span>
                <span className="font-medium">{fareBreakdown.baseFare.toLocaleString('ar-IQ')} د.ع</span>
              </div>
            )}
            {fareBreakdown.distanceFare !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">سعر المسافة</span>
                <span className="font-medium">{fareBreakdown.distanceFare.toLocaleString('ar-IQ')} د.ع</span>
              </div>
            )}
            {fareBreakdown.timeFare && fareBreakdown.timeFare > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">سعر الوقت</span>
                <span className="font-medium">{fareBreakdown.timeFare.toLocaleString('ar-IQ')} د.ع</span>
              </div>
            )}
            {fareBreakdown.serviceFee !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">رسوم الخدمة</span>
                <span className="font-medium">{fareBreakdown.serviceFee.toLocaleString('ar-IQ')} د.ع</span>
              </div>
            )}
            <div className="flex items-center justify-between text-base font-bold pt-2 border-t border-border/30">
              <span className="text-primary">الإجمالي</span>
              <span className="text-primary">{(fareBreakdown.total_fare || fareBreakdown.total)?.toLocaleString('ar-IQ')} د.ع</span>
            </div>
          </motion.div>
        )}

        {/* Pro Tip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-gradient-to-r from-primary/5 to-transparent border border-primary/20"
        >
          <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-bold text-primary">نصيحة: </span>
            الأسعار قد تختلف حسب حركة المرور والطلب في المنطقة
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default TripInfoSummary;
