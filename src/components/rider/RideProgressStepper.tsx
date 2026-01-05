import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, Car, MapPin, Flag, Loader2, Navigation, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
interface RideProgressStepperProps {
  status: string;
  estimatedArrival?: number | null;
  onDriverApproaching?: () => void;
}
const steps = [{
  key: 'searching',
  label: 'جاري البحث',
  icon: Loader2,
  emoji: '⏳'
}, {
  key: 'pending',
  label: 'بانتظار سائق',
  icon: Clock,
  emoji: '⏳'
}, {
  key: 'accepted',
  label: 'السائق قَبِل',
  icon: Car,
  emoji: '✅'
}, {
  key: 'arrived',
  label: 'السائق وصل',
  icon: MapPin,
  emoji: '📍'
}, {
  key: 'in_progress',
  label: 'جاري التوصيل',
  icon: Navigation,
  emoji: '🚗'
}, {
  key: 'completed',
  label: 'تم الوصول',
  icon: Flag,
  emoji: '🏁'
}];
const getStepIndex = (status: string): number => {
  const index = steps.findIndex(s => s.key === status);
  return index >= 0 ? index : 0;
};
const RideProgressStepper: React.FC<RideProgressStepperProps> = ({
  status,
  estimatedArrival
}) => {
  const currentIndex = getStepIndex(status);
  const progressPercent = currentIndex / (steps.length - 1) * 100;
  const [messageIndex, setMessageIndex] = useState(0);

  // Get messages based on status
  const getStatusMessages = (): string[] => {
    switch (status) {
      case 'searching':
        return ['⏳ جاري البحث عن سائق قريب...'];
      case 'pending':
        return [];
      case 'accepted':
        const acceptedMessages = ['✅ السائق قَبِل طلبك', '🚗 السائق في الطريق إليك'];
        if (estimatedArrival && estimatedArrival > 0) {
          acceptedMessages.push(`⏱️ الوصول خلال ${estimatedArrival} دقيقة بمشيئة الله`);
        }
        return acceptedMessages;
      case 'arrived':
        return ['✅ السائق وصل إلى موقعك', '📍 اخرج الآن للقاء السائق'];
      case 'in_progress':
        const progressMessages = ['🛣️ في الطريق إلى وجهتك'];
        if (estimatedArrival && estimatedArrival > 0) {
          progressMessages.push(`⏱️ الوصول خلال ${estimatedArrival} دقيقة`);
        }
        return progressMessages;
      case 'completed':
        return ['🎉 تم التوصيل بنجاح!'];
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
      setMessageIndex(prev => (prev + 1) % messages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [messages.length, status, estimatedArrival]);

  // Reset message index when status changes
  useEffect(() => {
    setMessageIndex(0);
  }, [status]);
  return <div className="w-full bg-gradient-to-b from-card via-card to-transparent py-0 px-0">
      {/* Progress Container */}
      <div className="relative">
        {/* Background Track */}
        <div className="absolute top-4 sm:top-6 left-4 sm:left-6 right-4 sm:right-6 h-1.5 sm:h-2 bg-muted/30 rounded-full overflow-hidden">
          {/* Shimmer effect on background */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
        </div>

        {/* Animated Progress Fill */}
        <motion.div className="absolute top-4 sm:top-6 right-4 sm:right-6 h-1.5 sm:h-2 rounded-full overflow-hidden" initial={{
        width: 0
      }} animate={{
        width: `calc(${progressPercent}% - 16px)`
      }} transition={{
        duration: 0.7,
        ease: 'easeOut'
      }}>
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-l from-primary via-emerald-500 to-emerald-400" />

          {/* Animated Glow */}
          <div className="absolute inset-0 bg-gradient-to-l from-primary via-emerald-400 to-primary animate-pulse opacity-60" />

          {/* Moving Shine Effect */}
          <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent" animate={{
          x: ['100%', '-100%']
        }} transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'linear'
        }} />
        </motion.div>

        {/* Steps Container */}
        <div className="flex items-center justify-between relative min-h-[50px] sm:min-h-[70px]">
          {steps.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;
          return <motion.div key={step.key} initial={{
            opacity: 0,
            scale: 0.8
          }} animate={{
            opacity: 1,
            scale: 1
          }} transition={{
            delay: index * 0.1
          }} className="flex flex-col items-center z-10 relative" style={{
            minWidth: '45px',
            flex: '1'
          }}>
                {/* Step Circle with Effects */}
                <div className="relative">
                  {/* Outer Glow Ring for Current */}
                  {isCurrent && <>
                      <motion.div className="absolute -inset-2 sm:-inset-3 rounded-full bg-primary/20" animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.2, 0.5]
                }} transition={{
                  duration: 2,
                  repeat: Infinity
                }} />
                      <div className="absolute -inset-1.5 sm:-inset-2 rounded-full bg-gradient-to-r from-primary/40 to-emerald-400/40 animate-pulse" />
                    </>}

                  {/* Completed Glow */}
                  {isCompleted && <div className="absolute -inset-0.5 sm:-inset-1 rounded-full bg-emerald-500/30 blur-sm" />}

                  {/* Main Circle */}
                  <motion.div whileHover={{
                scale: 1.05
              }} className={cn("relative w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-500 border-2", isCompleted && "bg-gradient-to-br from-emerald-400 to-green-600 border-emerald-300 text-white shadow-lg shadow-emerald-500/40", isCurrent && "bg-gradient-to-br from-primary to-primary/80 border-primary text-primary-foreground shadow-xl shadow-primary/50", isPending && "bg-card border-muted-foreground/20 text-muted-foreground")}>
                    {/* Inner Shine for Completed/Current */}
                    {(isCompleted || isCurrent) && <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent to-white/20" />}

                    {/* Icon */}
                    {isCurrent && status !== 'completed' ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin relative z-10" /> : isCompleted || isCurrent && status === 'completed' ? <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 relative z-10" /> : <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 relative z-10" />}
                  </motion.div>
                </div>

                {/* Label with Animation */}
                <motion.span initial={{
              opacity: 0
            }} animate={{
              opacity: 1
            }} transition={{
              delay: 0.3 + index * 0.1
            }} className={cn("text-[9px] sm:text-[10px] mt-1.5 sm:mt-2 text-center leading-tight font-medium transition-all duration-500", isCompleted && "text-emerald-600 dark:text-emerald-400 font-semibold", isCurrent && "text-primary font-bold", isPending && "text-muted-foreground/50")}>
                  {step.label}
                </motion.span>

                {/* Active Indicator Dot */}
                {isCurrent && <motion.div className="absolute -bottom-0.5 sm:-bottom-1 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary" animate={{
              y: [0, -2, 0]
            }} transition={{
              duration: 1,
              repeat: Infinity
            }} />}
              </motion.div>;
        })}
        </div>
      </div>

      {/* Status Text - Compact and Responsive */}
      <div className="mt-2 sm:mt-3">
        <AnimatePresence mode="wait">
          <motion.div key={`${status}-${messageIndex}`} initial={{
          opacity: 0,
          y: 10
        }} animate={{
          opacity: 1,
          y: 0
        }} exit={{
          opacity: 0,
          y: -10
        }} transition={{
          duration: 0.3,
          ease: "easeInOut"
        }} className="flex items-center justify-center gap-1.5 sm:gap-2 px-2">
            {status === 'completed' && <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 animate-pulse" />}
            <p className={cn("text-xs sm:text-sm font-semibold text-center leading-tight", status === 'completed' ? "bg-gradient-to-r from-emerald-400 via-primary to-amber-500 bg-clip-text text-transparent" : messages[messageIndex]?.includes('✅') ? "text-emerald-500" : messages[messageIndex]?.includes('⏱️') ? "text-primary" : "text-foreground/80")}>
              {messages[messageIndex]}
            </p>
            {status === 'completed' && <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 animate-pulse" />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>;
};
export default RideProgressStepper;