import React from "react";
import { useNavigate } from "react-router-dom";
import { Menu, ArrowRight, Home } from "lucide-react";
import logo from "@/assets/logo.png";

interface RiderMapHeaderProps {
  onMenuOpen: () => void;
  /** إذا تم تمريره، يعرض زر رجوع بدلاً من الفراغ */
  onGoBack?: () => void;
  /** عنوان المرحلة الحالية — يُعرض بجانب الشعار */
  stepLabel?: string;
  showHome?: boolean;
}

/**
 * Floating transparent header over the map — menu button + RAAN logo + optional back button + home button.
 * Premium transparent style matching the design spec.
 */
const RiderMapHeader: React.FC<RiderMapHeaderProps> = ({
  onMenuOpen,
  onGoBack,
  stepLabel,
  showHome = true,
}) => {
  const navigate = useNavigate();

  // Shared classes to ensure all header buttons and icons have equal and consistent sizes and styles
  const buttonClassName = "w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition-all text-white shadow-[0_0_12px_rgba(16,185,129,0.5)] hover:shadow-[0_0_18px_rgba(16,185,129,0.75)] border border-emerald-400/30";
  const iconClassName = "w-5 h-5 text-white";

  return (
    <header
      className="absolute top-0 left-0 right-0 z-50 bg-transparent border-none shadow-none text-foreground"
      style={{ paddingTop: 'max(8px, env(safe-area-inset-top, 8px))' }}
      dir="rtl"
    >
      <div className="relative flex items-center justify-between h-12 px-4">
        {/* Left side actions (in RTL: right side of the screen) */}
        <div className="flex items-center gap-2">
          {showHome && (
            <button
              onClick={() => navigate("/rider")}
              className={buttonClassName}
              aria-label="الرئيسية"
            >
              <Home className={iconClassName} />
            </button>
          )}

          {onGoBack && (
            <button
              onClick={onGoBack}
              className={buttonClassName}
              aria-label="رجوع"
            >
              <ArrowRight className={iconClassName} />
            </button>
          )}
        </div>

        {/* Center: Absolute centered Logo + text */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-2">
          <img
            src={logo}
            alt="RAAN"
            className="w-10 h-10 rounded-xl shadow-sm"
          />
          <span
            className="text-sm font-black text-white tracking-tight"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.5)' }}
          >
            {stepLabel || "ران"}
          </span>
        </div>

        {/* Right side actions (in RTL: left side of the screen) */}
        <button
          onClick={onMenuOpen}
          className={buttonClassName}
          aria-label="القائمة الرئيسية"
        >
          <Menu className={iconClassName} />
        </button>
      </div>
    </header>
  );
};

export default RiderMapHeader;
