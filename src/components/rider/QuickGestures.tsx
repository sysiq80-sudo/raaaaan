import React, { useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface QuickGesturesProps {
  onSwipeUp?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  enabled?: boolean;
}

export const QuickGestures: React.FC<QuickGesturesProps> = ({
  onSwipeUp,
  onDoubleTap,
  onLongPress,
  enabled = true
}) => {
  const controls = useAnimation();

  useEffect(() => {
    if (!enabled) return;

    let startY = 0;
    let tapCount = 0;
    let longPressTimer: any;

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      tapCount++;

      // Double tap detection
      setTimeout(() => {
        if (tapCount === 2 && onDoubleTap) {
          onDoubleTap();
        }
        tapCount = 0;
      }, 300);

      // Long press detection
      longPressTimer = setTimeout(() => {
        if (onLongPress) {
          onLongPress();
          controls.start({
            scale: [1, 1.1, 1],
            transition: { duration: 0.3 }
          });
        }
      }, 500);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      clearTimeout(longPressTimer);

      const endY = e.changedTouches[0].clientY;
      const deltaY = startY - endY;

      // Swipe up detection (minimum 50px swipe)
      if (deltaY > 50 && onSwipeUp) {
        onSwipeUp();
        controls.start({
          y: [0, -10, 0],
          transition: { duration: 0.4 }
        });
      }
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      clearTimeout(longPressTimer);
    };
  }, [enabled, onSwipeUp, onDoubleTap, onLongPress, controls]);

  return (
    <motion.div
      animate={controls}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ touchAction: 'none' }}
    >
      {/* Visual feedback for gestures */}
      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 pointer-events-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: enabled ? 0.1 : 0 }}
          className="text-center text-white/50 text-sm"
        >
          اسحب لأعلى للحجز السريع
        </motion.div>
      </div>
    </motion.div>
  );
};

export default QuickGestures;