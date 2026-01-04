import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, Search, X, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LocationInputCardProps {
  type: 'pickup' | 'dropoff';
  value: string;
  placeholder: string;
  isLocating?: boolean;
  onGetLocation?: () => void;
  onClick: () => void;
  onClear?: () => void;
  className?: string;
  showClear?: boolean;
  isActive?: boolean;
}

const LocationInputCard: React.FC<LocationInputCardProps> = ({
  type,
  value,
  placeholder,
  isLocating = false,
  onGetLocation,
  onClick,
  onClear,
  className,
  showClear = false,
  isActive = false
}) => {
  const isPickup = type === 'pickup';
  
  const config = isPickup ? {
    icon: Navigation,
    gradient: 'from-emerald-500 to-green-600',
    bgGradient: 'from-emerald-500/15 to-emerald-600/10',
    borderColor: 'border-emerald-500/40',
    iconColor: 'text-emerald-500',
    labelColor: 'text-emerald-600 dark:text-emerald-400',
    label: 'من أين؟',
    emoji: '📍'
  } : {
    icon: MapPin,
    gradient: 'from-rose-500 to-pink-600',
    bgGradient: 'from-rose-500/15 to-rose-600/10',
    borderColor: 'border-rose-500/40',
    iconColor: 'text-rose-500',
    labelColor: 'text-rose-600 dark:text-rose-400',
    label: 'إلى أين؟',
    emoji: '🎯'
  };

  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("relative", className)}
    >
      {/* Main Card */}
      <motion.button
        type="button"
        onClick={onClick}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={cn(
          "relative w-full overflow-hidden rounded-2xl transition-all duration-300",
          "bg-card/90 backdrop-blur-xl shadow-lg",
          "border-2",
          value ? config.borderColor : "border-border/50",
          isActive && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background",
          "hover:border-primary/50 hover:shadow-xl",
          "text-right"
        )}
      >
        {/* Background Gradient */}
        <div className={cn(
          "absolute inset-0 opacity-0 transition-opacity duration-300",
          value && "opacity-100",
          `bg-gradient-to-br ${config.bgGradient}`
        )} />

        <div className="relative flex items-center gap-4 p-4">
          {/* Icon with GPS Button for Pickup */}
          <div className="relative shrink-0">
            {isPickup && onGetLocation ? (
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onGetLocation();
                }}
                className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-300",
                  `bg-gradient-to-br ${config.gradient}`,
                  "shadow-lg hover:shadow-xl",
                  isLocating && "animate-pulse"
                )}
              >
                {isLocating ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full"
                  />
                ) : (
                  <Icon className="w-6 h-6 text-white" />
                )}
                
                {/* Pulse Ring */}
                {isLocating && (
                  <motion.div
                    className="absolute inset-0 rounded-2xl border-2 border-emerald-400"
                    animate={{ scale: [1, 1.3], opacity: [1, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
              </motion.div>
            ) : (
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center",
                `bg-gradient-to-br ${config.gradient}`,
                "shadow-lg"
              )}>
                <Icon className="w-6 h-6 text-white" />
              </div>
            )}
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0 text-right">
            {/* Label */}
            <div className="flex items-center justify-end gap-2 mb-1">
              <span className={cn(
                "text-xs font-bold tracking-wide",
                config.labelColor
              )}>
                {config.label}
              </span>
              <span className="text-sm">{config.emoji}</span>
            </div>

            {/* Address / Placeholder */}
            <AnimatePresence mode="wait">
              <motion.p
                key={value || 'placeholder'}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className={cn(
                  "font-bold text-base truncate transition-colors",
                  value ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {isLocating ? (
                  <span className="flex items-center justify-end gap-2">
                    <span className="text-sm">جاري تحديد موقعك...</span>
                    <motion.span
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      🔍
                    </motion.span>
                  </span>
                ) : (
                  value || placeholder
                )}
              </motion.p>
            </AnimatePresence>

            {/* Hint */}
            {!value && !isLocating && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-muted-foreground mt-1 flex items-center justify-end gap-1"
              >
                <span>اضغط للاختيار</span>
                <ArrowRight className="w-3 h-3" />
              </motion.p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="shrink-0 flex items-center gap-2">
            {/* Clear Button */}
            <AnimatePresence>
              {showClear && value && onClear && (
                <motion.button
                  type="button"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                  className="w-10 h-10 rounded-xl bg-secondary/80 hover:bg-destructive/20 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground hover:text-destructive" />
                </motion.button>
              )}
            </AnimatePresence>
            
            {/* Search Icon */}
            {!value && (
              <motion.div
                animate={{ x: [0, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center"
              >
                <Search className="w-5 h-5 text-muted-foreground" />
              </motion.div>
            )}
          </div>
        </div>

        {/* Bottom Progress Indicator */}
        <AnimatePresence>
          {value && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              exit={{ scaleX: 0 }}
              className={cn(
                "absolute bottom-0 left-0 right-0 h-1 origin-right",
                `bg-gradient-to-l ${config.gradient}`
              )}
            />
          )}
        </AnimatePresence>
      </motion.button>

      {/* Connection Line for Dropoff */}
      {!isPickup && (
        <div className="absolute -top-4 right-11 flex flex-col items-center gap-0.5">
          <div className="w-0.5 h-4 bg-gradient-to-b from-emerald-500 to-rose-500 rounded-full" />
        </div>
      )}
    </motion.div>
  );
};

export default LocationInputCard;
