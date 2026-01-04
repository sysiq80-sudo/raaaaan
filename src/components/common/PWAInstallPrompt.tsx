/**
 * ران - مكون تثبيت التطبيق كـ PWA
 * يعرض نافذة دعوة لتثبيت التطبيق على الجهاز
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, X, Smartphone, Zap, Wifi, Bell } from 'lucide-react';
import logo from '@/assets/logo.png';

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallPrompt: React.FC = () => {
    const [showPrompt, setShowPrompt] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalling, setIsInstalling] = useState(false);

    useEffect(() => {
        // التحقق إذا كان التطبيق مثبت بالفعل
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as any).standalone === true;

        if (isStandalone) {
            return; // لا تظهر الطلب إذا كان مثبت
        }

        // التحقق إذا تم رفض الطلب سابقاً
        const dismissed = localStorage.getItem('pwa_install_dismissed');
        if (dismissed) {
            const dismissedDate = new Date(dismissed);
            const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceDismissed < 7) {
                return; // لا تظهر لمدة أسبوع بعد الرفض
            }
        }

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);

            // انتظر 3 ثوان قبل إظهار الطلب
            setTimeout(() => {
                setShowPrompt(true);
            }, 3000);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        setIsInstalling(true);

        try {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === 'accepted') {
                console.log('✅ تم تثبيت التطبيق');
                localStorage.setItem('pwa_installed', 'true');
            } else {
                console.log('❌ تم رفض تثبيت التطبيق');
            }
        } catch (error) {
            console.error('خطأ في تثبيت التطبيق:', error);
        } finally {
            setDeferredPrompt(null);
            setShowPrompt(false);
            setIsInstalling(false);
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('pwa_install_dismissed', new Date().toISOString());
    };

    const features = [
        { icon: <Zap className="w-4 h-4" />, text: 'أسرع بـ 3 مرات' },
        { icon: <Wifi className="w-4 h-4" />, text: 'يعمل بدون إنترنت' },
        { icon: <Bell className="w-4 h-4" />, text: 'إشعارات فورية' },
    ];

    return (
        <AnimatePresence>
            {showPrompt && (
                <>
                    {/* الخلفية المعتمة */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
                        onClick={handleDismiss}
                    />

                    {/* نافذة التثبيت */}
                    <motion.div
                        initial={{ opacity: 0, y: 100, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 100, scale: 0.9 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed bottom-4 left-4 right-4 z-[201] md:left-auto md:right-4 md:bottom-4 md:w-96"
                    >
                        <Card className="overflow-hidden border-primary/30 shadow-glow-lg">
                            {/* رأس البطاقة */}
                            <div className="bg-gradient-primary p-4 relative">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 left-2 h-8 w-8 text-white/80 hover:bg-white/20 hover:text-white"
                                    onClick={handleDismiss}
                                >
                                    <X className="w-4 h-4" />
                                </Button>

                                <div className="flex items-center gap-3">
                                    <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-lg flex items-center justify-center p-1">
                                        <img src={logo} alt="ران" className="w-10 h-10" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-white">ثبّت تطبيق ران</h3>
                                        <p className="text-sm text-white/80">للوصول السريع والمميزات الحصرية</p>
                                    </div>
                                </div>
                            </div>

                            <CardContent className="p-4">
                                {/* المميزات */}
                                <div className="flex justify-between mb-4">
                                    {features.map((feature, index) => (
                                        <div
                                            key={index}
                                            className="flex flex-col items-center gap-1 text-center flex-1"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                                {feature.icon}
                                            </div>
                                            <span className="text-xs text-muted-foreground">{feature.text}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* أزرار العمل */}
                                <div className="flex gap-2">
                                    <Button
                                        className="flex-1 bg-gradient-primary shadow-glow btn-glow"
                                        onClick={handleInstall}
                                        disabled={isInstalling}
                                    >
                                        {isInstalling ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin ml-2" />
                                                جاري التثبيت...
                                            </>
                                        ) : (
                                            <>
                                                <Download className="w-4 h-4 ml-2" />
                                                ثبّت الآن
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={handleDismiss}
                                        className="px-4"
                                    >
                                        لاحقاً
                                    </Button>
                                </div>

                                {/* نص صغير */}
                                <p className="text-[10px] text-center text-muted-foreground mt-3">
                                    سيتم إضافة أيقونة على شاشتك الرئيسية
                                </p>
                            </CardContent>
                        </Card>
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
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                || (window.navigator as any).standalone === true;
            setIsInstalled(isStandalone);
        };

        checkInstalled();

        // راقب تغييرات العرض
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        mediaQuery.addEventListener('change', checkInstalled);

        return () => {
            mediaQuery.removeEventListener('change', checkInstalled);
        };
    }, []);

    return isInstalled;
};

export default PWAInstallPrompt;
