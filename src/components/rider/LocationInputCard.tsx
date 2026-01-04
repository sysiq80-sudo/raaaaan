import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation, Search, Locate, Circle, X } from 'lucide-react';
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
  showClear = false
}) => {
  const isPickup = type === 'pickup';
  
  const Icon = isPickup ? Navigation : MapPin;
  const iconBgColor = isPickup 
    ? 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30' 
    : 'from-rose-500/20 to-rose-600/20 border-rose-500/30';
  const iconColor = isPickup ? 'text-emerald-500' : 'text-rose-500';
  const accentColor = isPickup ? 'border-emerald-500/50' : 'border-rose-500/50';

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        "relative group cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {/* Main Card */}
      <div className={cn(
        "relative overflow-hidden rounded-2xl bg-card/80 backdrop-blur-xl border-2 transition-all duration-300",
        value ? accentColor : "border-border/50",
        "hover:border-primary/50 hover:shadow-xl"
      )}>
        {/* Animated Background Gradient */}
        <motion.div
          className={cn(
            "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
            isPickup 
              ? "bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent" 
              : "bg-gradient-to-br from-rose-500/5 via-transparent to-transparent"
          )}
        />

        <div className="relative flex items-center gap-4 p-4">
          {/* Icon Container with Location Button */}
          <div className="relative shrink-0">
            {isPickup && onGetLocation ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onGetLocation();
                }}
                disabled={isLocating}
                className={cn(
                  "relative w-14 h-14 rounded-2xl bg-gradient-to-br border flex items-center justify-center shadow-lg transition-all",
                  iconBgColor,
                  isLocating ? "opacity-75" : "hover:shadow-2xl"
                )}
              >
                <Icon className={cn("w-6 h-6", iconColor)} />
                {isLocating && (
                  <>
                    <motion.div
                      className="absolute inset-0 rounded-2xl border-2 border-emerald-500"
                      animate={{ scale: [1, 1.2, 1], opacity: [1, 0, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <div className="absolute inset-0 rounded-2xl bg-emerald-500/20 animate-pulse" />
                  </>
                )}
              </motion.button>
            ) : (
              <div className={cn(
                "w-14 h-14 rounded-2xl bg-gradient-to-br border flex items-center justify-center shadow-lg",
                iconBgColor
              )}>
                <Icon className={cn("w-6 h-6", iconColor)} />
              </div>
            )}
            
            {/* Connection Dot (for dropoff) */}
            {!isPickup && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5"
              >
                <Circle className="w-2 h-2 fill-muted-foreground text-muted-foreground" />
                <Circle className="w-2 h-2 fill-muted-foreground text-muted-foreground" />
                <Circle className="w-2 h-2 fill-muted-foreground text-muted-foreground" />
              </motion.div>
            )}
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0 text-right">
            {/* Label */}
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-end gap-2 mb-1"
            >
              <span className={cn(
                "text-xs font-bold uppercase tracking-wider",
                isPickup ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              )}>
                {isPickup ? 'نقطة الانطلاق' : 'الوجهة'}
              </span>
              <div className={cn(
                "w-2 h-2 rounded-full",
                isPickup ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              )} />
            </motion.div>

            {/* Address / Placeholder */}
            <p className={cn(
              "font-bold text-base transition-colors",
              value ? "text-foreground" : "text-muted-foreground",
              isLocating && "animate-pulse"
            )}>
              {isLocating ? (
                <span className="flex items-center justify-end gap-2">
                  <span className="text-sm">جاري تحديد الموقع...</span>
                  <motion.div
                    className="w-1 h-1 rounded-full bg-emerald-500"
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                </span>
              ) : (
                value || placeholder
              )}
            </p>

            {/* Hint Text */}
            {!value && !isLocating && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-muted-foreground mt-1 flex items-center justify-end gap-1"
              >
                <span>اضغط للبحث</span>
                <Search className="w-3 h-3" />
              </motion.p>
            )}
          </div>

          {/* Action Icons */}
          <div className="shrink-0 flex flex-col gap-2">
            {showClear && value && onClear && (
              <motion.button
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="w-8 h-8 rounded-lg bg-secondary/50 hover:bg-destructive/20 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
              </motion.button>
            )}
            
            {/* Chevron or Search Icon */}
            <motion.div
              animate={{ x: [0, -3, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
              className="opacity-40 group-hover:opacity-100 transition-opacity"
            >
              <Search className="w-5 h-5 text-muted-foreground" />
            </motion.div>
          </div>
        </div>

        {/* Bottom Indicator Line */}
        {value && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            className={cn(
              "absolute bottom-0 left-0 right-0 h-1 origin-left",
              isPickup 
                ? "bg-gradient-to-r from-emerald-500 to-emerald-400" 
                : "bg-gradient-to-r from-rose-500 to-rose-400"
            )}
          />
        )}
      </div>

      {/* Glow Effect on Hover */}
      <motion.div
        className={cn(
          "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl",
          isPickup ? "bg-emerald-500/20" : "bg-rose-500/20"
        )}
      />
    </motion.div>
  );
};

export default LocationInputCard;
