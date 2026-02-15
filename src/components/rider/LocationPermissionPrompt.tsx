/**
 * مكون طلب صلاحية الموقع عند أول دخول
 * يظهر مرة واحدة فقط ويطلب من المستخدم منح صلاحية دائمة
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LocationPermissionPromptProps {
  onPermissionGranted: (location: { lat: number; lng: number }) => void;
  onSkip?: () => void;
}

export const LocationPermissionPrompt = ({
  onPermissionGranted,
  onSkip
}: LocationPermissionPromptProps) => {
  const [show, setShow] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    // التحقق من عدم طلب الصلاحية سابقاً أو منحها
    const hasGrantedBefore = localStorage.getItem('location_permission_granted') === 'true';
    const hasRequestedBefore = localStorage.getItem('location_permission_requested');
    
    // إذا تم منح الصلاحية سابقاً، تخطي المودال وإرسال الموقع مباشرة
    if (hasGrantedBefore) {
      navigator.geolocation?.getCurrentPosition(
        (position) => {
          onPermissionGranted({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          // الصلاحية كانت ممنوحة لكن تم سحبها - إعادة العرض
          localStorage.removeItem('location_permission_granted');
          setTimeout(() => setShow(true), 500);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
      return;
    }
    
    if (!hasRequestedBefore && navigator.geolocation) {
      // تأخير العرض قليلاً لتحسين UX
      setTimeout(() => setShow(true), 500);
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const requestLocationPermission = async () => {
    setIsRequesting(true);
    
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          // حفظ أنه تم طلب الصلاحية
          localStorage.setItem('location_permission_requested', 'true');
          localStorage.setItem('location_permission_granted', 'true');
          
          setShow(false);
          onPermissionGranted(location);
        },
        (error) => {
          console.error('Location permission denied:', error);
          
          // حفظ أنه تم طلب الصلاحية (حتى لو رفض)
          localStorage.setItem('location_permission_requested', 'true');
          localStorage.setItem('location_permission_granted', 'false');
          
          setIsRequesting(false);
          setShow(false);
          
          if (onSkip) onSkip();
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } catch (error) {
      console.error('Error requesting location:', error);
      setIsRequesting(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('location_permission_requested', 'true');
    localStorage.setItem('location_permission_granted', 'false');
    setShow(false);
    if (onSkip) onSkip();
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-background rounded-2xl shadow-2xl max-w-md w-full p-6 relative border border-primary/20"
        >
          {/* زر الإغلاق */}
          <button
            onClick={handleSkip}
            className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="تخطي"
          >
            <X className="w-5 h-5" />
          </button>

          {/* الأيقونة */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Navigation className="w-8 h-8 text-primary animate-pulse" />
            </div>
          </div>

          {/* العنوان */}
          <h2 className="text-2xl font-bold text-center mb-2">
            السماح بالوصول للموقع
          </h2>

          {/* الوصف */}
          <p className="text-muted-foreground text-center mb-6 leading-relaxed">
            يحتاج تطبيق <span className="text-primary font-semibold">ران</span> للوصول إلى موقعك الحالي لـ:
          </p>

          {/* المميزات */}
          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">تحديد موقعك تلقائياً</p>
                <p className="text-xs text-muted-foreground">لتوفير الوقت وتسهيل طلب الرحلات</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Navigation className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">إيجاد أقرب سائق</p>
                <p className="text-xs text-muted-foreground">لتقليل وقت الانتظار والوصول السريع</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">تتبع الرحلة</p>
                <p className="text-xs text-muted-foreground">لمعرفة موقع السائق وتقدير وقت الوصول</p>
              </div>
            </div>
          </div>

          {/* ملاحظة الخصوصية */}
          <div className="bg-muted/50 rounded-lg p-3 mb-6">
            <p className="text-xs text-muted-foreground text-center">
              🔒 نحترم خصوصيتك - لن يتم مشاركة موقعك مع أي طرف ثالث
            </p>
          </div>

          {/* الأزرار */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={requestLocationPermission}
              disabled={isRequesting}
              className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              {isRequesting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  جاري الطلب...
                </>
              ) : (
                <>
                  <Navigation className="w-5 h-5 mr-2" />
                  السماح بالوصول للموقع
                </>
              )}
            </Button>

            <Button
              onClick={handleSkip}
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground"
            >
              تخطي الآن (سيطلب لاحقاً)
            </Button>
          </div>

          {/* تعليمات إضافية */}
          <p className="text-xs text-muted-foreground text-center mt-4">
            يمكنك تغيير هذا الإعداد لاحقاً من إعدادات المتصفح
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
