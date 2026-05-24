import React from "react";
import { Menu, ArrowRight } from "lucide-react";
import logo from "@/assets/logo.png";

interface RiderMapHeaderProps {
  onMenuOpen: () => void;
  /** إذا تم تمريره، يعرض زر رجوع بدلاً من الفراغ */
  onGoBack?: () => void;
  /** عنوان المرحلة الحالية — يُعرض بجانب الشعار */
  stepLabel?: string;
}

/**
 * Floating transparent header over the map — menu button + RAAN logo + optional back button.
 * Premium glassmorphism style matching the design spec.
 */
const RiderMapHeader: React.FC<RiderMapHeaderProps> = ({ onMenuOpen, onGoBack, stepLabel }) => {
  return (
    <header
      className="absolute top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top)] bg-card/85 backdrop-blur-xl border-b border-border/30 text-foreground"
      dir="rtl"
    >
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left: Back button or spacer */}
        {onGoBack ? (
          <button
            onClick={onGoBack}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-secondary hover:bg-secondary/80 active:scale-95 transition-all text-foreground"
            aria-label="رجوع"
          >
            <ArrowRight className="w-5 h-5 text-foreground" />
          </button>
        ) : (
          <div className="w-10" aria-hidden="true" />
        )}

        {/* Center: Logo + step label */}
        <div className="pointer-events-none flex items-center gap-2">
          <img
            src={logo}
            alt="RAAN"
            className="w-8 h-8 rounded-xl"
          />
          <span className="text-sm font-bold text-foreground tracking-tight">
            {stepLabel || "ران"}
          </span>
        </div>

        {/* Right: Menu */}
        <button
          onClick={onMenuOpen}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-secondary hover:bg-secondary/80 active:scale-95 transition-all text-foreground"
          aria-label="القائمة الرئيسية"
        >
          <Menu className="w-5 h-5 text-foreground" />
        </button>
      </div>
    </header>
  );
};

export default RiderMapHeader;
