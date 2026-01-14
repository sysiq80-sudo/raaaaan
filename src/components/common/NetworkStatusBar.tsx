/**
 * ران - شريط حالة الشبكة
 * يعرض تنبيه عند انقطاع الإنترنت
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi, AlertTriangle, RefreshCw } from "lucide-react";
import { useOfflineMode } from "@/hooks/useOfflineMode";

interface NetworkStatusBarProps {
  className?: string;
}

export const NetworkStatusBar: React.FC<NetworkStatusBarProps> = ({ className = "" }) => {
  const { isOnline } = useOfflineMode();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={`fixed top-0 left-0 right-0 z-[60] ${className}`}
        >
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 shadow-lg">
            <div className="flex items-center justify-center gap-3">
              {/* Icon */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <WifiOff className="w-5 h-5 text-white" />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute -top-0.5 -right-0.5"
                  >
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </motion.div>
                </div>
              </div>

              {/* Message */}
              <div className="flex-1 text-center">
                <p className="text-white font-bold text-sm">
                  أنت بدون اتصال بالإنترنت
                </p>
                <p className="text-white/80 text-xs">
                  بعض الميزات قد لا تعمل بشكل صحيح
                </p>
              </div>

              {/* Loading indicator */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <RefreshCw className="w-4 h-4 text-white/70" />
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NetworkStatusBar;
