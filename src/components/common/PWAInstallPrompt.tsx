/**
 * ران — Smart PWA Install Prompt (Bottom Sheet)
 * يظهر على الموبايل فقط مع تعليمات مخصصة لـ iOS و Android
 * لا يظهر على Desktop أو إذا التطبيق مثبت standalone أو إذا رفضه المستخدم خلال 7 أيام
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import logo from '@/assets/logo.png';

// ================================
// Types
// ================================
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'ios' | 'android' | 'desktop';

// ================================
// Constants
// ================================
const DISMISS_KEY = 'pwa_install_dismissed';
const DISMISS_DAYS = 7;
const SHOW_DELAY_MS = 2500;

// ================================
// Helpers
// ================================
function detectPlatform(): Platform {
  const ua = navigator.userAgent || '';
  // iOS: iPhone, iPad, iPod (or iPad on iOS 13+ with desktop UA)
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  // Android
  if (/Android/i.test(ua)) {
    return 'android';
  }
  return 'desktop';
}

function isStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

function isDismissedRecently(): boolean {
  try {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) return false;
    const daysSince = (Date.now() - new Date(dismissed).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince < DISMISS_DAYS;
  } catch {
    return false;
  }
}

// ================================
// Sub-components
// ================================

/** أيقونة المشاركة في iOS (box-arrow-up) */
const IosShareIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
);

/** أيقونة النقاط الثلاث العمودية (Android menu) */
const AndroidDotsIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>
);

/** خطوة تثبيت مرقمة */
const InstallStep: React.FC<{ step: number; icon?: React.ReactNode; text: string }> = ({ step, icon, text }) => (
  <div className="flex items-start gap-3">
    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center mt-0.5">
      {step}
    </div>
    <div className="flex items-center gap-2 flex-1">
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="text-sm text-white/80 leading-relaxed">{text}</span>
    </div>
  </div>
);

// ================================
// Main Component
// ================================
export const PWAInstallPrompt: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // لا تظهر على Desktop أو standalone أو إذا رُفض مؤخراً
    if (isStandaloneMode() || isDismissedRecently()) return;

    const detectedPlatform = detectPlatform();
    if (detectedPlatform === 'desktop') return;

    setPlatform(detectedPlatform);

    // Android: انتظر حدث beforeinstallprompt (أو أظهر التعليمات اليدوية)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // أظهر البطاقة بعد تأخير بسيط لتجربة أفضل
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    } catch { /* localStorage قد يكون محظور في بعض الحالات */ }
  }, []);

  // تثبيت أصلي (Android Chrome — إذا متاح)
  const handleNativeInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem('pwa_installed', 'true');
      }
    } catch (err) {
      console.error('PWA install error:', err);
    } finally {
      setDeferredPrompt(null);
      setVisible(false);
    }
  }, [deferredPrompt]);

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* خلفية معتمة */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
            onClick={handleDismiss}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className="fixed bottom-0 left-0 right-0 z-[9999] max-h-[90vh] overflow-y-auto"
            dir="rtl"
          >
            <div
              className="rounded-t-3xl overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, #0d2b0d 0%, #081408 100%)',
                borderTop: '1px solid rgba(34, 197, 94, 0.2)',
              }}
            >
              {/* مقبض السحب */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              {/* زر الإغلاق */}
              <button
                onClick={handleDismiss}
                className="absolute top-3 left-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>

              {/* المحتوى */}
              <div className="px-6 pb-8 pt-2 space-y-5">
                {/* رأس + لوغو */}
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center p-2 shadow-lg shadow-primary/10">
                    <img src={logo} alt="ران" className="w-11 h-11" />
                  </div>
                  <h2 className="text-xl font-black text-white leading-snug">
                    🎉 هلا بيك بالانطلاق التجريبي لـ "ران"!
                  </h2>
                </div>

                {/* الوصف */}
                <p className="text-sm text-white/55 leading-relaxed text-center">
                  تطبيقنا حالياً بمرحلة البث التجريبي. تكدر تستخدمه كـ "تطبيق كامل" على موبايلك هسه وبدون ما ياخذ مساحة! ومن ننزل التطبيق رسمياً على المتاجر راح ندزلك إشعار.
                </p>

                {/* خط فاصل */}
                <div className="border-t border-white/10" />

                {/* تعليمات حسب النظام */}
                <div className="space-y-4">
                  <h3 className="text-base font-bold text-primary/90 text-center">
                    {platform === 'ios' ? '📱 كيف تضيفه على الآيفون:' : '📱 كيف تثبته على جهازك:'}
                  </h3>

                  {platform === 'ios' ? (
                    <div className="space-y-3">
                      <InstallStep
                        step={1}
                        icon={<IosShareIcon className="w-5 h-5 text-blue-400" />}
                        text='اضغط على زر المشاركة (Share) بالأسفل.'
                      />
                      <InstallStep
                        step={2}
                        text='اختار "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).'
                      />
                      <InstallStep
                        step={3}
                        text='اضغط إضافة (Add).'
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* إذا beforeinstallprompt متاح → زر تثبيت مباشر */}
                      {deferredPrompt ? (
                        <button
                          onClick={handleNativeInstall}
                          className="w-full py-3.5 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-base flex items-center justify-center gap-2 transition-colors shadow-lg shadow-primary/20"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          ثبّت التطبيق الآن
                        </button>
                      ) : (
                        <>
                          <InstallStep
                            step={1}
                            icon={<AndroidDotsIcon className="w-5 h-5 text-white/60" />}
                            text='اضغط على القائمة (⋮) بالأعلى.'
                          />
                          <InstallStep
                            step={2}
                            text='اختار "تثبيت التطبيق" (Install App).'
                          />
                          <InstallStep
                            step={3}
                            text='وافق على التثبيت.'
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* زر الرفض */}
                <button
                  onClick={handleDismiss}
                  className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white/60 font-semibold text-sm transition-all"
                >
                  مو هسه
                </button>

                {/* نص صغير */}
                <p className="text-[10px] text-white/20 text-center leading-relaxed">
                  التطبيق لا يأخذ مساحة تخزين — يعمل من المتصفح مباشرة
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

/**
 * Hook للتحقق من حالة التثبيت
 */
export const useIsPWAInstalled = (): boolean => {
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const checkInstalled = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsInstalled(standalone);
    };

    checkInstalled();
    const mq = window.matchMedia('(display-mode: standalone)');
    mq.addEventListener('change', checkInstalled);
    return () => mq.removeEventListener('change', checkInstalled);
  }, []);

  return isInstalled;
};

export default PWAInstallPrompt;
