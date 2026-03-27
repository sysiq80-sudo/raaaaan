import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftRight, Clock, Calendar, Percent, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RoundTripSelectorProps {
  tripType: 'one_way' | 'round_trip';
  onTripTypeChange: (type: 'one_way' | 'round_trip') => void;
  returnTime?: Date;
  onReturnTimeChange?: (time: Date | undefined) => void;
  oneWayFare: number;
  roundTripDiscount?: number; // نسبة الخصم (مثلاً 15)
  currency?: string;
  disabled?: boolean;
  distanceKm?: number; // المسافة بالكيلومتر
  minDistanceForRoundTrip?: number; // الحد الأدنى لإظهار خيار الذهاب والعودة (افتراضي 30 كم)
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

  // Don't show component if distance is less than minimum (default 30km)
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
    { label: 'بعد ساعة', minutes: 60 },
    { label: 'بعد ساعتين', minutes: 120 },
    { label: 'بعد 3 ساعات', minutes: 180 },
    { label: 'مخصص', minutes: 0 },
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
    <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
      {/* Trip Type Selector */}
      <div className="p-3 flex gap-2">
        <Button
          variant={tripType === 'one_way' ? 'default' : 'outline'}
          size="sm"
          className={cn(
            "flex-1 gap-2 transition-all",
            tripType === 'one_way' && "shadow-md"
          )}
          onClick={() => onTripTypeChange('one_way')}
          disabled={disabled}
        >
          <ArrowLeftRight className="w-4 h-4 rotate-180" />
          ذهاب فقط
        </Button>
        <Button
          variant={tripType === 'round_trip' ? 'default' : 'outline'}
          size="sm"
          className={cn(
            "flex-1 gap-2 transition-all",
            tripType === 'round_trip' && "shadow-md"
          )}
          onClick={() => onTripTypeChange('round_trip')}
          disabled={disabled}
        >
          <ArrowLeftRight className="w-4 h-4" />
          ذهاب وعودة
        </Button>
      </div>

      {/* Round Trip Details */}
      <AnimatePresence>
        {tripType === 'round_trip' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">
              {/* Return Time Selection */}
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">وقت العودة المتوقع</span>
                </div>
                
                <div className="grid grid-cols-4 gap-2">
                  {quickReturnTimes.map((time) => (
                    <Button
                      key={time.label}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "text-xs h-8",
                        returnTime && time.minutes > 0 && 
                        Math.abs(
                          (returnTime.getTime() - Date.now()) / 60000 - time.minutes
                        ) < 5 && "bg-primary/10 border-primary"
                      )}
                      onClick={() => handleQuickTime(time.minutes)}
                      disabled={disabled}
                    >
                      {time.label}
                    </Button>
                  ))}
                </div>

                {returnTime && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 flex items-center justify-between bg-background rounded-lg px-3 py-2"
                  >
                    <span className="text-sm text-muted-foreground">العودة في:</span>
                    <span className="text-sm font-medium text-primary">
                      {formatTime(returnTime)}
                    </span>
                  </motion.div>
                )}
              </div>

              {/* Price Summary */}
              <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg p-3 border border-primary/20">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">سعر الذهاب</span>
                    <span>{oneWayFare.toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">سعر العودة</span>
                    <span>{oneWayFare.toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span className="flex items-center gap-1">
                      <Percent className="w-3 h-3" />
                      خصم ذهاب وعودة ({roundTripDiscount}%)
                    </span>
                    <span>-{discountAmount.toLocaleString()} {currency}</span>
                  </div>
                  <div className="h-px bg-border my-1" />
                  <div className="flex justify-between font-semibold">
                    <span>الإجمالي</span>
                    <span className="text-primary text-lg">
                      {finalRoundTripFare.toLocaleString()} {currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Savings Badge */}
              <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-500/10 rounded-full py-2 px-4">
                <Percent className="w-4 h-4" />
                <span className="text-sm font-medium">
                  توفر {discountAmount.toLocaleString()} {currency} مع رحلة الذهاب والعودة!
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* One Way Price Display */}
      {tripType === 'one_way' && (
        <div className="px-3 pb-3">
          <div className="bg-muted/30 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">سعر الرحلة</span>
            <span className="font-semibold text-lg">
              {oneWayFare.toLocaleString()} {currency}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoundTripSelector;
