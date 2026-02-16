/**
 * ران - الشاشة الرئيسية بالذكاء الاصطناعي الصوتي
 * Voice-First AI Home Screen — الابتكار الأول عالمياً في تطبيقات التاكسي
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, MapPin, Shield, Sparkles, Volume2, ArrowLeft, Check, X, Map as MapIcon, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoiceRecording, type VoiceResult, type VoiceState } from "@/hooks/useVoiceRecording";
import useRiderStore from "@/stores/riderStore";
import { useToast } from "@/hooks/use-toast";
import { reverseGeocodeCoordinates } from "@/lib/googleMapService";
import logo from "@/assets/logo.png";

// ========================
// ثوابت: أمثلة التلميحات الصوتية الدوارة
// ========================
const VOICE_HINTS = [
  "جرب أن تقول: لجامعة الأنبار",
  "جرب أن تقول: لشارع المستودع",
  "جرب أن تقول: لمستشفى الرمادي التعليمي",
  "جرب أن تقول: لتقاطع الزيوت",
  "جرب أن تقول: لحي التأميم",
  "جرب أن تقول: لسوق الرمادي المركزي",
];

// ========================
// المكون الفرعي: عنوان الانطلاق المكتشف تلقائياً
// ========================
const PickupHeader: React.FC<{ address: string | null; isLoading: boolean }> = ({ address, isLoading }) => (
  <motion.div
    className="w-full px-6"
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.3 }}
  >
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-primary/15 backdrop-blur-sm">
      <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
        <Navigation className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-primary/50 mb-0.5">سيأخذك السائق من</p>
        {isLoading ? (
          <motion.p
            className="text-sm text-white/40 truncate"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            جاري تحديد أقرب نقطة دالة...
          </motion.p>
        ) : (
          <p className="text-sm font-semibold text-white/90 truncate">
            {address || "لم يتم تحديد الموقع"}
          </p>
        )}
      </div>
    </div>
  </motion.div>
);

// ========================
// المكون الفرعي: تلميحات صوتية دوارة
// ========================
const RotatingHints: React.FC<{ isPaused: boolean }> = ({ isPaused }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % VOICE_HINTS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isPaused]);

  if (isPaused) return null;

  return (
    <div className="h-8 flex items-center justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.p
          key={currentIndex}
          className="text-sm text-primary/50 text-center px-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          {VOICE_HINTS[currentIndex]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
};

// ========================
// المكون الفرعي: موجات الصوت
// ========================
const SoundWaves: React.FC<{ amplitude: number; isRecording: boolean }> = ({ amplitude, isRecording }) => {
  if (!isRecording) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border-2 border-primary/30"
          initial={{ width: 120, height: 120, opacity: 0 }}
          animate={{
            width: 120 + (i + 1) * 40 + amplitude * 60,
            height: 120 + (i + 1) * 40 + amplitude * 60,
            opacity: isRecording ? 0.4 - i * 0.08 : 0,
          }}
          transition={{
            duration: 0.3,
            ease: "easeOut",
            delay: i * 0.05,
          }}
        />
      ))}
    </div>
  );
};

// ========================
// المكون الفرعي: أنيميشن تحليل الذكاء الاصطناعي
// ========================
const AIProcessingAnimation: React.FC = () => (
  <motion.div
    className="flex flex-col items-center gap-6"
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.8 }}
  >
    {/* دائرة متحركة مع شرارات */}
    <div className="relative w-32 h-32">
      <motion.div
        className="absolute inset-0 rounded-full border-4 border-primary/40"
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute inset-2 rounded-full border-4 border-primary/60 border-t-transparent"
        animate={{ rotate: -360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute inset-4 rounded-full border-4 border-primary/80 border-b-transparent"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <Sparkles className="w-10 h-10 text-primary" />
        </motion.div>
      </div>
    </div>

    {/* النص */}
    <div className="text-center space-y-2">
      <motion.p
        className="text-xl font-bold text-white"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        الذكاء الاصطناعي يحلل طلبك...
      </motion.p>
      <p className="text-sm text-white/50">
        نبحث عن أفضل مسار لرحلتك
      </p>
    </div>

    {/* نقاط التحميل */}
    <div className="flex gap-2">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-3 h-3 rounded-full bg-primary"
          animate={{ y: [0, -10, 0], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  </motion.div>
);

// ========================
// المكون الفرعي: نتيجة التحليل
// ========================
interface ConfirmationModalProps {
  result: VoiceResult;
  onConfirm: () => void;
  onRetry: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ result, onConfirm, onRetry, onCancel }) => (
  <motion.div
    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <motion.div
      className="w-full max-w-md rounded-3xl bg-gradient-to-b from-[#0a1f0a] to-[#0d2d0d] border border-primary/30 p-6 shadow-2xl"
      initial={{ scale: 0.8, y: 40 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.8, y: 40 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      {/* عنوان */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <Check className="w-5 h-5 text-primary" />
        </div>
        <h3 className="text-lg font-bold text-white">هل تقصد هذا المسار؟</h3>
      </div>

      {/* النص المحول */}
      {result.transcript && (
        <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/10">
          <p className="text-xs text-white/40 mb-1">ما قلته:</p>
          <p className="text-sm text-white/80 leading-relaxed" dir="rtl">"{result.transcript}"</p>
        </div>
      )}

      {/* تفاصيل المسار */}
      <div className="space-y-3 mb-6">
        {result.origin && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-primary/60">من</p>
              <p className="text-sm font-semibold text-white">{result.origin.name}</p>
            </div>
          </div>
        )}

        {/* خط واصل */}
        <div className="flex justify-center">
          <div className="w-px h-4 bg-primary/30" />
        </div>

        {result.destination && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MapPin className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-emerald-400/60">إلى</p>
              <p className="text-sm font-semibold text-white">{result.destination.name}</p>
            </div>
          </div>
        )}
      </div>

      {/* أزرار */}
      <div className="flex gap-3">
        <Button
          onClick={onConfirm}
          className="flex-1 h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg shadow-primary/30"
        >
          <Check className="w-5 h-5 ml-2" />
          تأكيد
        </Button>
        <Button
          onClick={onRetry}
          variant="outline"
          className="h-12 px-5 border-white/20 text-white/70 hover:text-white hover:bg-white/10 rounded-xl"
        >
          <Mic className="w-5 h-5 ml-1" />
          أعد
        </Button>
        <Button
          onClick={onCancel}
          variant="ghost"
          className="h-12 px-4 text-white/40 hover:text-white/70 hover:bg-white/5 rounded-xl"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>
    </motion.div>
  </motion.div>
);

// ========================
// المكون الرئيسي: AIVoiceHome
// ========================
const AIVoiceHome: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const setPickupLocation = useRiderStore((s) => s.setPickupLocation);
  const setDropoffLocation = useRiderStore((s) => s.setDropoffLocation);
  const setVehicle = useRiderStore((s) => s.setVehicle);

  const voiceHook = useVoiceRecording();
  const voiceState = voiceHook.voiceState as string;
  const { result, error, amplitude, startRecording, stopRecording, resetVoice } = voiceHook;

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isPressing, setIsPressing] = useState(false);

  // === حالة موقع الانطلاق المكتشف تلقائياً ===
  const [pickupAddress, setPickupAddress] = useState<string | null>(null);
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoadingPickup, setIsLoadingPickup] = useState(true);
  const locationFetchedRef = useRef(false);

  // عند تحميل الشاشة → جلب الموقع الحالي وتحويله لعنوان مقروء
  useEffect(() => {
    if (locationFetchedRef.current) return;
    locationFetchedRef.current = true;

    if (!navigator.geolocation) {
      setIsLoadingPickup(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        setPickupCoords({ lat, lng });

        try {
          // انتظار تحميل Google Maps SDK
          const waitForGoogle = () =>
            new Promise<void>((resolve) => {
              if (window.google?.maps) return resolve();
              const interval = setInterval(() => {
                if (window.google?.maps) {
                  clearInterval(interval);
                  resolve();
                }
              }, 200);
              // timeout بعد 8 ثواني
              setTimeout(() => { clearInterval(interval); resolve(); }, 8000);
            });

          await waitForGoogle();

          const address = await reverseGeocodeCoordinates(lat, lng);
          if (address) {
            // تنظيف العنوان — إزالة "العراق" والأجزاء الزائدة
            const cleanParts = address
              .split(/[،,]/)
              .map((p) => p.trim())
              .filter((p) => p && p !== "العراق" && p !== "Iraq");
            const shortAddress = cleanParts.slice(0, 2).join("، ");
            setPickupAddress(shortAddress || address);
          } else {
            setPickupAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }
        } catch (err) {
          console.error("Voice home reverse geocode error:", err);
          setPickupAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } finally {
          setIsLoadingPickup(false);
        }
      },
      (err) => {
        console.warn("Geolocation error:", err.message);
        setIsLoadingPickup(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }, []);

  // عند نجاح التحليل → عرض مودال التأكيد
  useEffect(() => {
    if (voiceState === 'success' && result) {
      setShowConfirmation(true);
    }
  }, [voiceState, result]);

  // عرض الأخطاء
  useEffect(() => {
    if (error) {
      toast({
        title: "خطأ في التسجيل الصوتي",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // بدء الضغط المستمر على الزر
  const handlePressStart = useCallback(() => {
    setIsPressing(true);
    startRecording();
  }, [startRecording]);

  // رفع الإصبع → إيقاف التسجيل
  const handlePressEnd = useCallback(async () => {
    setIsPressing(false);
    if (voiceState === 'recording') {
      await stopRecording();
    }
  }, [voiceState, stopRecording]);

  // تأكيد المسار → الانتقال للخريطة
  const handleConfirm = useCallback(() => {
    if (!result) return;

    // استخدام الموقع المكتشف تلقائياً إذا لم يحدد المستخدم نقطة انطلاق
    const origin = result.origin || (pickupCoords && pickupAddress ? {
      lat: pickupCoords.lat,
      lng: pickupCoords.lng,
      name: pickupAddress,
    } : null);

    if (origin) {
      setPickupLocation({
        lat: origin.lat,
        lng: origin.lng,
        address: origin.name,
      });
    }

    if (result.destination) {
      setDropoffLocation({
        lat: result.destination.lat,
        lng: result.destination.lng,
        address: result.destination.name,
      });
    }

    if (result.vehicleType) {
      setVehicle(result.vehicleType);
    }

    setShowConfirmation(false);

    // الانتقال لصفحة الخريطة مع المسار
    navigate('/rider/go', {
      state: {
        fromVoice: true,
        origin: origin,
        destination: result.destination,
      },
    });
  }, [result, pickupCoords, pickupAddress, navigate, setPickupLocation, setDropoffLocation, setVehicle]);

  // إعادة المحاولة
  const handleRetry = useCallback(() => {
    setShowConfirmation(false);
    resetVoice();
  }, [resetVoice]);

  // إلغاء
  const handleCancel = useCallback(() => {
    setShowConfirmation(false);
    resetVoice();
  }, [resetVoice]);

  // الانتقال للخريطة التقليدية
  const handleUseMap = useCallback(() => {
    navigate('/rider/go');
  }, [navigate]);

  // تحديد لون/حالة زر المايكروفون
  const getMicButtonStyle = () => {
    switch (voiceState) {
      case 'recording':
        return 'bg-primary shadow-[0_0_60px_rgba(34,197,94,0.6)] border-primary/80';
      case 'processing':
        return 'bg-primary/30 border-primary/40 cursor-wait';
      case 'error':
        return 'bg-red-500/20 border-red-500/40';
      default:
        return 'bg-primary/20 border-primary/40 hover:bg-primary/30 hover:border-primary/60';
    }
  };

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-between overflow-hidden select-none"
      dir="rtl"
      style={{
        background: 'radial-gradient(ellipse at 50% 20%, #0a2e0a 0%, #050f05 50%, #020802 100%)',
      }}
    >
      {/* === خلفية ديكورية === */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* توهجات خضراء */}
        <div className="absolute top-[15%] left-[20%] w-80 h-80 bg-primary/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-[25%] right-[15%] w-96 h-96 bg-primary/5 rounded-full blur-[150px]" />
        <div className="absolute top-[60%] left-[60%] w-64 h-64 bg-emerald-500/4 rounded-full blur-[100px]" />

        {/* شبكة نقاط خافتة */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, #22c55e 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* === الجزء العلوي: اللوغو + عنوان الانطلاق === */}
      <motion.div
        className="relative z-10 pt-16 pb-2 flex flex-col items-center gap-3 w-full"
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <img src={logo} alt="ران" className="w-16 h-16 mb-1 drop-shadow-2xl" />
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary/60" />
          <span className="text-xs font-medium text-primary/50 tracking-wider">مدعوم بالذكاء الاصطناعي</span>
          <Sparkles className="w-4 h-4 text-primary/60" />
        </div>

        {/* عنوان الانطلاق المكتشف تلقائياً */}
        <PickupHeader address={pickupAddress} isLoading={isLoadingPickup} />
      </motion.div>

      {/* === الجزء الأوسط: زر المايكروفون === */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center -mt-8">
        <AnimatePresence mode="wait">
          {voiceState === 'processing' ? (
            <AIProcessingAnimation key="processing" />
          ) : (
            <motion.div
              key="mic-area"
              className="flex flex-col items-center gap-8"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              {/* العنوان */}
              <div className="text-center space-y-3 px-8">
                <motion.h1
                  className="text-3xl font-black text-white leading-snug"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  وين تحب تروح؟
                </motion.h1>
                <motion.p
                  className="text-base text-white/40 leading-relaxed max-w-xs mx-auto"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.35 }}
                >
                  تكلم بحرية، الذكاء الاصطناعي يسمعك ويحجز لك.
                </motion.p>
              </div>

              {/* زر المايكروفون */}
              <motion.div className="relative" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: "spring" }}>
                {/* موجات الصوت */}
                <SoundWaves amplitude={amplitude} isRecording={voiceState === 'recording'} />

                {/* الحلقة الخارجية النابضة */}
                <motion.div
                  className="absolute inset-[-20px] rounded-full border-2 border-primary/20"
                  animate={
                    voiceState === 'idle'
                      ? { scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }
                      : { scale: 1, opacity: 0 }
                  }
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />

                <motion.button
                  className={`relative w-28 h-28 rounded-full border-4 flex items-center justify-center transition-colors duration-300 ${getMicButtonStyle()}`}
                  whileTap={{ scale: 0.92 }}
                  onPointerDown={handlePressStart}
                  onPointerUp={handlePressEnd}
                  onPointerLeave={() => {
                    if (isPressing) handlePressEnd();
                  }}
                  disabled={voiceState === 'processing'}
                  aria-label={voiceState === 'recording' ? 'ارفع إصبعك لإيقاف التسجيل' : 'اضغط وتكلم'}
                >
                  <AnimatePresence mode="wait">
                    {voiceState === 'recording' ? (
                      <motion.div
                        key="recording-icon"
                        initial={{ scale: 0 }}
                        animate={{ scale: [1, 1.15, 1] }}
                        exit={{ scale: 0 }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        <Volume2 className="w-12 h-12 text-white drop-shadow-lg" />
                      </motion.div>
                    ) : voiceState === 'error' ? (
                      <motion.div key="error-icon" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <MicOff className="w-12 h-12 text-red-400" />
                      </motion.div>
                    ) : (
                      <motion.div key="idle-icon" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <Mic className="w-12 h-12 text-primary" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </motion.div>

              {/* تلميحات / تعليمات حسب الحالة */}
              <div className="space-y-2">
                <motion.p
                  className="text-sm text-white/30 text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                >
                  {voiceState === 'recording'
                    ? '🎙️ يسمعك... ارفع إصبعك عندما تنتهي'
                    : voiceState === 'error'
                    ? '❌ حاول مرة أخرى'
                    : '🎤 اضغط مطولاً وتكلم'}
                </motion.p>

                {/* التلميحات الصوتية الدوارة */}
                <RotatingHints isPaused={voiceState === 'recording' || voiceState === 'processing'} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* === الجزء السفلي === */}
      <motion.div
        className="relative z-10 w-full px-6 pb-8 space-y-4"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        {/* شارة الخصوصية */}
        <div className="flex items-center justify-center gap-2 py-2">
          <Shield className="w-3.5 h-3.5 text-primary/40" />
          <span className="text-[11px] text-white/25">صوتك يُعالج بالذكاء الاصطناعي فقط — لا يُخزَّن</span>
        </div>

        {/* زر الخريطة البديل */}
        <Button
          onClick={handleUseMap}
          variant="ghost"
          className="w-full h-14 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 font-semibold text-base gap-3 transition-all duration-300"
        >
          <MapIcon className="w-5 h-5" />
          استخدم الخريطة بدلاً من الصوت
        </Button>
      </motion.div>

      {/* === مودال التأكيد === */}
      <AnimatePresence>
        {showConfirmation && result && (
          <ConfirmationModal
            result={result}
            onConfirm={handleConfirm}
            onRetry={handleRetry}
            onCancel={handleCancel}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AIVoiceHome;
