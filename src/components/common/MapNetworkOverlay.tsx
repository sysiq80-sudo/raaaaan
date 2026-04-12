/**
 * ران — مؤشر حالة الشبكة فوق الخريطة
 * يظهر عند فقدان الاتصال أو ضعفه
 * يتكامل مع الخريطة لإظهار رسائل مفيدة بدون حجب المحتوى
 */

import { useEffect, useState } from 'react';
import { WifiOff, Wifi, SignalLow } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type NetworkQuality = 'online' | 'slow' | 'offline';

interface MapNetworkOverlayProps {
  /** إخفاء المكون بالكامل */
  hide?: boolean;
}

export const MapNetworkOverlay = ({ hide }: MapNetworkOverlayProps) => {
  const [quality, setQuality] = useState<NetworkQuality>('online');
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setQuality('online');
      setShowRestored(true);
      setTimeout(() => setShowRestored(false), 3000);
    };

    const handleOffline = () => {
      setQuality('offline');
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // فحص جودة الاتصال (Connection API)
    const conn = (navigator as any).connection;
    const checkSlow = () => {
      if (!navigator.onLine) {
        setQuality('offline');
        return;
      }
      if (conn) {
        const effectiveType = conn.effectiveType;
        // 2g أو slow-2g = بطيء
        if (effectiveType === 'slow-2g' || effectiveType === '2g') {
          setQuality('slow');
        } else {
          setQuality('online');
        }
      }
    };

    conn?.addEventListener?.('change', checkSlow);
    checkSlow();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      conn?.removeEventListener?.('change', checkSlow);
    };
  }, []);

  if (hide) return null;

  // لا شيء عند الاتصال الجيد (إلا إشعار الاستعادة)
  if (quality === 'online' && !showRestored) return null;

  return (
    <AnimatePresence>
      {/* شريط "استعادة الاتصال" */}
      {showRestored && quality === 'online' && (
        <motion.div
          key="restored"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/90 backdrop-blur-sm text-white text-xs font-bold shadow-lg shadow-emerald-500/25"
        >
          <Wifi className="w-3.5 h-3.5" />
          <span>تم استعادة الاتصال</span>
        </motion.div>
      )}

      {/* شريط "بدون إنترنت" */}
      {quality === 'offline' && (
        <motion.div
          key="offline"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-red-500/90 backdrop-blur-sm text-white text-xs font-bold shadow-lg shadow-red-500/25"
        >
          <WifiOff className="w-4 h-4 animate-pulse" />
          <div className="flex flex-col">
            <span>بدون إنترنت</span>
            <span className="text-[10px] font-normal text-red-100/80">الخريطة تعرض آخر بيانات محفوظة</span>
          </div>
        </motion.div>
      )}

      {/* شريط "اتصال ضعيف" */}
      {quality === 'slow' && (
        <motion.div
          key="slow"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/90 backdrop-blur-sm text-white text-xs font-bold shadow-lg shadow-amber-500/25"
        >
          <SignalLow className="w-3.5 h-3.5" />
          <span>اتصال ضعيف — الخريطة قد تتأخر</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MapNetworkOverlay;
