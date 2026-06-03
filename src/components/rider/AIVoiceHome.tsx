/**
 * ران - الشاشة الرئيسية بالذكاء الاصطناعي الصوتي
 * Voice-First AI Home Screen — تصميم فاخر مطابق للصورة المرجعية
 * 
 * ═══════════════════════════════════════════════════════════════════
 * 🚧 ملاحظة مهمة: ميزة الصوت (Voice AI) معطّلة حالياً
 * ═══════════════════════════════════════════════════════════════════
 * السبب: تتطلب API دائماً للذكاء الاصطناعي (تكلفة مستمرة)
 * الخطة: إطلاق التطبيق بشكل مبدئي بوضع الكتابة فقط، ثم تفعيل
 *        الصوت في المرحلة الثانية
 * للتفعيل لاحقاً: غيّر ENABLE_VOICE_MODE = true (سطر 40)
 * ═══════════════════════════════════════════════════════════════════
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, MapPin, Shield, Sparkles, Volume2,
  Check, X, Map as MapIcon, Navigation, Send, Keyboard,
  ChevronLeft, Search, Clock, Home, Briefcase, Coffee,
  Dumbbell, Landmark, Car, Zap, Leaf, ArrowLeft, Menu,
  BookOpen, Stethoscope, Building2, Utensils, LayoutGrid, List
} from "lucide-react";
import RiderSideMenu from "@/components/rider/RiderSideMenu";
import { Button } from "@/components/ui/button";
import { useVoiceRecording, type VoiceResult, type VoiceState } from "@/hooks/useVoiceRecording";
import useRiderStore from "@/stores/riderStore";
import { useToast } from "@/hooks/use-toast";
import { prewarmSharedGoogleMap, reverseGeocodeCoordinates } from "@/lib/googleMapService";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import { GooglePlacesGeocodingAdapter } from "@/lib/adapters/GooglePlacesGeocodingAdapter";
import { NominatimGeocodingAdapter } from "@/lib/adapters/NominatimGeocodingAdapter";
import type { PlacePrediction } from "@/lib/adapters/types";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";
import { loadLandmarksCache, searchLandmarksByName } from "@/utils/landmarksCache";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { useAndroidBackButton } from "@/hooks/useAndroidBackButton";
import { preloadRiderRoute } from "@/lib/riderRoutePreload";
import { getLastKnownLocation } from "@/services/lastKnownLocationService";

const nominatimAdapter = new NominatimGeocodingAdapter();
const RAMADI_CENTER = { lat: 33.4233, lng: 43.2974 };

/* ──────────────────────────────────────────
   ثوابت
────────────────────────────────────────── */

// ═══════════════════════════════════════════════════════════════════
// 🚧 FEATURE FLAG: Voice Mode (وضع الصوت)
// ═══════════════════════════════════════════════════════════════════
// الحالة: معطّل مؤقتاً (DISABLED)
// السبب: يتطلب API دائماً للذكاء الاصطناعي الصوتي (تكلفة مستمرة)
// الخطة: تفعيله في المرحلة الثانية بعد إطلاق التطبيق بصورة مبدئية
// للتفعيل: غيّر ENABLE_VOICE_MODE إلى true
// ═══════════════════════════════════════════════════════════════════
const ENABLE_VOICE_MODE = false;

const VOICE_HINTS = [
  "لجامعة الأنبار",
  "لشارع المستودع",
  "لمستشفى الرمادي التعليمي",
  "لتقاطع الزيوت",
  "لحي التأميم",
  "لسوق الرمادي المركزي",
];

const QUICK_CATEGORIES = [
  {
    id: "landmarks",
    label: "معالم الرمادي",
    icon: <MapPin className="w-5 h-5" />,
    color: "bg-[#5bdda6]/10 text-[#5bdda6] border border-[#5bdda6]/30 shadow-[0_0_20px_rgba(91,221,166,0.15)]",
    items: [
      { name: "جسر فلسطين", lat: 33.437142, lng: 43.326012 },
      { name: "مجمع الأندلس", lat: 33.423985, lng: 43.313021 },
      { name: "ملعب الأنبار", lat: 33.402011, lng: 43.313045 },
      { name: "مدينة ألعاب الرمادي", lat: 33.432014, lng: 43.285098 }
    ]
  },
  {
    id: "roads",
    label: "شوارع وأحياء",
    icon: <Navigation className="w-5 h-5" />,
    color: "bg-blue-500/10 text-blue-400 border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.15)]",
    items: [
      { name: "شارع المستودع", lat: 33.422510, lng: 43.293021 },
      { name: "شارع 20", lat: 33.424100, lng: 43.291700 },
      { name: "شارع 17", lat: 33.426543, lng: 43.295055 },
      { name: "حي الأندلس", lat: 33.425022, lng: 43.310034 },
      { name: "حي التأميم", lat: 33.410041, lng: 43.260021 },
      { name: "شارع السيراميك", lat: 33.413020, lng: 43.288011 }
    ]
  },
  {
    id: "gov",
    label: "دوائر حكومية",
    icon: <Landmark className="w-5 h-5" />,
    color: "bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.15)]",
    items: [
      { name: "المرور العامة", lat: 33.421045, lng: 43.287012 },
      { name: "الجنسية والجوازات", lat: 33.427015, lng: 43.311088 },
      { name: "محكمة الرمادي", lat: 33.421544, lng: 43.295067 },
      { name: "ضريبة الرمادي", lat: 33.427099, lng: 43.302045 },
      { name: "المجمع الحكومي", lat: 33.428055, lng: 43.311022 },
      { name: "مديرية تربية الأنبار", lat: 33.425300, lng: 43.300500 },
      { name: "مديرية صحة الأنبار", lat: 33.424800, lng: 43.298700 },
      { name: "مديرية الكهرباء - الرمادي", lat: 33.423100, lng: 43.293400 },
      { name: "مديرية الماء - الرمادي", lat: 33.422700, lng: 43.291800 },
      { name: "مديرية الزراعة - الأنبار", lat: 33.426200, lng: 43.304100 },
      { name: "مديرية العمل والشؤون الاجتماعية", lat: 33.427500, lng: 43.308300 },
      { name: "محكمة استئناف الأنبار", lat: 33.421800, lng: 43.296200 },
      { name: "مجلس محافظة الأنبار", lat: 33.429100, lng: 43.312000 },
      { name: "مديرية البلدية - الرمادي", lat: 33.420500, lng: 43.290100 },
      { name: "دائرة التقاعد الوطني", lat: 33.426700, lng: 43.306800 }
    ]
  },
  {
    id: "health",
    label: "مستشفيات",
    icon: <Stethoscope className="w-5 h-5" />,
    color: "bg-rose-500/10 text-rose-400 border border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.15)]",
    items: [
      { name: "مستشفى الرمادي التعليمي", lat: 33.422532, lng: 43.313545 },
      { name: "مستشفى النسائية والولادة", lat: 33.421011, lng: 43.314055 },
      { name: "مستشفى الرشيد الأهلي", lat: 33.425088, lng: 43.315012 },
      { name: "مستشفى الأنبار العام", lat: 33.423400, lng: 43.312100 },
      { name: "مستشفى الأطفال - الرمادي", lat: 33.421900, lng: 43.315800 },
      { name: "مستشفى الصدر - الرمادي", lat: 33.424100, lng: 43.316200 },
      { name: "مستشفى الطوارئ - الرمادي", lat: 33.422800, lng: 43.314700 },
      { name: "مركز صحة حي التأميم", lat: 33.410200, lng: 43.261500 },
      { name: "مركز صحة حي الأندلس", lat: 33.425500, lng: 43.311300 },
      { name: "مركز صحة الحي العسكري", lat: 33.419800, lng: 43.284600 },
      { name: "مركز صحة البو فراج", lat: 33.418500, lng: 43.278900 }
    ]
  },
  {
    id: "food",
    label: "مطاعم وكافيهات",
    icon: <Utensils className="w-5 h-5" />,
    color: "bg-orange-500/10 text-orange-400 border border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.15)]",
    items: [
      { name: "مطعم حجي زياد", lat: 33.426511, lng: 43.303534 },
      { name: "البيت الدمشقي", lat: 33.425576, lng: 43.306012 },
      { name: "مطعم المضايف", lat: 33.425022, lng: 43.301044 },
      { name: "بيترو كافيه", lat: 33.422033, lng: 43.315066 },
      { name: "شنشل", lat: 33.420088, lng: 43.318045 },
      { name: "مطعم أبو عفيف", lat: 33.428310, lng: 43.300120 },
      { name: "مطعم الريف", lat: 33.424780, lng: 43.298530 },
      { name: "كافيه لافا", lat: 33.423150, lng: 43.310200 },
      { name: "مطعم الخيمة", lat: 33.427200, lng: 43.307800 },
      { name: "فلافل أبو يوسف", lat: 33.425900, lng: 43.295400 },
      { name: "مشويات الأنبار", lat: 33.421500, lng: 43.302100 },
      { name: "كافيه ديوان", lat: 33.424300, lng: 43.312500 },
      { name: "مطعم سمك الرمادي", lat: 33.430100, lng: 43.296700 },
      { name: "حلويات النجم", lat: 33.426800, lng: 43.309300 },
      { name: "مطعم بيت الكباب", lat: 33.423700, lng: 43.304600 }
    ]
  },
  {
    id: "universities",
    label: "جامعات الرمادي",
    icon: <BookOpen className="w-5 h-5" />,
    color: "bg-violet-500/10 text-violet-400 border border-violet-500/30 shadow-[0_0_20px_rgba(139,92,246,0.15)]",
    items: [
      { name: "جامعة الأنبار - الحرم الرئيسي", lat: 33.399525, lng: 43.263532 },
      { name: "كلية الطب - جامعة الأنبار", lat: 33.422100, lng: 43.312800 },
      { name: "كلية الهندسة - جامعة الأنبار", lat: 33.400200, lng: 43.264100 },
      { name: "كلية التربية للعلوم الصرفة", lat: 33.399800, lng: 43.262900 },
      { name: "كلية العلوم - جامعة الأنبار", lat: 33.400500, lng: 43.263000 },
      { name: "كلية الحقوق - جامعة الأنبار", lat: 33.399100, lng: 43.264500 },
      { name: "كلية الإدارة والاقتصاد", lat: 33.400800, lng: 43.262500 },
      { name: "كلية التربية - جامعة الأنبار", lat: 33.398700, lng: 43.263800 },
      { name: "كلية الزراعة - جامعة الأنبار", lat: 33.401200, lng: 43.261900 },
      { name: "كلية المعارف الجامعة - الأنبار", lat: 33.424500, lng: 43.299800 },
      { name: "المعهد التقني - الرمادي", lat: 33.418600, lng: 43.285300 }
    ]
  }
];

/* ────── أيقونات المفضلات ────── */
const FAV_ICON_MAP: Record<string, React.ReactNode> = {
  home: <Home className="w-5 h-5" />,
  work: <Briefcase className="w-5 h-5" />,
  cafe: <Coffee className="w-5 h-5" />,
  gym: <Dumbbell className="w-5 h-5" />,
  diwaniya: <Landmark className="w-5 h-5" />,
  carwash: <Car className="w-5 h-5" />,
  other: <MapPin className="w-5 h-5" />,
};

const FAV_NAMES: Record<string, string> = {
  home: 'المنزل',
  work: 'العمل',
  cafe: 'كافيه',
  gym: 'النادي',
  diwaniya: 'الديوانية',
  carwash: 'غسيل سيارات',
  other: 'موقع',
};

/* ──────────────────────────────────────────
   مكون: تلميحات دوارة
────────────────────────────────────────── */
const RotatingHints: React.FC<{ isPaused: boolean }> = ({ isPaused }) => {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (isPaused) return;
    const t = setInterval(() => setIdx((p) => (p + 1) % VOICE_HINTS.length), 2800);
    return () => clearInterval(t);
  }, [isPaused]);
  if (isPaused) return null;
  return (
    <div className="h-6 flex items-center justify-center overflow-hidden">
      <AnimatePresence mode="sync">
        <motion.p
          key={idx}
          className="text-sm text-emerald-400/50 text-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35 }}
        >
          جرب: "{VOICE_HINTS[idx]}"
        </motion.p>
      </AnimatePresence>
    </div>
  );
};

/* ──────────────────────────────────────────
   مكون: موجات الصوت
────────────────────────────────────────── */
const SoundWaves: React.FC<{ amplitude: number; isRecording: boolean }> = ({ amplitude, isRecording }) => {
  if (!isRecording) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-emerald-400/20"
          initial={{ width: 112, height: 112, opacity: 0 }}
          animate={{
            width: 112 + (i + 1) * 38 + amplitude * 55,
            height: 112 + (i + 1) * 38 + amplitude * 55,
            opacity: 0.45 - i * 0.09,
          }}
          transition={{ duration: 0.25, ease: "easeOut", delay: i * 0.04 }}
        />
      ))}
    </div>
  );
};

/* ──────────────────────────────────────────
   مكون: معالجة الذكاء الاصطناعي
────────────────────────────────────────── */
const AIProcessingView: React.FC = () => (
  <motion.div
    className="flex flex-col items-center gap-7"
    initial={{ opacity: 0, scale: 0.85 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.85 }}
  >
    <div className="relative w-28 h-28">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className={`absolute inset-${i * 2} rounded-full border-2 ${
            i === 0 ? "border-emerald-500/30" : i === 1 ? "border-emerald-400/50 border-t-transparent" : "border-emerald-300/70 border-b-transparent"
          }`}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{ duration: 2 - i * 0.4, repeat: Infinity, ease: "linear" }}
        />
      ))}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.18, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        >
          <Sparkles className="w-9 h-9 text-emerald-400" />
        </motion.div>
      </div>
    </div>
    <div className="text-center space-y-1.5">
      <motion.p
        className="text-xl font-bold text-white"
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.8, repeat: Infinity }}
      >
        نحلل طلبك...
      </motion.p>
      <p className="text-sm text-white/40">الذكاء الاصطناعي يبحث عن أفضل مسار</p>
    </div>
    <div className="flex gap-2">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-emerald-400"
          animate={{ y: [0, -8, 0], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </div>
  </motion.div>
);

/* ──────────────────────────────────────────
   مكون: مودال تأكيد المسار
────────────────────────────────────────── */
interface ConfirmModalProps {
  result: VoiceResult;
  onConfirm: () => void;
  onRetry: () => void;
  onCancel: () => void;
  isTextMode?: boolean; // للتمييز بين الصوت والكتابة
  multipleResults?: PlacePrediction[]; // نتائج بحث متعددة
  onSelectPlace?: (place: PlacePrediction) => void; // اختيار مكان من النتائج
}
const ConfirmModal: React.FC<ConfirmModalProps> = ({ result, onConfirm, onRetry, onCancel, isTextMode = false, multipleResults, onSelectPlace }) => (
  <motion.div
    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md px-4"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={onCancel}
  >
    <motion.div
      className="w-full max-w-lg rounded-3xl bg-gradient-to-b from-slate-900 to-[#0a1f0d] border border-white/10 p-6 pb-8 shadow-2xl"
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* مقبض */}
      <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />

      {/* عنوان */}
      <div className="flex items-center justify-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Check className="w-4 h-4 text-emerald-400" />
        </div>
        <h3 className="text-base font-bold text-white">هل تقصد هذا المسار؟</h3>
      </div>

      {/* ما قاله/كتبه المستخدم */}
      {result.transcript && (
        <div className="mb-4 px-4 py-3 rounded-2xl bg-white/5 border border-white/8">
          <p className="text-xs text-white/35 mb-1">
            {isTextMode ? "المكان المقصود:" : "ما قلته:"}
          </p>
          <p className="text-sm text-white/80" dir="rtl">"{result.transcript}"</p>
        </div>
      )}

      {/* المسار أو قائمة النتائج */}
      {multipleResults && multipleResults.length > 0 ? (
        <div className="space-y-2 mb-6 w-full max-h-[400px] overflow-y-auto">
          <p className="text-xs text-white/50 mb-3 text-center">اختر المكان المطلوب ({multipleResults.length} نتيجة):</p>
          {multipleResults.map((place, idx) => (
            <button
              key={place.place_id || idx}
              onClick={() => onSelectPlace?.(place)}
              className="w-full flex items-center px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all active:scale-[0.98]"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 ml-3">
                <MapPin className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0 text-right flex flex-col justify-center">
                <p className="text-sm font-semibold text-white truncate">{place.main_text}</p>
                <p className="text-xs text-white/40 truncate">{place.secondary_text || place.description}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2 mb-6 w-full">
          {result.origin && (
            <div className="flex items-center px-4 py-3 rounded-2xl bg-white/5 border border-white/8">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 ml-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 min-w-0 text-left flex flex-col justify-center">
                <p className="text-[10px] text-white/40 mb-0.5 uppercase tracking-wider">من</p>
                <p className="text-sm font-semibold text-white truncate">{result.origin.name}</p>
              </div>
            </div>
          )}
          <div className="flex justify-center">
            <div className="w-px h-4 bg-white/10" />
          </div>
          {result.destination && (
            <div className="flex items-center px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 ml-3">
                <MapPin className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0 text-left flex flex-col justify-center">
                <p className="text-[10px] text-emerald-400/60 mb-0.5 uppercase tracking-wider">إلى</p>
                <p className="text-sm font-semibold text-white truncate">{result.destination.name}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* أزرار */}
      <div className="flex gap-3" dir="rtl">
        {!multipleResults && (
          <Button
            onClick={onConfirm}
            className="flex-1 h-13 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/25 text-base"
          >
            <Check className="w-5 h-5 ml-2" /> تأكيد
          </Button>
        )}
        {ENABLE_VOICE_MODE && (
          <Button
            onClick={onRetry}
            variant="outline"
            className="h-13 px-5 border-white/15 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 rounded-2xl"
          >
            <Mic className="w-4 h-4" />
          </Button>
        )}
        <Button
          onClick={onCancel}
          variant="ghost"
          className={`h-13 px-4 text-white/30 hover:text-white/60 hover:bg-white/5 rounded-2xl ${multipleResults ? 'flex-1' : ''}`}
        >
          <X className="w-4 h-4" /> {multipleResults ? 'إلغاء' : ''}
        </Button>
      </div>
    </motion.div>
  </motion.div>
);

/* ──────────────────────────────────────────
   المكون الرئيسي
────────────────────────────────────────── */
const AIVoiceHome: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const setPickupLocation = useRiderStore((s) => s.setPickupLocation);
  const setDropoffLocation = useRiderStore((s) => s.setDropoffLocation);
  const pickupLocation = useRiderStore((s) => s.pickupLocation);
  const setVehicle = useRiderStore((s) => s.setVehicle);

  const voiceHook = useVoiceRecording();
  const voiceState = voiceHook.voiceState as string;
  const { result, error, amplitude, startRecording, stopRecording, resetVoice } = voiceHook;

  const [menuOpen, setMenuOpen] = useState(false);

  // [Android] Back button — close side menu first, then double-back to exit on root
  useAndroidBackButton(() => {
    if (menuOpen) { setMenuOpen(false); return true; }
    return false;
  });

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [isTextMode, setIsTextMode] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [isSubmittingText, setIsSubmittingText] = useState(false);
  const textInputRef = useRef<HTMLInputElement>(null);
  const [textResult, setTextResult] = useState<VoiceResult | null>(null);
  const [activeSavedPlaceIndex, setActiveSavedPlaceIndex] = useState(0);
  const [isSavedPlacesSliderPaused, setIsSavedPlacesSliderPaused] = useState(false);
  const [activeCategory, setActiveCategory] = useState("landmarks");
  const [categorySelected, setCategorySelected] = useState<string | null>(null);
  const [catViewMode, setCatViewMode] = useState<'grid' | 'tabs'>('grid');
  const [isSearching, setIsSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedPlaceCardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [savedPlacesExpanded, setSavedPlacesExpanded] = useState(false);

  // ═══ Pull-to-Refresh (سحب للتحديث) ═══
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullStartY = useRef<number | null>(null);
  const PULL_THRESHOLD = 100;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
    pullStartY.current = e.touches[0].clientY;
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (pullStartY.current === null || isRefreshing) return;
    const dy = e.touches[0].clientY - pullStartY.current;
    if (dy > 0) {
      setPullDistance(Math.min(dy * 0.5, PULL_THRESHOLD * 1.5));
    } else {
      setPullDistance(0);
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(() => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD);
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } else {
      setPullDistance(0);
    }
    pullStartY.current = null;
  }, [pullDistance, isRefreshing]);
  const [searchResults, setSearchResults] = useState<PlacePrediction[]>([]);
  
  const { apiKey: googleMapsApiKey } = useGoogleMapsApiKey();

  // ⚡ Pre-load Google Maps SDK, GoPage bundle, and Landmarks cache
  // so navigating to the map page is instant and local search works immediately
  useEffect(() => {
    if (googleMapsApiKey) {
      loadGoogleMaps(googleMapsApiKey).catch(() => {});
    }
    // Also pre-load the GoPage component bundle
    import("@/pages/rider/GoPage").catch(() => {});
    // ⚡ تحميل كاش المعالم المحلية — يجعل البحث فورياً عند الكتابة
    loadLandmarksCache().catch(() => {});
  }, [googleMapsApiKey]);

  const prepareGoMap = useCallback(() => {
    preloadRiderRoute("/rider/go");
    if (!googleMapsApiKey) return;

    const cachedLocation = getLastKnownLocation();
    const center = cachedLocation
      ? { lat: cachedLocation.lat, lng: cachedLocation.lng }
      : RAMADI_CENTER;

    void prewarmSharedGoogleMap(googleMapsApiKey, center);
  }, [googleMapsApiKey]);

  const isMicAvailable =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function";

  // المفضلات — جلب من قاعدة البيانات
  const [dbFavorites, setDbFavorites] = useState<Array<{
    id: string; name: string; address: string; lat: number; lng: number; icon: string | null;
  }>>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchSavedPlaces = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data, error } = await supabase
        .from('saved_places')
        .select('id, name, address, lat, lng, icon')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (!error && data && !cancelled) {
        setDbFavorites(data);
      }
    };
    fetchSavedPlaces();
    return () => { cancelled = true; };
  }, []);

  const normalizedFavorites = dbFavorites.filter(
    (fav) => typeof fav.lat === "number" && typeof fav.lng === "number" && Number.isFinite(fav.lat) && Number.isFinite(fav.lng)
  );

  // موقع الانطلاق
  const [pickupAddress, setPickupAddress] = useState<string | null>(null);
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoadingPickup, setIsLoadingPickup] = useState(true);
  const locationFetchedRef = useRef(false);

  useEffect(() => {
    if (locationFetchedRef.current) return;
    locationFetchedRef.current = true;
    if (!navigator.geolocation) { setIsLoadingPickup(false); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setPickupCoords({ lat, lng });
        try {
          const waitForGoogle = () => new Promise<void>((resolve) => {
            if (window.google?.maps) return resolve();
            const t = setInterval(() => { if (window.google?.maps) { clearInterval(t); resolve(); } }, 200);
            setTimeout(() => { clearInterval(t); resolve(); }, 8000);
          });
          await waitForGoogle();
          const addr = await reverseGeocodeCoordinates(lat, lng);
          if (addr) {
            const parts = addr.split(/[،,]/).map((p) => p.trim()).filter((p) => p && p !== "العراق" && p !== "Iraq");
            setPickupAddress(parts.slice(0, 2).join("، ") || addr);
          } else {
            setPickupAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }
        } catch {
          setPickupAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } finally { setIsLoadingPickup(false); }
      },
      () => setIsLoadingPickup(false),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }, []);

  const activeResult = textResult || result;
  const isProcessing = voiceState === "processing" || isSubmittingText;

  useEffect(() => {
    if (voiceState === "success" && result) setShowConfirmation(true);
  }, [voiceState, result]);

  // ── بحث حي أثناء الكتابة ──
  // الأولوية: 1️⃣ المعالم المحلية ← 2️⃣ Nominatim إضافي
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const trimmed = textInput.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const center = pickupCoords ?? { lat: 33.4233, lng: 43.2974 };

        const isArabicQuery = /[\u0600-\u06FF]/.test(trimmed);

        // ضمان تحميل الكاش للعربية (فوري إذا محمّل — ينتظر مرة واحدة فقط)
        if (isArabicQuery) await loadLandmarksCache();

        // 1️⃣ المعالم المحلية — فورية ومرنة (قلعه → قلعة أربيل)
        const localMatches = searchLandmarksByName(trimmed, 5);

        // استعلام عربي + نتائج محلية → تجاوز Nominatim كلياً
        // (Nominatim يُترجم "قلعة" → "castle" ويُرجع أماكن خاطئة)
        if (isArabicQuery && localMatches.length > 0) {
          setSearchResults(localMatches.slice(0, 6) as PlacePrediction[]);
          return;
        }

        // 2️⃣ Nominatim — للاستعلامات الإنجليزية أو العربية بدون نتائج محلية
        let nominatimResults: PlacePrediction[] = [];
        if (localMatches.length < 3) {
          try {
            const raw = await nominatimAdapter.searchPlaces(trimmed, center);
            nominatimResults = raw.slice(0, 4) as PlacePrediction[];
          } catch {
            // Nominatim محجوب — تجاهل الخطأ
          }
        }

        // دمج: المحلي أولاً مع إزالة التكرار
        const localIds = new Set(localMatches.map((l) => l.place_id));
        const combined = [
          ...localMatches,
          ...nominatimResults.filter((n) => !localIds.has(n.place_id)),
        ].slice(0, 6) as PlacePrediction[];

        setSearchResults(combined);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [textInput, pickupCoords]);

  useEffect(() => {
    if (activeSavedPlaceIndex >= normalizedFavorites.length) {
      setActiveSavedPlaceIndex(0);
    }
  }, [activeSavedPlaceIndex, normalizedFavorites.length]);

  useEffect(() => {
    if (isProcessing || isSavedPlacesSliderPaused || normalizedFavorites.length <= 1) return;
    const timer = setInterval(() => {
      setActiveSavedPlaceIndex((prev) => (prev + 1) % normalizedFavorites.length);
    }, 4200);
    return () => clearInterval(timer);
  }, [isProcessing, isSavedPlacesSliderPaused, normalizedFavorites.length]);

  useEffect(() => {
    const activeCard = savedPlaceCardRefs.current[activeSavedPlaceIndex];
    if (!activeCard) return;
    activeCard.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeSavedPlaceIndex]);

  useEffect(() => {
    if (error) {
      toast({ title: "خطأ في التسجيل الصوتي", description: error, variant: "destructive" });
      const t = setTimeout(() => { setIsTextMode(true); resetVoice(); }, 1200);
      return () => clearTimeout(t);
    }
  }, [error, toast, resetVoice]);

  const handleTextSubmit = useCallback(async () => {
    const trimmed = textInput.trim();
    if (!trimmed || trimmed.length < 2 || isSubmittingText) return;

    const isArabicQuery = /[\u0600-\u06FF]/.test(trimmed);

    // ── عربي: ابحث في المعالم المحلية أولاً (قبل أي اختصار) ──
    // يمنع اختيار نتائج قديمة من استعلام سابق عند ضغط Enter السريع
    if (isArabicQuery) {
      await loadLandmarksCache();
      const localMatches = searchLandmarksByName(trimmed, 5);
      if (localMatches.length > 0) {
        console.log(`[AIVoiceHome] ✅ عربي — معالم محلية: ${localMatches.length} نتيجة`);
        if (localMatches.length === 1) {
          const place = localMatches[0];
          const savedDropoff = { lat: place.lat, lng: place.lng, address: place.main_text };
          setDropoffLocation(savedDropoff);
          setPickupLocation(null);
          setVehicle("economy");
          navigate("/rider/go", { state: { fromVoice: true, fromSavedPlace: true, preferredMode: "pickup", savedDropoff, savedPickup: null } });
        } else {
          setSearchResults(localMatches as PlacePrediction[]);
          setTextResult({ transcript: trimmed, origin: null, destination: null, vehicleType: "economy" });
          setShowConfirmation(true);
        }
        return;
      }
      // لا نتائج محلية → تابع للاختصار أو Nominatim
    }

    // اختصار: إذا النتائج الحية موجودة → اختر الأولى مباشرة
    // (للاستعلامات غير العربية، أو العربية بدون نتائج محلية)
    if (searchResults.length > 0) {
      const first = searchResults[0];
      const savedDropoff = { lat: first.lat ?? 0, lng: first.lng ?? 0, address: first.description || first.main_text };
      setDropoffLocation(savedDropoff);
      setPickupLocation(null);
      setVehicle("economy");
      setSearchResults([]);
      setTextResult(null);
      navigate("/rider/go", { state: { fromVoice: true, fromSavedPlace: true, preferredMode: "pickup", savedDropoff, savedPickup: null } });
      return;
    }

    setIsSubmittingText(true);
    try {
      // ── Nominatim — للاستعلامات غير العربية أو العربية بدون نتائج محلية ──
      const center = pickupCoords ?? { lat: 33.4233, lng: 43.2974 };
      const results = await nominatimAdapter.searchPlaces(trimmed, center);
      
      console.log(`[AIVoiceHome] البحث عن "${trimmed}" - النتائج: ${results.length}`);
      
      if (results.length === 0) {
        toast({ 
          title: "لا توجد نتائج", 
          description: "لم يتم العثور على أماكن مطابقة. حاول البحث بكلمات مختلفة.", 
          variant: "destructive" 
        });
        setIsSubmittingText(false);
        return;
      }
      
      if (results.length === 1) {
        console.log(`[AIVoiceHome] ✅ نتيجة واحدة - اختيار مباشر: ${results[0].main_text}`);
        const place = results[0];
        const savedDropoff = { 
          lat: place.lat, 
          lng: place.lng, 
          address: place.description || place.main_text 
        };
        setDropoffLocation(savedDropoff);
        setPickupLocation(null);
        setVehicle("economy");
        navigate("/rider/go", {
          state: { fromVoice: true, fromSavedPlace: true, preferredMode: "pickup", savedDropoff, savedPickup: null },
        });
        setIsSubmittingText(false);
        return;
      }
      
      // نتائج متعددة → عرض قائمة للاختيار
      console.log(`[AIVoiceHome] 📋 عدة نتائج (${results.length}) - عرض القائمة`);
      setSearchResults(results as PlacePrediction[]);
      setTextResult({ transcript: trimmed, origin: null, destination: null, vehicleType: "economy" });
      setShowConfirmation(true);
      
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "حاول مرة أخرى";
      console.error("[AIVoiceHome] خطأ في البحث:", err);
      toast({ title: "خطأ في البحث", description: message, variant: "destructive" });
    } finally { 
      setIsSubmittingText(false); 
    }
  }, [textInput, isSubmittingText, searchResults, pickupCoords, toast, navigate, setDropoffLocation, setPickupLocation, setVehicle]);

  const handleDirectPlaceSelect = useCallback((place: { name: string, lat: number, lng: number }) => {
    // الاختيار المباشر من الأماكن السريعة (Quick Categories)
    // ينتقل مباشرة لـ GoPage بدون عرض ConfirmModal
    console.log(`[AIVoiceHome] ✅ اختيار مكان سريع: ${place.name}`);
    
    const savedDropoff = { 
      lat: place.lat, 
      lng: place.lng, 
      address: place.name 
    };
    
    setDropoffLocation(savedDropoff);
    setPickupLocation(null);
    setVehicle("economy");
    
    navigate("/rider/go", {
      state: {
        fromVoice: true,
        fromSavedPlace: true,
        preferredMode: "pickup",
        savedDropoff,
        savedPickup: null,
      },
    });
  }, [navigate, setDropoffLocation, setPickupLocation, setVehicle]);
  
  const handleSelectFromSearchResults = useCallback((place: PlacePrediction) => {
    console.log(`[AIVoiceHome] ✅ تم اختيار: ${place.main_text}`);
    const savedDropoff = { 
      lat: place.lat, 
      lng: place.lng, 
      address: place.description || place.main_text 
    };
    
    setDropoffLocation(savedDropoff);
    setPickupLocation(null);
    setVehicle("economy");
    setShowConfirmation(false);
    setSearchResults([]);
    setTextResult(null);
    
    navigate("/rider/go", {
      state: {
        fromVoice: true,
        fromSavedPlace: true,
        preferredMode: "pickup",
        savedDropoff,
        savedPickup: null,
      },
    });
  }, [navigate, setDropoffLocation, setPickupLocation, setVehicle]);

  const handlePressStart = useCallback(() => { setIsPressing(true); startRecording(); }, [startRecording]);
  const handlePressEnd = useCallback(async () => {
    setIsPressing(false);
    if (voiceState === "recording") await stopRecording();
  }, [voiceState, stopRecording]);

  const handleConfirm = useCallback(() => {
    if (!activeResult) return;
    const origin = activeResult.origin || (pickupCoords && pickupAddress ? { lat: pickupCoords.lat, lng: pickupCoords.lng, name: pickupAddress } : null);
    
    // ✅ تحويل البيانات لصيغة يفهمها GoPage
    const savedPickup = origin ? { lat: origin.lat, lng: origin.lng, address: origin.name } : null;
    const savedDropoff = activeResult.destination ? { lat: activeResult.destination.lat, lng: activeResult.destination.lng, address: activeResult.destination.name } : null;
    
    if (savedPickup) setPickupLocation(savedPickup);
    if (savedDropoff) setDropoffLocation(savedDropoff);
    if (activeResult.vehicleType) setVehicle(activeResult.vehicleType);
    setShowConfirmation(false);
    
    // حدد الوضع التالي حسب البيانات المتوفرة
    let preferredMode: string;
    if (savedPickup && savedDropoff) {
      preferredMode = 'booking'; // كل البيانات جاهزة → مباشرة للحجز
    } else if (savedDropoff && !savedPickup) {
      preferredMode = 'pickup'; // وجهة فقط → يحتاج يحدد الانطلاق
    } else {
      preferredMode = 'dropoff'; // انطلاق فقط → يحتاج يحدد الوجهة
    }
    
    navigate("/rider/go", { 
      state: { 
        fromVoice: true,
        fromSavedPlace: true, // عشان GoPage يعالج الـ state
        savedPickup,
        savedDropoff,
        preferredMode,
      } 
    });
  }, [activeResult, pickupCoords, pickupAddress, navigate, setPickupLocation, setDropoffLocation, setVehicle]);

  const handleRetry = useCallback(() => { 
    setShowConfirmation(false); 
    setTextResult(null); 
    setSearchResults([]);
    resetVoice(); 
  }, [resetVoice]);
  const handleCancel = useCallback(() => { 
    setShowConfirmation(false); 
    setTextResult(null); 
    setSearchResults([]);
    resetVoice(); 
  }, [resetVoice]);

  const buildCurrentLocationPickup = useCallback(async () => {
    if (!navigator.geolocation) return null;

    const coords = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    });

    if (!coords) return null;

    try {
      const address = await reverseGeocodeCoordinates(coords.lat, coords.lng);
      return {
        lat: coords.lat,
        lng: coords.lng,
        address: address || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
      };
    } catch {
      return {
        lat: coords.lat,
        lng: coords.lng,
        address: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
      };
    }
  }, []);

  const handleSavedPlaceTo = useCallback(async (fav: (typeof normalizedFavorites)[number]) => {
    // الوجهة = المكان المحفوظ
    const savedDropoff = { lat: fav.lat, lng: fav.lng, address: fav.address || fav.name };
    setDropoffLocation(savedDropoff);

    // مسح الانطلاق ليقوم المستخدم بتحديده بنفسه على الخريطة
    setPickupLocation(null);

    navigate("/rider/go", {
      state: {
        fromVoice: true,
        fromSavedPlace: true,
        preferredMode: "pickup", // الذهاب لتحديد موقع الانطلاق
        savedDropoff,
        savedPickup: null, // لا نرسل موقع انطلاق ليحدده المستخدم
      },
    });
  }, [navigate, setDropoffLocation, setPickupLocation]);

  const micBg = voiceState === "recording"
    ? "bg-emerald-500 shadow-[0_0_50px_rgba(52,211,153,0.55)] border-emerald-400/80"
    : voiceState === "processing"
    ? "bg-emerald-500/25 border-emerald-500/40 cursor-wait"
    : voiceState === "error"
    ? "bg-red-500/20 border-red-500/40"
    : "bg-white/8 border-white/15 hover:bg-white/12 hover:border-emerald-500/40";

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden select-none ai-voice-home-root"
      dir="rtl"
      style={{ background: "linear-gradient(170deg, #060d18 0%, #0b1326 40%, #091120 100%)" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── مؤشر السحب للتحديث ── */}
      <AnimatePresence>
        {pullDistance > 0 && (
          <motion.div
            className="absolute top-0 left-0 right-0 z-[200] flex items-center justify-center"
            style={{ height: pullDistance }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
          >
            <motion.div
              className="flex flex-col items-center gap-1.5"
              animate={{
                rotate: isRefreshing ? 360 : (pullDistance / PULL_THRESHOLD) * 180,
                scale: Math.min(1, pullDistance / PULL_THRESHOLD),
              }}
              transition={isRefreshing ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : { duration: 0.1 }}
            >
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors duration-200 ${
                pullDistance >= PULL_THRESHOLD ? 'border-[#5bdda6] bg-[#5bdda6]/20' : 'border-white/20 bg-white/5'
              }`}>
                <svg className={`w-4 h-4 transition-colors duration-200 ${pullDistance >= PULL_THRESHOLD ? 'text-[#5bdda6]' : 'text-white/40'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              {pullDistance >= PULL_THRESHOLD && (
                <motion.span
                  className="text-[10px] font-bold text-[#5bdda6]"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {isRefreshing ? 'جاري التحديث...' : 'اترك للتحديث'}
                </motion.span>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <style dangerouslySetInnerHTML={{ __html: `
        .ai-voice-home-root,
        .ai-voice-home-root * {
          font-family: 'Cairo', 'Tajawal', sans-serif !important;
        }
      `}} />
      {/* ── زر القائمة الجانبية ── */}
      {!menuOpen && (
      <div 
        className="absolute top-0 right-0 z-30 pb-4 px-4"
        style={{ paddingTop: "max(16px, calc(env(safe-area-inset-top, 0px) + 16px))" }}
      >
        <motion.button
          onClick={() => setMenuOpen(true)}
          className="w-10 h-10 rounded-xl bg-[#5bdda6] flex items-center justify-center shadow-[0_0_20px_rgba(91,221,166,0.45)] hover:bg-[#4ecf99] active:bg-[#3dbe88] transition-all duration-200"
          whileTap={{ scale: 0.92 }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Menu className="w-5 h-5 text-[#0b1326]" />
        </motion.button>
      </div>
      )}

      {/* ── القائمة الجانبية ── */}
      <RiderSideMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      {/* ── خلفية ديكورية — شبكة خريطة ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* تأثير التوهج */}
        <div className="absolute top-[-8%] right-[-15%] w-[320px] h-[320px] rounded-full bg-[#5bdda6]/[0.04] blur-[90px]" />
        <div className="absolute top-[30%] left-[-10%] w-[250px] h-[250px] rounded-full bg-[#5bdda6]/[0.03] blur-[80px]" />
        <div className="absolute bottom-[10%] right-[20%] w-[280px] h-[280px] rounded-full bg-[#5bdda6]/[0.03] blur-[100px]" />
        {/* شبكة — تمثل الخريطة */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(91,221,166,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(91,221,166,0.3) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />
        {/* خطوط قطرية — تمثل الطرق */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(45deg, rgba(91,221,166,0.4) 1px, transparent 1px),
              linear-gradient(-45deg, rgba(91,221,166,0.4) 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px",
          }}
        />
      </div>
      {/* ── المنطقة الوسطى — الصوت / الكتابة ── */}
      <motion.div 
        className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 mb-16"
        animate={{ y: savedPlacesExpanded ? -220 : -60 }}
        transition={{ type: "spring", stiffness: 250, damping: 25 }}
      >
        <AnimatePresence mode="sync">
          {isProcessing ? (
            <AIProcessingView key="processing" />
          ) : !ENABLE_VOICE_MODE || isTextMode || !isMicAvailable ? (
            /* ── وضع الكتابة ── */
            <motion.div
              key="text-mode"
              className="w-full flex flex-col items-center gap-5 -translate-y-16"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* العنوان */}
              <div className="text-center space-y-2">
                <h1 className="text-4xl font-black text-white tracking-tight leading-tight">
                  وين تحب تروح؟
                </h1>
              </div>

              {/* ── حقل الوجهة فقط ── */}
              <div className="w-full max-w-sm flex items-center rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0f1a2e]/80 backdrop-blur-md shadow-xl" dir="rtl">
                {textInput.length > 0 && (
                  <motion.button
                    onClick={() => { setTextInput(''); textInputRef.current?.focus(); }}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    className="flex-shrink-0 mr-3 ml-1 w-9 h-9 min-w-[2.25rem] rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center hover:bg-red-500/30 active:bg-red-500/40 transition-all duration-200"
                    whileTap={{ scale: 0.92 }}
                  >
                    <X className="w-4 h-4 text-red-400" />
                  </motion.button>
                )}
                <input
                  ref={textInputRef}
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleTextSubmit(); }}
                  placeholder="إلى أين؟"
                  className={`flex-1 min-w-0 bg-transparent text-white text-[15px] font-medium py-4 placeholder:text-white/25 outline-none text-left overflow-hidden text-ellipsis ${textInput.length > 0 ? 'pl-4 pr-1' : 'px-4'}`}
                  dir="ltr"
                  disabled={isSubmittingText}
                />
              </div>

              {/* ── نتائج البحث الحي أو اقتراحات المسارات ── */}
              <div className="w-full max-w-sm mt-3" dir="rtl">
                <AnimatePresence mode="sync">

                  {/* ══ حالة الكتابة: نتائج بحث حية ══ */}
                  {textInput.trim().length >= 2 ? (
                    <motion.div
                      key="live-results"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.18 }}
                      className="flex flex-col gap-0 rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0f1a2e]/90 backdrop-blur-md"
                    >
                      {/* مؤشر البحث */}
                      {isSearching && (
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.05]">
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>
                            <Zap className="w-3.5 h-3.5 text-[#5bdda6]" />
                          </motion.div>
                          <span className="text-[11px] text-white/40 font-semibold">جاري البحث...</span>
                        </div>
                      )}

                      {/* لا نتائج */}
                      {!isSearching && searchResults.length === 0 && (
                        <div className="flex items-center gap-3 px-4 py-4">
                          <div className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center shrink-0">
                            <Search className="w-4 h-4 text-white/20" />
                          </div>
                          <div className="text-right">
                            <p className="text-[13px] font-bold text-white/50">لا توجد نتائج</p>
                            <p className="text-[11px] text-white/25">جرّب كلمات مختلفة</p>
                          </div>
                        </div>
                      )}

                      {/* النتائج */}
                      <AnimatePresence mode="popLayout">
                        {searchResults.map((place, idx) => (
                          <motion.button
                            key={place.place_id || place.main_text}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ delay: idx * 0.035, duration: 0.15 }}
                            onClick={() => handleSelectFromSearchResults(place)}
                            whileTap={{ scale: 0.98 }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.05] active:bg-white/[0.08] transition-colors border-b border-white/[0.04] last:border-b-0 text-right"
                          >
                            <div className="w-8 h-8 rounded-xl bg-[#5bdda6]/10 border border-[#5bdda6]/20 flex items-center justify-center shrink-0">
                              <MapPin className="w-4 h-4 text-[#5bdda6]" />
                            </div>
                            <div className="flex-1 min-w-0 text-right">
                              <p className="text-[13px] font-bold text-white truncate">{place.main_text}</p>
                              {place.secondary_text && (
                                <p className="text-[11px] text-white/40 truncate">{place.secondary_text}</p>
                              )}
                            </div>
                            <ChevronLeft className="w-3.5 h-3.5 text-white/20 shrink-0" />
                          </motion.button>
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  ) : (
                    /* ══ حالة الفراغ: التصنيفات ══ */
                    <motion.div
                      key="categories-section"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="flex flex-col gap-0"
                    >

                  {/* ── شريط زر التبديل ── */}
                  <div className="flex items-center justify-center gap-3 mb-2.5">
                    <div className="flex items-center gap-1 bg-white/[0.05] rounded-xl p-1 border border-white/[0.07]">
                      <button
                        onClick={() => { setCatViewMode('grid'); setCategorySelected(null); }}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 ${
                          catViewMode === 'grid'
                            ? 'bg-[#5bdda6] shadow-[0_0_10px_rgba(91,221,166,0.4)] text-[#0b1326]'
                            : 'text-white/30 hover:text-white/60'
                        }`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setCatViewMode('tabs'); setCategorySelected(null); }}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 ${
                          catViewMode === 'tabs'
                            ? 'bg-[#5bdda6] shadow-[0_0_10px_rgba(91,221,166,0.4)] text-[#0b1326]'
                            : 'text-white/30 hover:text-white/60'
                        }`}
                      >
                        <List className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <AnimatePresence mode="sync">
                    {/* ══════ وضع المربعات ══════ */}
                    {catViewMode === 'grid' && !categorySelected && (
                    <motion.div
                      key="cat-grid"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.94, y: -8 }}
                      transition={{ duration: 0.22, ease: [0.32,0.72,0,1] }}
                      className="grid grid-cols-3 gap-2.5"
                    >
                      {QUICK_CATEGORIES.map((cat, i) => (
                        <motion.button
                          key={cat.id}
                          initial={{ opacity: 0, y: 12, scale: 0.92 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ delay: i * 0.045, duration: 0.22 }}
                          onClick={() => { setActiveCategory(cat.id); setCategorySelected(cat.id); }}
                          whileTap={{ scale: 0.93 }}
                          className={`aspect-square flex flex-col items-center justify-center gap-1.5 rounded-2xl border backdrop-blur-md transition-all duration-200 hover:brightness-110 active:brightness-90 select-none ${cat.color}`}
                        >
                          <span className="text-xl">{cat.icon}</span>
                          <span className="text-[13px] font-bold text-center leading-tight px-1">{cat.label}</span>
                        </motion.button>
                      ))}
                    </motion.div>
                  )}

                  {/* ══════ قائمة الأماكن (مشتركة بين الوضعين) ══════ */}
                  {catViewMode === 'grid' && categorySelected && (
                    <motion.div
                      key={`places-grid-${categorySelected}`}
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 30 }}
                      transition={{ duration: 0.22, ease: [0.32,0.72,0,1] }}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex flex-row-reverse items-center gap-2 mb-1">
                        <button
                          onClick={() => setCategorySelected(null)}
                          className="w-8 h-8 rounded-xl bg-[#5bdda6] flex items-center justify-center shadow-[0_0_16px_rgba(91,221,166,0.45)] hover:bg-[#4ecf99] active:bg-[#3dbe88] active:scale-90 transition-all flex-shrink-0"
                        >
                          <ChevronLeft className="w-4 h-4 text-[#0b1326]" />
                        </button>
                        <span className={`flex-1 text-left text-sm font-bold ${QUICK_CATEGORIES.find(c=>c.id===categorySelected)?.color.split(' ')[1] ?? 'text-white/60'}`}>
                          {QUICK_CATEGORIES.find(c => c.id === categorySelected)?.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto custom-scrollbar pb-1 pr-0.5" dir="rtl">
                        <AnimatePresence mode="popLayout">
                          {QUICK_CATEGORIES.find(c => c.id === categorySelected)?.items.map((place, idx) => (
                            <motion.button
                              key={place.name}
                              initial={{ opacity: 0, scale: 0.88, y: 6 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.88 }}
                              transition={{ delay: idx * 0.03, duration: 0.18 }}
                              onClick={() => handleDirectPlaceSelect(place)}
                              whileTap={{ scale: 0.94 }}
                              className="px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-white/80 text-[12px] font-semibold hover:bg-white/[0.1] hover:text-white hover:border-white/15 transition-all whitespace-nowrap"
                            >
                              {place.name}
                            </motion.button>
                          ))}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}

                  {/* ══════ وضع التابات ══════ */}
                  {catViewMode === 'tabs' && (
                    <motion.div
                      key="cat-tabs"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.22, ease: [0.32,0.72,0,1] }}
                      className="flex flex-col gap-3"
                    >
                      {/* شريط التابات */}
                      <div className="flex flex-row overflow-x-auto gap-2 custom-scrollbar -mx-5 px-5 pb-2 select-none w-[calc(100%+2.5rem)]">
                        {QUICK_CATEGORIES.map((cat) => {
                          const isActive = activeCategory === cat.id;
                          return (
                            <button
                              key={cat.id}
                              onClick={() => setActiveCategory(cat.id)}
                              className={`relative flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl whitespace-nowrap text-[12px] font-bold transition-all duration-300 backdrop-blur-md flex-shrink-0 ${
                                isActive
                                  ? cat.color
                                  : 'bg-[#0b1326]/60 text-white/40 border border-white/5 hover:bg-white/5 hover:border-white/10 hover:text-white/70'
                              }`}
                            >
                              {cat.icon}
                              <span>{cat.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      {/* عناصر التاب النشط */}
                      <div className="flex flex-wrap gap-2 max-h-[130px] overflow-y-auto custom-scrollbar pb-2 pt-0.5 pr-0.5" dir="rtl">
                        <AnimatePresence mode="popLayout">
                          {QUICK_CATEGORIES.find(c => c.id === activeCategory)?.items.map((place, idx) => (
                            <motion.button
                              key={place.name}
                              initial={{ opacity: 0, scale: 0.9, y: 5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              transition={{ delay: idx * 0.025, duration: 0.18 }}
                              onClick={() => handleDirectPlaceSelect(place)}
                              whileTap={{ scale: 0.96 }}
                              className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/80 text-[13px] font-semibold hover:bg-white/[0.08] hover:text-white transition-all whitespace-nowrap"
                            >
                              {place.name}
                            </motion.button>
                          ))}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}

                  </AnimatePresence>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>

            </motion.div>
          ) : (
            /* ══════════════════════════════════════════════════════════════
               🚧 وضع الصوت — معطّل مؤقتاً (Voice Mode - Temporarily Disabled)
               ══════════════════════════════════════════════════════════════
               هذا القسم يحتوي على ميزة الذكاء الاصطناعي الصوتي (AI Voice)
               - يتطلب API دائماً (تكلفة مستمرة على السيرفر)
               - سيتم تفعيله في المرحلة الثانية بعد الإطلاق المبدئي
               - للتفعيل: غيّر ENABLE_VOICE_MODE = true في أعلى الملف
               ══════════════════════════════════════════════════════════════ */
            /* ── وضع الصوت ── */
            <motion.div
              key="voice-mode"
              className="flex flex-col items-center gap-7 -translate-y-16"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
            >
              {/* الشعار */}
              <div className="relative mb-2">
                <motion.div
                  className="absolute inset-[-6px] rounded-full border border-[#5bdda6]/20"
                  animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.45, 0.2] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                />
                <img
                  src={logo}
                  alt="RAAN"
                  className="w-16 h-16 rounded-full object-cover drop-shadow-2xl border-2 border-white/10"
                />
              </div>

              {/* العنوان */}
              <div className="text-center space-y-2.5 px-6">
                <motion.h1
                  className="text-3xl font-black text-white tracking-tight leading-tight"
                  initial={{ y: 16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15 }}
                >
                  وين تحب تروح؟
                </motion.h1>
                <motion.p
                  className="text-sm text-white/35 leading-relaxed max-w-[260px] mx-auto"
                  initial={{ y: 16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.28 }}
                >
                  سولف براحتك.. وإحنا نفهمك ونحجزلك 🚕
                </motion.p>
              </div>

              {/* زر المايكروفون */}
              <motion.div
                className="relative"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
              >
                <SoundWaves amplitude={amplitude} isRecording={voiceState === "recording"} />

                {/* حلقة نابضة */}
                <motion.div
                  className="absolute inset-[-18px] rounded-full border border-[#5bdda6]/15"
                  animate={voiceState === "idle" ? { scale: [1, 1.12, 1], opacity: [0.15, 0.35, 0.15] } : { scale: 1, opacity: 0 }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                  className="absolute inset-[-35px] rounded-full border border-[#5bdda6]/8"
                  animate={voiceState === "idle" ? { scale: [1, 1.08, 1], opacity: [0.08, 0.2, 0.08] } : { scale: 1, opacity: 0 }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                />

                <motion.button
                  className={`relative w-28 h-28 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${micBg}`}
                  whileTap={{ scale: 0.9 }}
                  onPointerDown={handlePressStart}
                  onPointerUp={handlePressEnd}
                  onPointerLeave={() => { if (isPressing) handlePressEnd(); }}
                  disabled={voiceState === "processing"}
                  aria-label={voiceState === "recording" ? "ارفع إصبعك لإيقاف التسجيل" : "اضغط وتكلم"}
                >
                  <AnimatePresence mode="sync">
                    {voiceState === "recording" ? (
                      <motion.div key="rec" initial={{ scale: 0 }} animate={{ scale: [1, 1.12, 1] }} exit={{ scale: 0 }} transition={{ duration: 0.9, repeat: Infinity }}>
                        <Volume2 className="w-11 h-11 text-white drop-shadow-lg" />
                      </motion.div>
                    ) : voiceState === "error" ? (
                      <motion.div key="err" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <MicOff className="w-11 h-11 text-red-400" />
                      </motion.div>
                    ) : (
                      <motion.div key="idle" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <Mic className="w-11 h-11 text-[#5bdda6]" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </motion.div>

              {/* تعليمات */}
              <div className="space-y-2.5 text-center">
                <motion.p
                  className="text-sm text-white/30"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.65 }}
                >
                  {voiceState === "recording"
                    ? "🎙️ يسمعك... ارفع إصبعك عند الانتهاء"
                    : voiceState === "error"
                    ? "❌ حاول مرة أخرى"
                    : "🎤 اضغط مطولاً وتكلم"}
                </motion.p>
                <RotatingHints isPaused={voiceState === "recording" || voiceState === "processing"} />
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      {/* ══════════════════════════════════════
         البانل السفلي — Bottom Sheet متكامل
         ══════════════════════════════════════ */}
      {!menuOpen && (
      <motion.div
        className="absolute bottom-0 left-0 right-0 w-full z-[100]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        {/* ── Bottom Sheet الموحّد: مقبض + محتوى ── */}
        <motion.div
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.15}
          onDragEnd={(_, info) => {
            if (info.offset.y < -40) setSavedPlacesExpanded(true);
            else if (info.offset.y > 40) setSavedPlacesExpanded(false);
          }}
          className="bg-[#0b1326]/98 backdrop-blur-xl border-t border-[#5bdda6]/10 shadow-[0_-10px_40px_rgba(11,19,38,0.6)] rounded-t-3xl"
          style={{ WebkitBackdropFilter: 'blur(20px)' }}
        >
          {/* خط توهج أعلى الشيت */}
          <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#5bdda6]/25 to-transparent rounded-t-3xl" />

          {/* ── المقبض — زر الفتح/الإغلاق دائماً في الأعلى ── */}
          <div
            className="flex flex-col items-center justify-center pt-3 pb-2 gap-1 cursor-grab active:cursor-grabbing touch-none select-none"
            onClick={() => setSavedPlacesExpanded((v) => !v)}
          >
            {/* شريط السحب المتحرك */}
            <motion.div
              className="rounded-full"
              animate={{
                width: 48,
                height: 4,
                backgroundColor: savedPlacesExpanded ? '#5bdda6' : '#475569',
              }}
              transition={{ duration: 0.3 }}
            />

          </div>

          {/* ── محتوى الأماكن المحفوظة — يظهر تحت المقبض مباشرة ── */}
          <AnimatePresence>
            {savedPlacesExpanded && normalizedFavorites.length > 0 && (
              <motion.div
                key="saved-places-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <div className="pt-1 pb-4 border-t border-[#5bdda6]/10">
                  <div className="flex gap-3 justify-start overflow-x-auto no-scrollbar pb-1 px-4" dir="rtl">
                    {normalizedFavorites.map((fav) => (
                      <motion.button
                        key={fav.id}
                        whileTap={{ scale: 0.93 }}
                        onClick={() => { setSavedPlacesExpanded(false); handleSavedPlaceTo(fav); }}
                        className="flex-shrink-0 flex flex-col items-center gap-2 w-[76px] group"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-[#131d35] border border-[#5bdda6]/15 flex items-center justify-center group-active:border-[#5bdda6]/50 group-active:bg-[#1a2a3e] transition-all duration-200 shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
                          <span className="text-xl text-[#5bdda6]">
                            {FAV_ICON_MAP[fav.icon || 'other'] ?? FAV_ICON_MAP['other']}
                          </span>
                        </div>
                        <span className="text-[11px] text-white/55 font-semibold truncate w-full text-center leading-tight">
                          {fav.name || FAV_NAMES[fav.icon || 'other']}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
            {savedPlacesExpanded && normalizedFavorites.length === 0 && (
              <motion.div
                key="saved-places-empty"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="px-4 py-5 flex flex-col items-center gap-2 border-t border-[#5bdda6]/10"
              >
                <span className="text-2xl opacity-30">📍</span>
                <p className="text-xs text-white/25 text-center">لا توجد أماكن محفوظة بعد</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── صف الأزرار — ملاصق للأسفل ── */}
          <div
            className="w-full flex border-t border-[#5bdda6]/10"
            style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}
          >
            {/* استخدم الخريطة */}
            <button
              onPointerDown={prepareGoMap}
              onMouseEnter={() => preloadRiderRoute("/rider/go")}
              onClick={() => {
                prepareGoMap();
                navigate("/rider/go");
              }}
              style={{ fontFamily: "Cairo, sans-serif" }}
              className="flex-auto h-[72px] rounded-none flex items-center justify-center gap-2 text-lg font-black touch-manipulation pointer-events-auto active:scale-[0.98] transition-colors border-t border-[#5bdda6]/30 text-[#0b1326] bg-[#5bdda6] hover:bg-[#4ecf99] active:bg-[#3dbe88]"
            >
              <MapIcon className="w-5 h-5 text-[#0b1326]" />
              <span className="text-[#0b1326]">استخدم الخريطة</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
      )}
      {/* ── مودال التأكيد ── */}
      <AnimatePresence>
        {showConfirmation && activeResult && (
          <ConfirmModal
            result={activeResult}
            onConfirm={handleConfirm}
            onRetry={handleRetry}
            onCancel={handleCancel}
            isTextMode={!ENABLE_VOICE_MODE || isTextMode || !!textResult}
            multipleResults={searchResults.length > 0 ? searchResults : undefined}
            onSelectPlace={handleSelectFromSearchResults}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AIVoiceHome;
