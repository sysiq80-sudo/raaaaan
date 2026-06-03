import React from "react";
import { motion, useDragControls } from "framer-motion";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";

interface RiderBottomSheetProps {
  children: React.ReactNode;
  /** Whether sheet should expand to full screen (e.g. search focused) */
  isFullScreen?: boolean;
  /** Additional className */
  className?: string;
  onClose?: () => void;
  onExpand?: () => void;
}

/**
 * Reusable animated bottom sheet wrapper for the rider booking flow.
 * Provides rounded-t-3xl, shadow, drag handle, and safe-area padding.
 */
const RiderBottomSheet = React.forwardRef<HTMLDivElement, RiderBottomSheetProps>(({
  children,
  isFullScreen = false,
  className = "",
  onClose,
  onExpand,
}, ref) => {
  const dragControls = useDragControls();
  const keyboardHeight = useKeyboardHeight();

  return (
    <motion.div
      ref={ref}
      initial={{ y: 48, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "tween", duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
      drag="y"
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.1, bottom: 0.8 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 100) {
          // Dragged down -> close/collapse
          if (onClose) onClose();
        } else if (info.offset.y < -100) {
          // Dragged up -> expand
          if (onExpand) onExpand();
        }
      }}
      className={`absolute left-0 right-0 bottom-0 z-[60] flex flex-col pointer-events-auto ${
        isFullScreen ? "top-0" : ""
      } ${className}`}
      style={{
        maxHeight: isFullScreen ? "100dvh" : "75dvh",
        transition: "max-height 0.2s cubic-bezier(0.25,0.1,0.25,1), top 0.2s cubic-bezier(0.25,0.1,0.25,1)",
        willChange: "transform, opacity",
        paddingBottom: keyboardHeight ? `${keyboardHeight}px` : 0,
      }}
    >
      {/* Inner card — single container with rounded corners + overflow clip */}
      <div className={`flex-1 flex flex-col min-h-0 ${isFullScreen ? '' : 'rounded-t-[2rem]'} bg-card border-t border-border/30 shadow-lg text-foreground overflow-hidden`}>
        {/* Drag handle */}
        <div
          className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
          style={{ touchAction: "none" }}
        >
          <div className="w-10 h-1 rounded-full bg-white" />
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {children}
        </div>
      </div>
    </motion.div>
  );
});

RiderBottomSheet.displayName = "RiderBottomSheet";

export default RiderBottomSheet;
