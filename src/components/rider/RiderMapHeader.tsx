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

  return (
    <header
      className="absolute top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top)] bg-transparent border-none shadow-none text-foreground"
      dir="rtl"
    >
      <div className="relative flex items-center justify-between h-14 px-4">
        {/* Left side actions (in RTL: right side of the screen) */}
        <div className="flex items-center gap-2">
          {showHome && (
            <button
              onClick={() => navigate("/rider")}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-secondary hover:bg-secondary/80 active:scale-95 transition-all text-foreground shadow-md"
              aria-label="الرئيسية"
            >
              <Home className="w-5 h-5 text-foreground" />
            </button>
          )}

          {onGoBack && (
            <button
              onClick={onGoBack}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-secondary hover:bg-secondary/80 active:scale-95 transition-all text-foreground shadow-md"
              aria-label="رجوع"
            >
              <ArrowRight className="w-5 h-5 text-foreground" />
            </button>
          )}
        </div>

        {/* Center: Absolute centered Logo + text */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-2">
          <img
            src={logo}
            alt="RAAN"
            className="w-8 h-8 rounded-xl shadow-sm"
          />
          <span className="text-sm font-bold text-foreground tracking-tight">
            {stepLabel || "ران"}
          </span>
        </div>

        {/* Right side actions (in RTL: left side of the screen) */}
        <button
          onClick={onMenuOpen}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-secondary hover:bg-secondary/80 active:scale-95 transition-all text-foreground shadow-md"
          aria-label="القائمة الرئيسية"
        >
          <Menu className="w-5 h-5 text-foreground" />
        </button>
      </div>
    </header>
  );
};

export default RiderMapHeader;
