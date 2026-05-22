import React from "react";
import { motion } from "framer-motion";

interface RiderBottomSheetProps {
  children: React.ReactNode;
  /** Whether sheet should expand to full screen (e.g. search focused) */
  isFullScreen?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Reusable animated bottom sheet wrapper for the rider booking flow.
 * Provides rounded-t-3xl, shadow, drag handle, and safe-area padding.
 */
const RiderBottomSheet: React.FC<RiderBottomSheetProps> = ({
  children,
  isFullScreen = false,
  className = "",
}) => {
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }}
      className={`absolute left-0 right-0 bottom-0 z-[60] flex flex-col rounded-t-[2rem] bg-card/95 backdrop-blur-xl border-t border-border/30 shadow-xl text-foreground pointer-events-auto ${
        isFullScreen ? "top-0 rounded-t-none" : ""
      } ${className}`}
      style={{
        maxHeight: isFullScreen ? "100dvh" : "75dvh",
        transition: "max-height 0.35s cubic-bezier(0.4,0,0.2,1), top 0.35s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-1 shrink-0">
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
      </div>

      {/* Content — NO overflow-hidden so CTA button stays clickable */}
      <div className="flex-1 flex flex-col min-h-0">
        {children}
      </div>
    </motion.div>
  );
};

export default RiderBottomSheet;
