import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { MapPin, Bookmark, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import logo from '@/assets/logo.png';

interface SaveLocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: string;
  onSave: (name: string, icon: string) => Promise<void>;
}

const LOCATION_ICONS = [
  { value: 'home', emoji: '🏠', label: 'البيت' },
  { value: 'work', emoji: '💼', label: 'العمل' },
  { value: 'cafe', emoji: '☕', label: 'مقهى' },
  { value: 'gym', emoji: '💪', label: 'جيم' },
  { value: 'diwaniya', emoji: '🏛️', label: 'ديوانية' },
  { value: 'carwash', emoji: '🚗', label: 'مغسلة' },
  { value: 'school', emoji: '🎓', label: 'مدرسة' },
  { value: 'hospital', emoji: '🏥', label: 'مستشفى' },
  { value: 'other', emoji: '📍', label: 'آخر' },
];

// خطوات النافذة
const STEPS = [
  { id: 1, label: 'الموقع' },
  { id: 2, label: 'التسمية' },
  { id: 3, label: 'الأيقونة' },
];

export default function SaveLocationModal({
  open,
  onOpenChange,
  address,
  onSave,
}: SaveLocationModalProps) {
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('home');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const selectedEmoji = LOCATION_ICONS.find(i => i.value === selectedIcon)?.emoji || '📍';

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await onSave(name.trim() || LOCATION_ICONS.find(i => i.value === selectedIcon)?.label || 'موقع محفوظ', selectedIcon);
      setName('');
      setSelectedIcon('home');
      setCurrentStep(1);
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    setName('');
    setSelectedIcon('home');
    onOpenChange(false);
  };

  const handleNext = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
    else handleSave();
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const canProceed = currentStep === 1 || currentStep === 2 || currentStep === 3;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-[360px] w-[95vw] p-0 border-0 rounded-3xl overflow-hidden bg-transparent shadow-[0_25px_80px_rgba(0,0,0,0.6)]"
        dir="rtl"
      >
        <div className="bg-[#0a1020] rounded-3xl overflow-hidden border border-[#5bdda6]/15">

          {/* ── الهيدر مع الشعار ── */}
          <div className="relative pt-6 pb-4 px-6 text-center">
            {/* خلفية ديكورية */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#5bdda6]/8 to-transparent pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[100px] bg-[#5bdda6]/5 blur-[60px] pointer-events-none rounded-full" />

            {/* الشعار */}
            <div className="relative mx-auto mb-3 w-14 h-14">
              <div className="absolute inset-[-3px] rounded-full border border-[#5bdda6]/20 animate-pulse" />
              <img
                src={logo}
                alt="RAAN"
                className="w-14 h-14 rounded-full object-cover border-2 border-[#5bdda6]/30 shadow-lg"
              />
            </div>

            <h2 className="relative text-xl font-black text-white tracking-tight mb-1">
              حفظ المكان المفضل
            </h2>
            <p className="relative text-xs text-white/35">
              احفظ هذا الموقع للوصول السريع
            </p>
          </div>

          {/* ── مؤشر الخطوات ── */}
          <div className="px-6 pb-4">
            <div className="flex items-center justify-between gap-1">
              {STEPS.map((step, index) => (
                <React.Fragment key={step.id}>
                  {/* الخطوة */}
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                        currentStep > step.id
                          ? 'bg-[#5bdda6] text-[#0a1020] shadow-[0_0_12px_rgba(91,221,166,0.4)]'
                          : currentStep === step.id
                          ? 'bg-[#5bdda6]/20 text-[#5bdda6] border-2 border-[#5bdda6] shadow-[0_0_16px_rgba(91,221,166,0.25)]'
                          : 'bg-[#151f30] text-white/30 border border-white/10'
                      }`}
                    >
                      {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
                    </div>
                    <span className={`text-[10px] font-medium transition-colors ${
                      currentStep >= step.id ? 'text-[#5bdda6]/80' : 'text-white/25'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {/* الخط الفاصل */}
                  {index < STEPS.length - 1 && (
                    <div className={`flex-1 h-[2px] rounded-full mt-[-18px] transition-colors duration-300 ${
                      currentStep > step.id ? 'bg-[#5bdda6]/60' : 'bg-white/8'
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* ── محتوى الخطوات ── */}
          <div className="px-6 pb-3 min-h-[180px]">
            <AnimatePresence mode="sync">
              {/* الخطوة 1: الموقع */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  <div className="bg-[#111b2e] rounded-2xl p-4 border border-[#5bdda6]/10">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#5bdda6]/10 border border-[#5bdda6]/20 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-[#5bdda6]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold tracking-wider text-[#5bdda6]/50 uppercase mb-1">
                          الموقع المحدد
                        </p>
                        <p className="text-sm font-semibold text-white leading-relaxed">
                          {address || 'غير محدد'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0d1729]/60 rounded-xl p-3 border border-white/5">
                    <p className="text-xs text-white/40 text-center leading-relaxed">
                      سيتم حفظ هذا الموقع في أماكنك المفضلة للوصول إليه بسرعة عند الحجز 🚕
                    </p>
                  </div>
                </motion.div>
              )}

              {/* الخطوة 2: التسمية */}
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  <div className="bg-[#111b2e] rounded-2xl p-4 border border-[#5bdda6]/10">
                    <label className="text-xs font-bold text-[#5bdda6]/60 uppercase tracking-wider mb-3 block">
                      اسم المكان
                    </label>
                    <div className="relative">
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Bookmark className="w-4 h-4 text-[#5bdda6]/40" />
                      </div>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="مثال: بيتي، عملي، المقهى..."
                        className="w-full bg-[#0a1020] border border-white/10 rounded-xl py-3 px-4 pr-10 text-sm text-white placeholder:text-white/20 outline-none focus:border-[#5bdda6]/40 focus:bg-[#0a1020]/80 transition-all text-right"
                        autoFocus
                        dir="rtl"
                      />
                    </div>
                    <p className="text-[10px] text-white/25 mt-2 pr-1">
                      إذا تركته فارغاً سيُستخدم اسم الأيقونة المختارة
                    </p>
                  </div>
                </motion.div>
              )}

              {/* الخطوة 3: الأيقونة */}
              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  <div className="bg-[#111b2e] rounded-2xl p-4 border border-[#5bdda6]/10">
                    <label className="text-xs font-bold text-[#5bdda6]/60 uppercase tracking-wider mb-3 block">
                      اختر الأيقونة
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {LOCATION_ICONS.map((item) => (
                        <motion.button
                          key={item.value}
                          whileTap={{ scale: 0.92 }}
                          onClick={() => setSelectedIcon(item.value)}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 ${
                            selectedIcon === item.value
                              ? 'border-[#5bdda6] bg-[#5bdda6]/10 shadow-[0_0_15px_rgba(91,221,166,0.15)]'
                              : 'border-white/8 bg-[#0a1020]/60 hover:border-white/15 hover:bg-white/5'
                          }`}
                        >
                          <span className="text-2xl leading-none">{item.emoji}</span>
                          <span className={`text-[10px] font-medium ${
                            selectedIcon === item.value ? 'text-[#5bdda6]' : 'text-white/40'
                          }`}>
                            {item.label}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* المعاينة */}
                  <div className="bg-[#0d1729]/80 rounded-xl p-3 border border-[#5bdda6]/10">
                    <p className="text-[10px] text-[#5bdda6]/50 uppercase font-bold tracking-wider mb-2">معاينة</p>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-[#5bdda6]/10 border border-[#5bdda6]/20 flex items-center justify-center text-xl shrink-0">
                        {selectedEmoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate">
                          {name || LOCATION_ICONS.find(i => i.value === selectedIcon)?.label || 'موقع محفوظ'}
                        </p>
                        <p className="text-[10px] text-white/35 truncate">{address}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── أزرار التنقل ── */}
          <div className="px-6 pb-6 pt-2">
            <div className="flex gap-2.5">
              {/* زر السابق / إلغاء */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={currentStep === 1 ? handleClose : handlePrev}
                disabled={isLoading}
                className="flex-1 py-3.5 rounded-2xl bg-[#151f30] border border-white/8 text-white/50 text-sm font-bold hover:bg-[#1a2740] hover:text-white/70 active:bg-[#0d1729] transition-all disabled:opacity-40"
              >
                {currentStep === 1 ? 'إلغاء' : 'السابق'}
              </motion.button>

              {/* زر التالي / حفظ */}
              <motion.button
                whileTap={canProceed && !isLoading ? { scale: 0.95 } : {}}
                onClick={handleNext}
                disabled={!canProceed || isLoading}
                className={`flex-[1.5] py-3.5 rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all duration-300 ${
                  canProceed && !isLoading
                    ? 'bg-gradient-to-r from-[#5bdda6] to-[#27b481] text-[#003825] shadow-[0_8px_24px_rgba(91,221,166,0.25)] hover:shadow-[0_10px_30px_rgba(91,221,166,0.35)]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : currentStep === 3 ? (
                  <>
                    <Bookmark className="w-4 h-4" />
                    <span>حفظ المكان</span>
                  </>
                ) : (
                  <span>التالي</span>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
