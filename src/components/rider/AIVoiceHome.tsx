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

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, MapPin, Shield, Sparkles, Volume2,
  Check, X, Map as MapIcon, Navigation, Send, Keyboard,
  ChevronLeft, Search, Clock, Home, Briefcase, Coffee,
  Dumbbell, Landmark, Car, Zap, Leaf, ArrowLeft, Menu,
  BookOpen, Stethoscope, Building2, Utensils
} from "lucide-react";
import RiderSideMenu from "@/components/rider/RiderSideMenu";
import { Button } from "@/components/ui/button";
import { useVoiceRecording, type VoiceResult, type VoiceState } from "@/hooks/useVoiceRecording";
import useRiderStore from "@/stores/riderStore";
import { useToast } from "@/hooks/use-toast";
import { reverseGeocodeCoordinates } from "@/lib/googleMapService";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import { GooglePlacesGeocodingAdapter } from "@/lib/adapters/GooglePlacesGeocodingAdapter";
import type { PlacePrediction } from "@/lib/adapters/types";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";

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
    icon: <MapPin className="w-3.5 h-3.5" />,
    color: "bg-[#5bdda6]/10 text-[#5bdda6] border border-[#5bdda6]/30 shadow-[0_0_20px_rgba(91,221,166,0.15)]",
    items: [
      { name: "جامعة الأنبار", lat: 33.399525, lng: 43.263532 },
      { name: "جسر فلسطين", lat: 33.437142, lng: 43.326012 },
      { name: "مجمع الأندلس", lat: 33.423985, lng: 43.313021 },
      { name: "ملعب الأنبار", lat: 33.402011, lng: 43.313045 },
      { name: "مدينة ألعاب الرمادي", lat: 33.432014, lng: 43.285098 }
    ]
  },
  {
    id: "roads",
    label: "شوارع وأحياء",
    icon: <Navigation className="w-3.5 h-3.5" />,
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
    icon: <Landmark className="w-3.5 h-3.5" />,
    color: "bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.15)]",
    items: [
      { name: "المرور العامة", lat: 33.421045, lng: 43.287012 },
      { name: "الجنسية والجوازات", lat: 33.427015, lng: 43.311088 },
      { name: "محكمة الرمادي", lat: 33.421544, lng: 43.295067 },
      { name: "ضريبة الرمادي", lat: 33.427099, lng: 43.302045 },
      { name: "المجمع الحكومي", lat: 33.428055, lng: 43.311022 }
    ]
  },
  {
    id: "health",
    label: "مستشفيات",
    icon: <Stethoscope className="w-3.5 h-3.5" />,
    color: "bg-rose-500/10 text-rose-400 border border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.15)]",
    items: [
      { name: "مستشفى الرمادي التعليمي", lat: 33.422532, lng: 43.313545 },
      { name: "النسائية والولادة", lat: 33.421011, lng: 43.314055 },
      { name: "الرشيد الأهلي", lat: 33.425088, lng: 43.315012 }
    ]
  },
  {
    id: "food",
    label: "مطاعم وكافيهات",
    icon: <Utensils className="w-3.5 h-3.5" />,
    color: "bg-orange-500/10 text-orange-400 border border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.15)]",
    items: [
      { name: "مطعم حجي زياد", lat: 33.426511, lng: 43.303534 },
      { name: "البيت الدمشقي", lat: 33.425576, lng: 43.306012 },
      { name: "مطعم المضايف", lat: 33.425022, lng: 43.301044 },
      { name: "بيترو كافيه", lat: 33.422033, lng: 43.315066 },
      { name: "شنشل", lat: 33.420088, lng: 43.318045 }
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
      <AnimatePresence mode="wait">
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
  const savedPlaceCardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [savedPlacesExpanded, setSavedPlacesExpanded] = useState(false);
  const [searchResults, setSearchResults] = useState<PlacePrediction[]>([]);
  
  const { apiKey: googleMapsApiKey } = useGoogleMapsApiKey();

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
    
    setIsSubmittingText(true);
    try {
      // استخدام Google Places API للبحث
      const adapter = new GooglePlacesGeocodingAdapter(googleMapsApiKey);
      await adapter.load();
      
      // البحث في الرمادي
      const centerRamadi = { lat: 33.4233, lng: 43.2974 };
      const results = await adapter.searchPlaces(trimmed, centerRamadi);
      
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
        // نتيجة واحدة فقط → اختيارها مباشرة والذهاب لصفحة GoPage
        console.log(`[AIVoiceHome] ✅ نتيجة واحدة - اختيار مباشر: ${results[0].main_text}`);
        const place = results[0];
        const savedDropoff = { 
          lat: place.lat, 
          lng: place.lng, 
          address: place.description || place.main_text 
        };
        
        setDropoffLocation(savedDropoff);
        setPickupLocation(null); // يختار المستخدم موقع الانطلاق على الخريطة
        setVehicle("economy");
        
        navigate("/rider/go", {
          state: {
            fromVoice: true,
            fromSavedPlace: true,
            preferredMode: "pickup", // يحدد موقع الانطلاق
            savedDropoff,
            savedPickup: null,
          },
        });
        
        setIsSubmittingText(false);
        return;
      }
      
      // نتائج متعددة → عرض قائمة للاختيار
      console.log(`[AIVoiceHome] 📋 عدة نتائج (${results.length}) - عرض القائمة`);
      setSearchResults(results);
      setTextResult({
        transcript: trimmed,
        origin: null,
        destination: null,
        vehicleType: "economy"
      });
      setShowConfirmation(true);
      
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "حاول مرة أخرى";
      console.error("[AIVoiceHome] خطأ في البحث:", err);
      toast({ 
        title: "خطأ في البحث", 
        description: message,
        variant: "destructive" 
      });
    } finally { 
      setIsSubmittingText(false); 
    }
  }, [textInput, isSubmittingText, toast, googleMapsApiKey, navigate, setDropoffLocation, setPickupLocation, setVehicle]);

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
      className="fixed inset-0 flex flex-col overflow-hidden select-none"
      dir="rtl"
      style={{ background: "linear-gradient(170deg, #060d18 0%, #0b1326 40%, #091120 100%)" }}
    >
      {/* ── زر القائمة الجانبية ── */}
      <div 
        className="absolute top-0 right-0 z-30 pb-4 px-4"
        style={{ paddingTop: "max(16px, calc(env(safe-area-inset-top, 0px) + 16px))" }}
      >
        <motion.button
          onClick={() => setMenuOpen(true)}
          className="w-11 h-11 rounded-2xl bg-[#5bdda6] flex items-center justify-center shadow-[0_0_20px_rgba(91,221,166,0.45)] hover:bg-[#4ecf99] active:bg-[#3dbe88] transition-all duration-200"
          whileTap={{ scale: 0.92 }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Menu className="w-5 h-5 text-[#0b1326]" />
        </motion.button>
      </div>

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
        <AnimatePresence mode="wait">
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
                <p className="text-sm text-white/35 leading-relaxed max-w-[260px] mx-auto">
                  اكتب وجهتك والذكاء الاصطناعي يحجز لك 🚕
                </p>
              </div>

              {/* حقل الإدخال */}
              <div className="w-full max-w-sm relative">
                <div className="flex items-center bg-[#0f1a2e]/80 border-2 border-[#5bdda6]/15 rounded-2xl focus-within:border-[#5bdda6]/50 transition-all duration-300 focus-within:bg-[#0f1a2e]">
                  <motion.button
                    onClick={handleTextSubmit}
                    disabled={!textInput.trim() || textInput.trim().length < 2 || isSubmittingText}
                    className="flex-shrink-0 mr-2 ml-1 w-10 h-10 min-w-[2.5rem] rounded-xl bg-[#5bdda6] hover:bg-[#4ecf99] active:bg-[#3dbe88] disabled:bg-white/8 disabled:opacity-50 flex items-center justify-center transition-all"
                    whileTap={{ scale: 0.92 }}
                  >
                    <Send className="w-4.5 h-4.5 text-[#0b1326] disabled:text-white/40" />
                  </motion.button>
                  <input
                    ref={textInputRef}
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleTextSubmit(); }}
                    placeholder="  مثال: جامعة الأنبار..."
                    className="flex-1 min-w-0 bg-transparent text-white text-base pl-6 pr-2 py-4 placeholder:text-white/20 outline-none text-left overflow-hidden text-ellipsis"
                    dir="rtl"
                    autoFocus
                    disabled={isSubmittingText}
                  />
                </div>
              </div>

              {/* ── اقتراحات مسارات (مصنفة ومضغوطة) ── */}
              <div className="w-full max-w-sm flex flex-col gap-4 mt-2" dir="rtl">
                {/* شريط الأقسام (Tabs) */}
                <div className="flex flex-row overflow-x-auto gap-2.5 pt-3 pb-3 no-scrollbar -mx-5 px-5 select-none justify-start w-[calc(100%+2.5rem)]">
                  {QUICK_CATEGORIES.map((cat) => {
                    const isActive = activeCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`relative flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl whitespace-nowrap text-[12px] font-bold transition-all duration-300 backdrop-blur-md ${
                          isActive
                            ? cat.color
                            : "bg-[#0b1326]/60 text-white/40 border border-white/5 hover:bg-white/5 hover:border-white/10 hover:text-white/70"
                        }`}
                      >
                        {cat.icon}
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* عناصر القسم النشط */}
                <div className="flex flex-wrap gap-2 max-h-[130px] overflow-y-auto no-scrollbar pb-2 pt-1 w-[calc(100%+1.5rem)] -mx-3 px-3 justify-end text-right" dir="rtl">
                  <AnimatePresence mode="popLayout">
                    {QUICK_CATEGORIES.find((c) => c.id === activeCategory)?.items.map((place) => (
                      <motion.button
                        key={place.name}
                        initial={{ opacity: 0, scale: 0.9, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => handleDirectPlaceSelect(place)}
                        className="px-3.5 py-2 rounded-xl bg-white/[0.04] flex items-center justify-center text-white/80 text-[13px] font-semibold hover:bg-white/[0.08] hover:text-white transition-all whitespace-nowrap"
                        whileTap={{ scale: 0.96 }}
                      >
                        {place.name}
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
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
                  <AnimatePresence mode="wait">
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
            {/* أيقونة + نص */}
            <div className="flex items-center gap-2 mt-0.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shadow-[0_0_12px_rgba(91,221,166,0.25)] transition-all duration-300 ${
                savedPlacesExpanded
                  ? 'bg-[#5bdda6]/20 border border-[#5bdda6]/30'
                  : 'bg-[#5bdda6]/10 border border-[#5bdda6]/20'
              }`}>
                <motion.div
                  animate={{ rotate: savedPlacesExpanded ? 90 : -90 }}
                  transition={{ type: 'tween', duration: 0.25 }}
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-[#5bdda6]" />
                </motion.div>
              </div>
              <p className="text-[13px] font-bold tracking-widest text-[#5bdda6]/60 uppercase">
                {savedPlacesExpanded ? 'أغلق' : 'أماكنك المحفوظة'}
              </p>
            </div>
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
                <div className="px-4 pt-1 pb-4 border-t border-[#5bdda6]/10">
                  <p className="text-[10px] text-white/25 font-bold mb-3 text-center tracking-widest uppercase">
                    اختر وجهتك المحفوظة
                  </p>
                  <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1" dir="rtl">
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

          {/* ── صف الأزرار ── */}
          <div
            className="w-full flex border-t border-[#5bdda6]/10"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 32px), 32px)' }}
          >
            {/* اكتب وجهتك */}
            <button
              onClick={() => { setIsTextMode(true); }}
              className="flex-auto h-[72px] rounded-none flex items-center justify-center gap-2 text-lg font-black touch-manipulation active:scale-[0.98] bg-[#0f1a2e]/80 hover:bg-[#0f1a2e] border-l border-[#5bdda6]/10 transition-colors"
            >
              <Keyboard className="w-5 h-5 text-[#5bdda6]" />
              <span className="text-[#5bdda6]">اكتب وجهتك</span>
            </button>

            {/* استخدم الخريطة */}
            <button
              onClick={() => navigate("/rider/go")}
              className="flex-auto h-[72px] rounded-none flex items-center justify-center gap-2 text-lg font-black touch-manipulation active:scale-[0.98] bg-[#5bdda6] hover:bg-[#4ecf99] active:bg-[#3dbe88] transition-colors"
            >
              <MapIcon className="w-5 h-5 text-[#0b1326]" />
              <span className="text-[#0b1326]">استخدم الخريطة</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
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
