/**
 * ران - شاشات الترحيب للمستخدم الجديد
 * تعرض معلومات أساسية عن كيفية استخدام التطبيق
 */

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MapPin, Car, Navigation, Shield, ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

interface OnboardingFlowProps {
  onComplete: () => void;
}

const ONBOARDING_SCREENS = [
  {
    id: 1,
    icon: Sparkles,
    title: "مرحباً بك في ران! 🎉",
    description: "منصة توصيل آمنة وسريعة في العراق. نسعى لتوفير أفضل تجربة تنقل لك.",
    gradient: "from-primary/20 to-primary/5",
    iconBg: "bg-primary/20",
    iconColor: "text-primary",
  },
  {
    id: 2,
    icon: MapPin,
    title: "حدد موقعك بسهولة 📍",
    description: "اسحب الخريطة لتحديد نقطة الانطلاق والوجهة. يمكنك أيضاً البحث عن المواقع بالاسم.",
    gradient: "from-green-500/20 to-green-500/5",
    iconBg: "bg-green-500/20",
    iconColor: "text-green-600",
  },
  {
    id: 3,
    icon: Car,
    title: "اختر سيارتك المناسبة 🚗",
    description: "اقتصادي، مريح، فاخر، أو نسائي. اختر ما يناسب احتياجاتك وميزانيتك.",
    gradient: "from-blue-500/20 to-blue-500/5",
    iconBg: "bg-blue-500/20",
    iconColor: "text-blue-600",
  },
  {
    id: 4,
    icon: Navigation,
    title: "تتبع رحلتك مباشرة 🔴",
    description: "شاهد موقع السائق في الوقت الحقيقي. تواصل معه بسهولة عبر المحادثة أو الاتصال.",
    gradient: "from-purple-500/20 to-purple-500/5",
    iconBg: "bg-purple-500/20",
    iconColor: "text-purple-600",
  },
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [, setHasSeenOnboarding] = useLocalStorage("raan_onboarding_completed", false);

  const handleNext = useCallback(() => {
    if (currentScreen < ONBOARDING_SCREENS.length - 1) {
      setCurrentScreen((prev) => prev + 1);
    } else {
      setHasSeenOnboarding(true);
      onComplete();
    }
  }, [currentScreen, onComplete, setHasSeenOnboarding]);

  const handlePrevious = useCallback(() => {
    if (currentScreen > 0) {
      setCurrentScreen((prev) => prev - 1);
    }
  }, [currentScreen]);

  const handleSkip = useCallback(() => {
    setHasSeenOnboarding(true);
    onComplete();
  }, [onComplete, setHasSeenOnboarding]);

  const screen = ONBOARDING_SCREENS[currentScreen];
  const Icon = screen.icon;
  const isLastScreen = currentScreen === ONBOARDING_SCREENS.length - 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-background flex flex-col"
    >
      {/* Skip button */}
      <div className="absolute top-4 left-4 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          className="text-muted-foreground hover:text-foreground"
        >
          تخطي
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={screen.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm text-center"
          >
            {/* Icon */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className={`w-28 h-28 mx-auto rounded-3xl ${screen.iconBg} flex items-center justify-center mb-8 shadow-lg`}
            >
              <Icon className={`w-14 h-14 ${screen.iconColor}`} />
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold mb-4 text-foreground"
            >
              {screen.title}
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-muted-foreground text-lg leading-relaxed"
            >
              {screen.description}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 mb-6">
        {ONBOARDING_SCREENS.map((_, index) => (
          <motion.div
            key={index}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentScreen
                ? "w-8 bg-primary"
                : index < currentScreen
                ? "w-2 bg-primary/50"
                : "w-2 bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="px-6 pb-8 safe-area-bottom">
        <div className="flex gap-3">
          {/* Previous button */}
          {currentScreen > 0 && (
            <Button
              variant="outline"
              size="lg"
              onClick={handlePrevious}
              className="flex-1 h-14 rounded-2xl text-lg font-bold"
            >
              <ArrowRight className="w-5 h-5 ml-2" />
              السابق
            </Button>
          )}

          {/* Next/Start button */}
          <Button
            size="lg"
            onClick={handleNext}
            className={`flex-1 h-14 rounded-2xl text-lg font-bold ${
              isLastScreen
                ? "bg-gradient-to-r from-primary to-primary/80"
                : ""
            }`}
          >
            {isLastScreen ? (
              <>
                ابدأ الآن
                <Sparkles className="w-5 h-5 mr-2" />
              </>
            ) : (
              <>
                التالي
                <ArrowLeft className="w-5 h-5 mr-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default OnboardingFlow;
