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
import { Geolocation } from "@capacitor/geolocation";

interface OnboardingFlowProps {
  onComplete: () => void;
}

const HERO_GIF = "https://j.top4top.io/p_3697pycno1.gif";
const STEP_DURATION = 3000;

const RIDER_ONBOARDING_STEPS = [
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

const DRIVER_ONBOARDING_STEPS = [
  {
    id: 1,
    title: "مرحباً بك كابتن في ران!",
    description: "ابدأ رحلتك لتحقيق دخل إضافي.",
  },
  {
    id: 2,
    title: "طلبات قريبة منك",
    description: "سنقوم بتوجيه الطلبات الأقرب لموقعك.",
  },
  {
    id: 3,
    title: "إدارة أرباحك بذكاء",
    description: "تتبع رحلاتك ومكاسبك بكل سهولة.",
  },
  {
    id: 4,
    title: "حدد موقعك للبدء",
    description: "للبدء، نحتاج لتفعيل موقعك الحالي\nلاستقبال طلبات الركاب.",
  },
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const isDriver = typeof window !== "undefined" && (window.location.port === "8082" || window.location.hostname.includes("driver"));
  const ONBOARDING_STEPS = React.useMemo(() => isDriver ? DRIVER_ONBOARDING_STEPS : RIDER_ONBOARDING_STEPS, [isDriver]);
  
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
  }, [currentStep, isAutoAdvancing, isLastStep, ONBOARDING_STEPS.length]);

  const completeOnboarding = useCallback(() => {
    setHasSeenOnboarding(true);
    onComplete();
  }, [onComplete, setHasSeenOnboarding]);

  const handleSkip = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsAutoAdvancing(false);
    setCurrentStep(ONBOARDING_STEPS.length - 1);
  }, [ONBOARDING_STEPS.length]);

  const requestLocationPermission = useCallback(async () => {
    setIsRequestingLocation(true);
    setLocationDenied(false);

    try {
      // First try to request permissions explicitly
      const permissionStatus = await Geolocation.requestPermissions();
      if (permissionStatus.location !== 'granted') {
        throw new Error('Location permission denied via Capacitor');
      }

      await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      localStorage.setItem("location_permission_requested", "true");
      localStorage.setItem("location_permission_granted", "true");
      setIsRequestingLocation(false);
      completeOnboarding();
    } catch (error: unknown) {
      console.error("[Onboarding] Error requesting location via Capacitor:", error);
      
      // Fallback to navigator.geolocation for web
      try {
        navigator.geolocation.getCurrentPosition(
          (_position) => {
            localStorage.setItem("location_permission_requested", "true");
            localStorage.setItem("location_permission_granted", "true");
            setIsRequestingLocation(false);
            completeOnboarding();
          },
          (navError) => {
            console.warn("[Onboarding] Web fallback location permission denied:", navError.message);
            localStorage.setItem("location_permission_requested", "true");
            localStorage.setItem("location_permission_granted", "false");
            setIsRequestingLocation(false);
            setLocationDenied(true);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } catch (fallbackError) {
        setIsRequestingLocation(false);
        setLocationDenied(true);
      }
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
      className={`fixed inset-0 z-[100] flex flex-col overflow-hidden text-white ${isDriver ? 'bg-[#0a2012]' : 'bg-[#090b0a]'}`}
    >
      {/* المؤثرات الخلفية الفخمة */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#00E676]/10 blur-[130px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[#00E676]/5 blur-[150px]" />
      </div>

      {/* زر تخطي */}
      <AnimatePresence>
        {!isLastStep && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-12 lg:top-8 left-4 z-[200]"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full shadow-lg border border-white/10 px-5 py-2 text-sm font-medium tracking-wide backdrop-blur-md transition-all"
            >
              تخطي
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === القسم العلوي: GIF متجاوب === */}
      <div className="flex-shrink-0 flex items-center justify-center pt-16 sm:pt-24 pb-4 sm:pb-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: gifLoaded ? 1 : 0, scale: gifLoaded ? 1 : 0.85 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative"
        >
          {/* هالة فخمة خلف الصورة */}
          <div className="absolute inset-0 bg-[#00E676]/20 rounded-full blur-[70px] scale-150" />
          
          <div className="relative p-1 rounded-full bg-gradient-to-b from-white/10 to-transparent shadow-[0_0_50px_rgba(0,230,118,0.15)]">
            <img
              src={HERO_GIF}
              alt="RAAN"
              onLoad={() => setGifLoaded(true)}
              className="w-[180px] h-[180px] sm:w-[240px] sm:h-[240px] rounded-full object-cover relative z-10 border border-[#00E676]/20 object-center bg-black/50"
              draggable={false}
            />
          </div>
        </motion.div>
      </div>

      {/* === القسم الأوسط: النص المتبدل === */}
      <div className="flex-1 flex flex-col items-center justify-start px-6 relative z-10 min-h-0 pt-4">
        <div className="w-full max-w-[320px] text-center min-h-[7rem] sm:min-h-[8rem] flex flex-col items-center justify-start">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="w-full"
            >
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight drop-shadow-md">
                {step.title}
              </h1>
              <p className="text-white/60 text-sm sm:text-base leading-relaxed whitespace-pre-line font-light">
                {step.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* === القسم السفلي: النقاط + شريط + أزرار داخل كارت زجاجي === */}
      <div className="flex-shrink-0 relative z-10 pb-8 sm:pb-10 safe-area-bottom px-4 sm:px-6">
        <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-[2rem] p-6 shadow-2xl">
          {/* مؤشر التقدم (النقاط) */}
          <div className="flex justify-center gap-2 mb-6">
            {ONBOARDING_STEPS.map((_, index) => (
              <motion.div
                key={index}
                layout
                className={`rounded-full transition-all duration-500 shadow-sm ${
                  index === currentStep
                    ? "w-8 h-1.5 bg-[#00E676] shadow-[#00E676]/50"
                    : index < currentStep
                    ? "w-1.5 h-1.5 bg-[#00E676]/40"
                    : "w-1.5 h-1.5 bg-white/10"
                }`}
              />
            ))}
          </div>

          {/* شريط التقدم أثناء التقدم التلقائي */}
          <AnimatePresence>
            {isAutoAdvancing && !isLastStep && (
              <div className="mb-6 px-4">
                <div className="h-[2px] bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    key={`progress-${currentStep}`}
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: STEP_DURATION / 1000, ease: "linear" }}
                    className="h-full bg-[#00E676] shadow-[0_0_10px_#00E676] rounded-full"
                  />
                </div>
              </div>
            )}
          </AnimatePresence>

          {/* الأزرار */}
          <div className="w-full">
            <AnimatePresence mode="wait">
              {isLastStep && !locationDenied && (
                <motion.div
                  key="location-btn"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-4"
                >
                  <Button
                    size="lg"
                    onClick={requestLocationPermission}
                    disabled={isRequestingLocation}
                    className="w-full h-14 text-base sm:text-lg font-bold bg-[#00E676] hover:bg-[#00E676]/90 text-black shadow-[0_0_20px_rgba(0,230,118,0.25)] transition-all active:scale-[0.98] rounded-xl"
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
                </motion.div>
              )}

              {isLastStep && locationDenied && (
                <motion.div
                  key="denied-btns"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <Button
                    size="lg"
                    onClick={requestLocationPermission}
                    className="w-full h-14 text-base sm:text-lg font-bold bg-[#00E676] hover:bg-[#00E676]/90 text-black shadow-[0_0_20px_rgba(0,230,118,0.25)] rounded-xl"
                  >
                    <Settings className="w-5 h-5 ml-2" />
                    إعدادات الموقع
                  </Button>
                  <Button
                    size="lg"
                    variant="ghost"
                    onClick={handleContinueWithoutLocation}
                    className="w-full h-12 text-sm sm:text-base text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                  >
                    المتابعة بدون موقع
                  </Button>
                  <p className="text-white/40 text-[11px] text-center pt-1">
                    يمكنك تفعيل الموقع لاحقاً من إعدادات المتصفح
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default OnboardingFlow;
