/**
 * ران - الشاشة الرئيسية بالذكاء الاصطناعي الصوتي
 * Voice-First AI Home Screen — تصميم فاخر مطابق للصورة المرجعية
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, MapPin, Shield, Sparkles, Volume2,
  Check, X, Map as MapIcon, Navigation, Send, Keyboard,
  ChevronLeft, Search, Clock, Home, Briefcase, Coffee,
  Dumbbell, Landmark, Car, Zap, Leaf, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoiceRecording, type VoiceResult, type VoiceState } from "@/hooks/useVoiceRecording";
import useRiderStore from "@/stores/riderStore";
import { useToast } from "@/hooks/use-toast";
import { reverseGeocodeCoordinates } from "@/lib/googleMapService";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";

/* ──────────────────────────────────────────
   ثوابت
────────────────────────────────────────── */
const VOICE_HINTS = [
  "لجامعة الأنبار",
  "لشارع المستودع",
  "لمستشفى الرمادي التعليمي",
  "لتقاطع الزيوت",
  "لحي التأميم",
  "لسوق الرمادي المركزي",
];

const QUICK_PLACES = ["جامعة الأنبار", "شارع المستودع", "مستشفى الرمادي", "حي التأميم"];

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
}
const ConfirmModal: React.FC<ConfirmModalProps> = ({ result, onConfirm, onRetry, onCancel }) => (
  <motion.div
    className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-md"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={onCancel}
  >
    <motion.div
      className="w-full max-w-lg rounded-t-3xl bg-gradient-to-b from-slate-900 to-[#0a1f0d] border-t border-x border-white/10 p-6 pb-10 shadow-2xl"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 32 }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* مقبض */}
      <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />

      {/* عنوان */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Check className="w-4 h-4 text-emerald-400" />
        </div>
        <h3 className="text-base font-bold text-white">هل تقصد هذا المسار؟</h3>
      </div>

      {/* ما قاله المستخدم */}
      {result.transcript && (
        <div className="mb-4 px-4 py-3 rounded-2xl bg-white/5 border border-white/8">
          <p className="text-xs text-white/35 mb-1">ما قلته:</p>
          <p className="text-sm text-white/80" dir="rtl">"{result.transcript}"</p>
        </div>
      )}

      {/* المسار */}
      <div className="space-y-2 mb-6">
        {result.origin && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/8">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-white/30">من</p>
              <p className="text-sm font-semibold text-white">{result.origin.name}</p>
            </div>
          </div>
        )}
        <div className="flex justify-center">
          <div className="w-px h-4 bg-white/10" />
        </div>
        {result.destination && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-emerald-400/50">إلى</p>
              <p className="text-sm font-semibold text-white">{result.destination.name}</p>
            </div>
          </div>
        )}
      </div>

      {/* أزرار */}
      <div className="flex gap-3" dir="rtl">
        <Button
          onClick={onConfirm}
          className="flex-1 h-13 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/25 text-base"
        >
          <Check className="w-5 h-5 ml-2" /> تأكيد
        </Button>
        <Button
          onClick={onRetry}
          variant="outline"
          className="h-13 px-5 border-white/15 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 rounded-2xl"
        >
          <Mic className="w-4 h-4" />
        </Button>
        <Button
          onClick={onCancel}
          variant="ghost"
          className="h-13 px-4 text-white/30 hover:text-white/60 hover:bg-white/5 rounded-2xl"
        >
          <X className="w-4 h-4" />
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

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [isTextMode, setIsTextMode] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [isSubmittingText, setIsSubmittingText] = useState(false);
  const textInputRef = useRef<HTMLInputElement>(null);
  const [textResult, setTextResult] = useState<VoiceResult | null>(null);
  const [activeSavedPlaceIndex, setActiveSavedPlaceIndex] = useState(0);
  const [isSavedPlacesSliderPaused, setIsSavedPlacesSliderPaused] = useState(false);
  const savedPlaceCardRefs = useRef<Array<HTMLDivElement | null>>([]);

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
      const { data, error: fnError } = await supabase.functions.invoke("voice-booking-ai", {
        body: JSON.stringify({ text: trimmed }),
        headers: { "Content-Type": "application/json" },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      setTextResult({ transcript: data.transcript || trimmed, origin: data.origin || null, destination: data.destination || null, vehicleType: data.vehicleType || "economy" });
      setShowConfirmation(true);
    } catch (err: any) {
      toast({ title: "خطأ في المعالجة", description: err.message || "حاول مرة أخرى", variant: "destructive" });
    } finally { setIsSubmittingText(false); }
  }, [textInput, isSubmittingText, toast]);

  const handlePressStart = useCallback(() => { setIsPressing(true); startRecording(); }, [startRecording]);
  const handlePressEnd = useCallback(async () => {
    setIsPressing(false);
    if (voiceState === "recording") await stopRecording();
  }, [voiceState, stopRecording]);

  const handleConfirm = useCallback(() => {
    if (!activeResult) return;
    const origin = activeResult.origin || (pickupCoords && pickupAddress ? { lat: pickupCoords.lat, lng: pickupCoords.lng, name: pickupAddress } : null);
    if (origin) setPickupLocation({ lat: origin.lat, lng: origin.lng, address: origin.name });
    if (activeResult.destination) setDropoffLocation({ lat: activeResult.destination.lat, lng: activeResult.destination.lng, address: activeResult.destination.name });
    if (activeResult.vehicleType) setVehicle(activeResult.vehicleType);
    setShowConfirmation(false);
    navigate("/rider/go", { state: { fromVoice: true, origin, destination: activeResult.destination } });
  }, [activeResult, pickupCoords, pickupAddress, navigate, setPickupLocation, setDropoffLocation, setVehicle]);

  const handleRetry = useCallback(() => { setShowConfirmation(false); setTextResult(null); resetVoice(); }, [resetVoice]);
  const handleCancel = useCallback(() => { setShowConfirmation(false); setTextResult(null); resetVoice(); }, [resetVoice]);

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

  const handleSavedPlaceFrom = useCallback((fav: (typeof normalizedFavorites)[number]) => {
    // تعيين المكان المحفوظ كنقطة انطلاق → فتح الخريطة لاختيار الوجهة
    setPickupLocation({ lat: fav.lat, lng: fav.lng, address: fav.address || fav.name });
    navigate("/rider/go", {
      state: {
        fromVoice: true,
        fromSavedPlace: true,
        preferredMode: "dropoff",
        savedPickup: { lat: fav.lat, lng: fav.lng, address: fav.address || fav.name },
      },
    });
  }, [navigate, setPickupLocation]);

  const handleSavedPlaceTo = useCallback(async (fav: (typeof normalizedFavorites)[number]) => {
    // تعيين المكان المحفوظ كوجهة → فتح الخريطة لاختيار نقطة الانطلاق
    setDropoffLocation({ lat: fav.lat, lng: fav.lng, address: fav.address || fav.name });

    navigate("/rider/go", {
      state: {
        fromVoice: true,
        fromSavedPlace: true,
        preferredMode: "pickup",
        savedDropoff: { lat: fav.lat, lng: fav.lng, address: fav.address || fav.name },
      },
    });
  }, [navigate, setDropoffLocation]);

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
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-5">
        <AnimatePresence mode="wait">
          {isProcessing ? (
            <AIProcessingView key="processing" />
          ) : isTextMode || !isMicAvailable ? (
            /* ── وضع الكتابة ── */
            <motion.div
              key="text-mode"
              className="w-full flex flex-col items-center gap-5"
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
                <div className="flex items-center bg-[#0f1a2e]/80 border-2 border-[#5bdda6]/15 rounded-2xl overflow-hidden focus-within:border-[#5bdda6]/50 transition-all duration-300 focus-within:bg-[#0f1a2e]">
                  <input
                    ref={textInputRef}
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleTextSubmit(); }}
                    placeholder="مثال: جامعة الأنبار..."
                    className="flex-1 bg-transparent text-white text-base px-5 py-4 placeholder:text-white/20 outline-none text-right"
                    dir="rtl"
                    autoFocus
                    disabled={isSubmittingText}
                  />
                  <motion.button
                    onClick={handleTextSubmit}
                    disabled={!textInput.trim() || textInput.trim().length < 2 || isSubmittingText}
                    className="ml-2 mr-2.5 w-10 h-10 rounded-xl bg-[#5bdda6] hover:bg-[#4ecf99] active:bg-[#3dbe88] disabled:bg-white/10 disabled:opacity-30 flex items-center justify-center transition-all"
                    whileTap={{ scale: 0.92 }}
                  >
                    <Send className="w-4.5 h-4.5 text-[#0b1326]" />
                  </motion.button>
                </div>
              </div>

              {/* اقتراحات سريعة */}
              <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                {QUICK_PLACES.map((place) => (
                  <motion.button
                    key={place}
                    onClick={() => { setTextInput(place); textInputRef.current?.focus(); }}
                    className="px-3.5 py-1.5 rounded-full bg-[#0f1a2e]/80 border border-[#5bdda6]/15 text-white/45 text-sm hover:bg-[#5bdda6]/15 hover:border-[#5bdda6]/30 hover:text-white/75 transition-all"
                    whileTap={{ scale: 0.95 }}
                  >
                    {place}
                  </motion.button>
                ))}
              </div>

              {/* التبديل للصوت */}
              {isMicAvailable && (
                <motion.button
                  onClick={() => { setIsTextMode(false); setTextInput(""); }}
                  className="flex items-center gap-1.5 text-sm text-[#5bdda6]/45 hover:text-[#5bdda6]/80 transition-colors"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>استخدم الصوت</span>
                </motion.button>
              )}
            </motion.div>
          ) : (
            /* ── وضع الصوت ── */
            <motion.div
              key="voice-mode"
              className="flex flex-col items-center gap-7"
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
      </div>

      {/* ══════════════════════════════════════
         سلايدر المواقع المحفوظة فوق القائمة السفلية
         ══════════════════════════════════════ */}
      {normalizedFavorites.length > 0 && (
        <motion.div
          className="relative z-10 w-full max-w-none mx-auto px-4 pb-3"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34 }}
          onPointerEnter={() => setIsSavedPlacesSliderPaused(true)}
          onPointerLeave={() => setIsSavedPlacesSliderPaused(false)}
          onPointerDown={() => setIsSavedPlacesSliderPaused(true)}
          onPointerUp={() => setIsSavedPlacesSliderPaused(false)}
        >
          <div className="mb-2 px-1 text-[11px] text-[#5bdda6]/75 text-center">
            اسحب يمين ويسار واختر المكان المناسب
          </div>

          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 px-0.5 scrollbar-hide">
            {normalizedFavorites.map((fav, index) => (
              <motion.div
                key={fav.id}
                ref={(el) => {
                  savedPlaceCardRefs.current[index] = el;
                }}
                className="min-w-[280px] w-[280px] flex-shrink-0 snap-center rounded-3xl border border-[#5bdda6]/20 bg-[#0f1a2e]/75 backdrop-blur-xl px-4 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.38 + index * 0.06 }}
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl border border-[#5bdda6]/35 bg-[#5bdda6]/15 text-[#5bdda6] flex items-center justify-center">
                    {FAV_ICON_MAP[fav.icon || "other"]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-extrabold text-base leading-tight truncate">
                      {fav.name || FAV_NAMES[fav.icon || "other"]}
                    </p>
                    <p className="text-white/50 text-xs truncate mt-1">
                      {fav.address}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSavedPlaceFrom(fav)}
                    className="h-10 rounded-xl border border-[#5bdda6]/35 bg-[#5bdda6]/12 text-[#5bdda6] text-sm font-bold hover:bg-[#5bdda6]/20 active:scale-[0.98] transition-all"
                  >
                    انطلق من
                  </button>
                  <button
                    onClick={() => {
                      void handleSavedPlaceTo(fav);
                    }}
                    className="h-10 rounded-xl bg-[#5bdda6] text-[#071321] text-sm font-black hover:bg-[#4ed19b] active:scale-[0.98] transition-all"
                  >
                    الوصول إلى
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {normalizedFavorites.length > 1 && (
            <div className="mt-1 flex items-center justify-center gap-1.5">
              {normalizedFavorites.map((fav, index) => (
                <button
                  key={`dot-${fav.id}`}
                  type="button"
                  aria-label={`الانتقال إلى البطاقة ${index + 1}`}
                  onClick={() => setActiveSavedPlaceIndex(index)}
                  className={`h-1.5 rounded-full transition-all ${index === activeSavedPlaceIndex ? "w-5 bg-[#5bdda6]" : "w-1.5 bg-white/25"}`}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ══════════════════════════════════════
         البانل السفلي — أزرار التنقل
         ══════════════════════════════════════ */}
      <motion.div
        className="relative z-10 flex border-t border-[#5bdda6]/10"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        {/* اكتب وجهتك */}
        <button
          onClick={() => { setIsTextMode(true); }}
          className="flex-1 flex items-center justify-center gap-2 py-4 bg-[#0f1a2e]/80 hover:bg-[#0f1a2e] active:bg-[#0b1326] border-l border-[#5bdda6]/10 transition-colors duration-200"
        >
          <Keyboard className="w-4 h-4 text-[#5bdda6]" />
          <span className="text-[#5bdda6] font-semibold text-sm">اكتب وجهتك</span>
        </button>

        {/* استخدم الخريطة */}
        <button
          onClick={() => navigate("/rider/go")}
          className="flex-1 flex items-center justify-center gap-2 py-4 bg-[#5bdda6] hover:bg-[#4ecf99] active:bg-[#3dbe88] transition-colors duration-200"
        >
          <MapIcon className="w-4 h-4 text-[#0b1326]" />
          <span className="text-[#0b1326] font-bold text-sm">استخدم الخريطة</span>
        </button>
      </motion.div>

      {/* ── مودال التأكيد ── */}
      <AnimatePresence>
        {showConfirmation && activeResult && (
          <ConfirmModal
            result={activeResult}
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
