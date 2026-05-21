import React from "react";
import { Menu } from "lucide-react";
import logo from "@/assets/logo.png";

interface RiderMapHeaderProps {
  onMenuOpen: () => void;
}

/**
 * Floating transparent header over the map — menu button + RAAN logo.
 * Premium glassmorphism style matching the design spec.
 */
const RiderMapHeader: React.FC<RiderMapHeaderProps> = ({ onMenuOpen }) => {
  return (
    <header
      className="absolute top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top)]"
      style={{
        background: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
      }}
      dir="rtl"
    >
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left spacer for balance */}
        <div className="w-10" aria-hidden="true" />

        {/* Center: Logo */}
        <div className="pointer-events-none flex items-center gap-2">
          <img
            src={logo}
            alt="RAAN"
            className="w-8 h-8 rounded-xl"
          />
          <span className="text-sm font-bold text-[#0A2F6E] tracking-tight">ران</span>
        </div>

        {/* Right: Menu */}
        <button
          onClick={onMenuOpen}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#0A2F6E]/8 hover:bg-[#0A2F6E]/15 active:scale-95 transition-all"
          aria-label="القائمة الرئيسية"
        >
          <Menu className="w-5 h-5 text-[#0A2F6E]" />
        </button>
      </div>
    </header>
  );
};

export default RiderMapHeader;
