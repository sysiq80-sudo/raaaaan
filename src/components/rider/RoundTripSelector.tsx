import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftRight, Clock, Calendar, Percent, ChevronDown, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RoundTripSelectorProps {
  tripType: 'one_way' | 'round_trip';
  onTripTypeChange: (type: 'one_way' | 'round_trip') => void;
  returnTime?: Date;
  onReturnTimeChange?: (time: Date | undefined) => void;
  oneWayFare: number;
  roundTripDiscount?: number;
  currency?: string;
  disabled?: boolean;
  distanceKm?: number;
  minDistanceForRoundTrip?: number;
}

const RoundTripSelector: React.FC<RoundTripSelectorProps> = ({
  tripType,
  onTripTypeChange,
  returnTime,
  onReturnTimeChange,
  oneWayFare,
  roundTripDiscount = 15,
  currency = 'د.ع',
  disabled = false,
  distanceKm,
  minDistanceForRoundTrip = 30,
}) => {
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Don't show component if distance is less than minimum
  if (distanceKm !== undefined && distanceKm < minDistanceForRoundTrip) {
    return null;
  }

  const roundTripFare = oneWayFare * 2;
  const discountAmount = Math.round(roundTripFare * (roundTripDiscount / 100));
  const finalRoundTripFare = roundTripFare - discountAmount;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ar-IQ', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const quickReturnTimes = [
    { label: 'ساعة', minutes: 60, icon: '⏱️' },
    { label: 'ساعتين', minutes: 120, icon: '🕐' },
    { label: '3 ساعات', minutes: 180, icon: '🕒' },
    { label: 'مخصص', minutes: 0, icon: '📅' },
  ];

  const handleQuickTime = (minutes: number) => {
    if (minutes === 0) {
      setShowTimePicker(true);
    } else {
      const returnDate = new Date();
      returnDate.setMinutes(returnDate.getMinutes() + minutes);
      onReturnTimeChange?.(returnDate);
      setShowTimePicker(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-card to-secondary/30 rounded-2xl border border-border/30 overflow-hidden shadow-sm"
    >
      {/* Trip Type Selector */}
      <div className="p-4 flex gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "flex-1 p-4 rounded-xl border-2 transition-all duration-300 relative overflow-hidden",
            tripType === 'one_way' 
              ? "bg-primary/10 border-primary shadow-lg shadow-primary/10" 
              : "bg-secondary/50 border-transparent hover:bg-secondary"
          )}
          onClick={() => onTripTypeChange('one_way')}
          disabled={disabled}
        >
          <div className="flex items-center justify-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
              tripType === 'one_way' ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              <ArrowLeftRight className="w-5 h-5 rotate-180" />
            </div>
            <div className="text-right">
              <p className={cn(
                "font-bold",
                tripType === 'one_way' ? "text-primary" : "text-foreground"
              )}>
                ذهاب فقط
              </p>
              <p className="text-xs text-muted-foreground">رحلة واحدة</p>
            </div>
          </div>
          {tripType === 'one_way' && (
            <motion.div
              layoutId="trip-indicator"
              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
            >
              <Check className="w-3 h-3 text-primary-foreground" />
            </motion.div>
          )}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "flex-1 p-4 rounded-xl border-2 transition-all duration-300 relative overflow-hidden",
            tripType === 'round_trip' 
              ? "bg-primary/10 border-primary shadow-lg shadow-primary/10" 
              : "bg-secondary/50 border-transparent hover:bg-secondary"
          )}
          onClick={() => onTripTypeChange('round_trip')}
          disabled={disabled}
        >
          {/* Discount badge */}
          <div className="absolute -top-1 -left-1 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded-br-lg rounded-tl-lg shadow-lg">
            -{roundTripDiscount}%
          </div>
          
          <div className="flex items-center justify-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
              tripType === 'round_trip' ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div className="text-right">
              <p className={cn(
                "font-bold",
                tripType === 'round_trip' ? "text-primary" : "text-foreground"
              )}>
                ذهاب وعودة
              </p>
              <p className="text-xs text-muted-foreground">وفّر أكثر</p>
            </div>
          </div>
          {tripType === 'round_trip' && (
            <motion.div
              layoutId="trip-indicator"
              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
            >
              <Check className="w-3 h-3 text-primary-foreground" />
            </motion.div>
          )}
        </motion.button>
      </div>

      {/* Round Trip Details */}
      <AnimatePresence>
        {tripType === 'round_trip' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Return Time Selection */}
              <div className="bg-secondary/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="font-medium">وقت العودة المتوقع</span>
                </div>
                
                <div className="grid grid-cols-4 gap-2">
                  {quickReturnTimes.map((time) => {
                    const isSelected = returnTime && time.minutes > 0 && 
                      Math.abs((returnTime.getTime() - Date.now()) / 60000 - time.minutes) < 5;
                    
                    return (
                      <motion.button
                        key={time.label}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          "p-3 rounded-xl text-center transition-all duration-300",
                          isSelected 
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                            : "bg-background hover:bg-primary/10 border border-border/50"
                        )}
                        onClick={() => handleQuickTime(time.minutes)}
                        disabled={disabled}
                      >
                        <span className="text-lg block mb-1">{time.icon}</span>
                        <span className="text-xs font-medium">{time.label}</span>
                      </motion.button>
                    );
                  })}
                </div>

                {returnTime && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 flex items-center justify-between bg-primary/10 rounded-xl px-4 py-3 border border-primary/20"
                  >
                    <span className="text-sm text-muted-foreground">العودة في:</span>
                    <span className="font-bold text-primary text-lg">
                      {formatTime(returnTime)}
                    </span>
                  </motion.div>
                )}
              </div>

              {/* Price Summary */}
              <div className="bg-gradient-to-br from-primary/10 to-emerald-500/10 rounded-xl p-4 border border-primary/20">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">سعر الذهاب</span>
                    <span className="font-medium">{oneWayFare.toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">سعر العودة</span>
                    <span className="font-medium">{oneWayFare.toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      خصم ذهاب وعودة ({roundTripDiscount}%)
                    </span>
                    <span className="font-bold">-{discountAmount.toLocaleString()} {currency}</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg">الإجمالي</span>
                    <span className="text-primary text-2xl font-bold">
                      {finalRoundTripFare.toLocaleString()} {currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Savings Badge */}
              <motion.div 
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="flex items-center justify-center gap-3 text-emerald-600 bg-gradient-to-l from-emerald-500/20 to-emerald-500/10 rounded-xl py-3 px-4 border border-emerald-500/20"
              >
                <Percent className="w-5 h-5" />
                <span className="font-bold">
                  توفر {discountAmount.toLocaleString()} {currency} مع رحلة الذهاب والعودة!
                </span>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* One Way Price Display */}
      {tripType === 'one_way' && (
        <div className="px-4 pb-4">
          <div className="bg-secondary/50 rounded-xl p-4 flex items-center justify-between">
            <span className="text-muted-foreground">سعر الرحلة</span>
            <span className="font-bold text-xl text-foreground">
              {oneWayFare.toLocaleString()} {currency}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default RoundTripSelector;
