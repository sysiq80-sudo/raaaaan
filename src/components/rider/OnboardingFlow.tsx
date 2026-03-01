/**
 * ران - شاشة الترحيب الموحدة (GIF + نص متغير + طلب موقع)
 * GIF واحد يعمل باستمرار في الأعلى، مع نص يتبدل تلقائياً أسفله
 * يتوقف عند الخطوة الأخيرة ويطلب صلاحية الموقع
 *
 * v2 — ألوان واضحة ومتجاوبة مع الشاشات
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MapPin, Settings } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

interface OnboardingFlowProps {
  onComplete: () => void;
}

const HERO_GIF = "https://j.top4top.io/p_3697pycno1.gif";
const STEP_DURATION = 3000;

const ONBOARDING_STEPS = [
  {
    id: 1,
    title: "مرحباً بك في ران!",
    description: "منصة توصيل آمنة وسريعة.",
  },
  {
    id: 2,
    title: "تتبع رحلتك مباشرة",
    description: "شاهد موقع السائق في الوقت الحقيقي.",
  },
  {
    id: 3,
    title: "اختر سيارتك المناسبة",
    description: "اقتصادي، مريح، أو نسائي.",
  },
  {
    id: 4,
    title: "حدد موقعك للبدء",
    description: "للبدء، نحتاج لمعرفة موقعك الحالي\nلتوجيه أقرب سائق إليك.",
  },
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(true);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [gifLoaded, setGifLoaded] = useState(false);
  const [, setHasSeenOnboarding] = useLocalStorage("raan_onboarding_completed", false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  const step = ONBOARDING_STEPS[currentStep];

  // تحميل الـ GIF مسبقاً
  useEffect(() => {
    const img = new Image();
    img.onload = () => setGifLoaded(true);
    img.src = HERO_GIF;
  }, []);

  // التقدم التلقائي للخطوات الثلاث الأولى
  useEffect(() => {
    if (!isAutoAdvancing || isLastStep) return;

    timerRef.current = setTimeout(() => {
      setCurrentStep((prev) => {
        const next = prev + 1;
        if (next >= ONBOARDING_STEPS.length - 1) {
          setIsAutoAdvancing(false);
        }
        return next;
      });
    }, STEP_DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentStep, isAutoAdvancing, isLastStep]);

  const completeOnboarding = useCallback(() => {
    setHasSeenOnboarding(true);
    onComplete();
  }, [onComplete, setHasSeenOnboarding]);

  const handleSkip = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsAutoAdvancing(false);
    setCurrentStep(ONBOARDING_STEPS.length - 1);
  }, []);

  const requestLocationPermission = useCallback(async () => {
    setIsRequestingLocation(true);
    setLocationDenied(false);

    try {
      navigator.geolocation.getCurrentPosition(
        (_position) => {
          localStorage.setItem("location_permission_requested", "true");
          localStorage.setItem("location_permission_granted", "true");
          setIsRequestingLocation(false);
          completeOnboarding();
        },
        (error) => {
          console.warn("[Onboarding] Location permission denied:", error.message);
          localStorage.setItem("location_permission_requested", "true");
          localStorage.setItem("location_permission_granted", "false");
          setIsRequestingLocation(false);
          setLocationDenied(true);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } catch (error) {
      console.error("[Onboarding] Error requesting location:", error);
      setIsRequestingLocation(false);
      setLocationDenied(true);
    }
  }, [completeOnboarding]);

  const handleContinueWithoutLocation = useCallback(() => {
    completeOnboarding();
  }, [completeOnboarding]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #0f7a56 0%, #1eb484 40%, #16a376 100%)",
      }}
    >

      {/* زر تخطي */}
      <AnimatePresence>
        {isAutoAdvancing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-4 left-4 z-20"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-white/70 hover:text-white hover:bg-white/10 text-sm"
            >
              تخطي
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === القسم العلوي: GIF متجاوب === */}
      <div className="flex-shrink-0 flex items-center justify-center pt-10 sm:pt-16 pb-2 sm:pb-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: gifLoaded ? 1 : 0, scale: gifLoaded ? 1 : 0.85 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative"
        >
          {/* توهج خلف الـ GIF */}
          <div className="absolute inset-0 bg-white/5 rounded-full blur-[60px] scale-125" />
          <img
            src={HERO_GIF}
            alt="RAAN"
            onLoad={() => setGifLoaded(true)}
            className="w-[160px] h-[160px] sm:w-[220px] sm:h-[220px] object-contain relative z-10 drop-shadow-2xl"
            draggable={false}
          />
        </motion.div>
      </div>

      {/* === القسم الأوسط: النص المتبدل === */}
      <div className="flex-1 flex flex-col items-center justify-start px-5 sm:px-6 relative z-10 min-h-0">
        <div className="w-full max-w-sm text-center min-h-[6rem] sm:min-h-[7rem] flex items-start justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              <h1 className="text-xl sm:text-2xl font-bold text-white mb-2 drop-shadow-sm">
                {step.title}
              </h1>
              <p className="text-white/90 text-sm sm:text-base leading-relaxed whitespace-pre-line">
                {step.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* === القسم السفلي: النقاط + شريط + أزرار === */}
      <div className="flex-shrink-0 relative z-10 pb-6 sm:pb-8 safe-area-bottom">
        {/* مؤشر التقدم (النقاط) */}
        <div className="flex justify-center gap-2 mb-4 sm:mb-5">
          {ONBOARDING_STEPS.map((_, index) => (
            <motion.div
              key={index}
              layout
              className={`h-1.5 rounded-full transition-all duration-500 ${
                index === currentStep
                  ? "w-7 bg-[#00E676]"
                  : index < currentStep
                  ? "w-1.5 bg-[#00E676]/50"
                  : "w-1.5 bg-white/30"
              }`}
            />
          ))}
        </div>

        {/* شريط التقدم أثناء التقدم التلقائي */}
        <AnimatePresence>
          {isAutoAdvancing && !isLastStep && (
            <div className="px-8 mb-4 sm:mb-5">
              <div className="h-0.5 bg-white/15 rounded-full overflow-hidden">
                <motion.div
                  key={`progress-${currentStep}`}
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: STEP_DURATION / 1000, ease: "linear" }}
                  className="h-full bg-[#00E676]/60 rounded-full"
                />
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* الأزرار */}
        <div className="px-5 sm:px-6">
          <AnimatePresence mode="wait">
            {isLastStep && !locationDenied && (
              <motion.div
                key="location-btn"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Button
                  size="lg"
                  onClick={requestLocationPermission}
                  disabled={isRequestingLocation}
                  className="w-full h-12 sm:h-14 rounded-2xl text-base sm:text-lg font-bold bg-[#00E676] hover:bg-[#00E676]/90 text-black shadow-lg shadow-[#00E676]/25 transition-all active:scale-[0.98]"
                >
                  {isRequestingLocation ? (
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      جاري الطلب...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      السماح بالموقع والبدء
                    </span>
                  )}
                </Button>
                <p className="text-white/60 text-xs text-center mt-3">
                  🔒 لن يتم مشاركة موقعك مع أي طرف ثالث
                </p>
              </motion.div>
            )}

            {isLastStep && locationDenied && (
              <motion.div
                key="denied-btns"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <Button
                  size="lg"
                  onClick={requestLocationPermission}
                  className="w-full h-12 sm:h-14 rounded-2xl text-base sm:text-lg font-bold bg-[#00E676] hover:bg-[#00E676]/90 text-black"
                >
                  <Settings className="w-5 h-5 ml-2" />
                  إعادة المحاولة
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={handleContinueWithoutLocation}
                  className="w-full h-11 sm:h-12 rounded-2xl text-sm sm:text-base text-white/70 hover:text-white hover:bg-white/10"
                >
                  المتابعة بدون موقع
                </Button>
                <p className="text-white/60 text-xs text-center">
                  يمكنك تفعيل الموقع لاحقاً من إعدادات المتصفح
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default OnboardingFlow;
