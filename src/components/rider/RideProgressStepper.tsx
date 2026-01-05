import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, Car, MapPin, Flag, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface RideProgressStepperProps {
  status: string;
  estimatedArrival?: number | null;
  onDriverApproaching?: () => void;
}

const steps = [
  { key: 'pending', label: 'بانتظار سائق', icon: Clock },
  { key: 'accepted', label: 'السائق قَبِل', icon: Car },
  { key: 'arrived', label: 'السائق وصل', icon: MapPin },
  { key: 'in_progress', label: 'جاري التوصيل', icon: Car },
  { key: 'completed', label: 'تم الوصول', icon: Flag },
];

const getStepIndex = (status: string): number => {
  const index = steps.findIndex(s => s.key === status);
  return index >= 0 ? index : 0;
};

const RideProgressStepper: React.FC<RideProgressStepperProps> = ({ status, estimatedArrival }) => {
  const currentIndex = getStepIndex(status);
  const progressPercent = (currentIndex / (steps.length - 1)) * 100;
  const [messageIndex, setMessageIndex] = useState(0);

  // Get messages based on status
  const getStatusMessages = (): string[] => {
    switch (status) {
      case 'pending':
        return ['⏳ جاري البحث عن سائق قريب...'];
      case 'accepted':
        const acceptedMessages = [
          '✅ السائق قَبِل طلبك',
          '🚗 السائق في الطريق إليك',
        ];
        if (estimatedArrival && estimatedArrival > 0) {
          acceptedMessages.push(`⏱️ وقت وصوله المتوقع "بمشيئة الله": ${estimatedArrival} دقيقة`);
        }
        return acceptedMessages;
      case 'arrived':
        return [
          '✅ السائق وصل إلى موقعك',
          '📍 اخرج الآن للقاء السائق',
        ];
      case 'in_progress':
        const progressMessages = ['🛣️ في الطريق إلى وجهتك'];
        if (estimatedArrival && estimatedArrival > 0) {
          progressMessages.push(`⏱️ وقت الوصول المتوقع "بمشيئة الله": ${estimatedArrival} دقيقة`);
        }
        return progressMessages;
      case 'completed':
        return ['✅ تم التوصيل بنجاح!'];
      default:
        return [''];
    }
  };

  const messages = getStatusMessages();

  // Cycle through messages every 5 seconds
  useEffect(() => {
    if (messages.length <= 1) {
      setMessageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [messages.length, status, estimatedArrival]);

  // Reset message index when status changes
  useEffect(() => {
    setMessageIndex(0);
  }, [status]);

  return (
    <div className="w-full py-4 px-3">
      {/* Progress Container */}
      <div className="relative">
        {/* Background Track */}
        <div className="absolute top-5 left-4 right-4 h-1.5 bg-muted/50 rounded-full overflow-hidden">
          {/* Shimmer effect on background */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
        </div>
        
        {/* Animated Progress Fill */}
        <div 
          className="absolute top-5 right-4 h-1.5 rounded-full overflow-hidden transition-all duration-700 ease-out"
          style={{ width: `calc(${progressPercent}% - 16px)` }}
        >
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-l from-primary via-primary/80 to-emerald-400" />
          
          {/* Animated Glow */}
          <div className="absolute inset-0 bg-gradient-to-l from-primary via-emerald-400 to-primary animate-pulse opacity-60" />
          
          {/* Moving Shine Effect */}
          <div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
            style={{
              animation: 'shimmer 2s infinite linear',
              backgroundSize: '200% 100%',
            }}
          />
        </div>

        {/* Steps Container */}
        <div className="flex items-center justify-between relative">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isPending = index > currentIndex;

            return (
              <div 
                key={step.key} 
                className="flex flex-col items-center z-10 relative"
                style={{ width: `${100 / steps.length}%` }}
              >
                {/* Step Circle with Effects */}
                <div className="relative">
                  {/* Outer Glow Ring for Current */}
                  {isCurrent && (
                    <>
                      <div className="absolute -inset-2 rounded-full bg-primary/20 animate-ping" />
                      <div className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-primary/40 to-emerald-400/40 animate-pulse" />
                    </>
                  )}
                  
                  {/* Completed Glow */}
                  {isCompleted && (
                    <div className="absolute -inset-1 rounded-full bg-primary/30 blur-sm" />
                  )}
                  
                  {/* Main Circle */}
                  <div
                    className={cn(
                      "relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 border-2",
                      isCompleted && "bg-gradient-to-br from-primary to-emerald-500 border-primary/50 text-primary-foreground shadow-lg shadow-primary/30",
                      isCurrent && "bg-gradient-to-br from-primary to-emerald-500 border-primary text-primary-foreground shadow-xl shadow-primary/50 scale-110",
                      isPending && "bg-background/80 border-muted-foreground/20 text-muted-foreground"
                    )}
                  >
                    {/* Inner Shine for Completed/Current */}
                    {(isCompleted || isCurrent) && (
                      <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent to-white/20" />
                    )}
                    
                    {/* Icon */}
                    {isCurrent && status !== 'completed' ? (
                      <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                    ) : isCompleted || (isCurrent && status === 'completed') ? (
                      <CheckCircle className="w-5 h-5 relative z-10" />
                    ) : (
                      <Icon className="w-5 h-5 relative z-10" />
                    )}
                  </div>
                </div>

                {/* Label with Animation */}
                <span
                  className={cn(
                    "text-[10px] mt-2 text-center leading-tight font-medium transition-all duration-500",
                    isCompleted && "text-primary font-semibold",
                    isCurrent && "text-primary font-bold scale-105",
                    isPending && "text-muted-foreground/60"
                  )}
                >
                  {step.label}
                </span>

                {/* Active Indicator Dot */}
                {isCurrent && (
                  <div className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Text - Single Line with Animation */}
      <div className="mt-4 text-center h-8 flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={`${status}-${messageIndex}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className={cn(
              "text-sm font-semibold",
              status === 'completed' 
                ? "bg-gradient-to-r from-emerald-400 to-primary bg-clip-text text-transparent"
                : messages[messageIndex]?.includes('✅') 
                  ? "text-emerald-500"
                  : messages[messageIndex]?.includes('⏱️')
                    ? "text-primary"
                    : "text-foreground/80"
            )}
          >
            {messages[messageIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RideProgressStepper;
