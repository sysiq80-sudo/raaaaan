/**
 * ران - شريط التنقل السفلي للراكب
 * shrink-0 — لا fixed، لا تراكب، يدفع المحتوى للأعلى طبيعياً
 */

import { useLocation, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Car, Wallet, Navigation, MapPin, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

/* ───────────── عناصر الشريط ───────────── */
const RIGHT_ITEMS = [
  { id: "rides",  path: "/rider/rides",    label: "رحلاتي",  icon: Car    },
  { id: "wallet", path: "/rider/payments", label: "المحفظة", icon: Wallet },
] as const;

const LEFT_ITEMS = [
  { id: "places",   path: "/rider/saved-places", label: "أماكني",    icon: MapPin   },
  { id: "settings", path: "/rider/settings",     label: "الإعدادات", icon: Settings },
] as const;

/* ───────────── المكوّن ───────────────── */
const RiderBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const NavItem = ({
    path,
    label,
    icon: Icon,
  }: {
    id: string;
    path: string;
    label: string;
    icon: React.ElementType;
  }) => {
    const active = isActive(path);
    return (
      <Link
        to={path}
        aria-label={label}
        className="relative flex flex-col items-center justify-center flex-1 h-full gap-1 group"
      >
        {active && (
          <motion.div
            layoutId="rider-nav-indicator"
            className="absolute top-0 inset-x-3 h-0.5 rounded-full"
            style={{ background: 'var(--raan-accent)' }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}
        <Icon
          className={cn(
            "w-5 h-5 transition-all duration-200"
          )}
          style={{ color: active ? 'var(--raan-accent)' : 'var(--raan-text-muted)' }}
        />
        <span
          className={cn("text-[10px] font-semibold leading-none transition-colors")}
          style={{ color: active ? 'var(--raan-accent)' : 'var(--raan-text-muted)' }}
        >
          {label}
        </span>
      </Link>
    );
  };

  return (
    <div
      dir="rtl"
      className="shrink-0 w-full transition-colors duration-300"
      style={{ borderTop: '1px solid var(--raan-border)' }}
      role="navigation"
      aria-label="التنقل الرئيسي"
    >
      <div
      className="backdrop-blur-xl flex items-center h-[68px] transition-colors duration-300"
        style={{
          background: 'var(--raan-bg)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 24px), 24px)'
        }}
      >
        {/* يمين */}
        {RIGHT_ITEMS.map((item) => (
          <NavItem key={item.id} {...item} />
        ))}

        {/* وسط: زر رحلة جديدة */}
        <div className="flex items-center justify-center flex-shrink-0 px-3">
          <motion.button
            onClick={() => navigate("/rider")}
            whileTap={{ scale: 0.92 }}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1.5",
              "w-[64px] h-[52px] rounded-2xl -mt-4",
              "bg-[#5bdda6] text-[#0b1326]",
              "shadow-lg shadow-[#5bdda6]/30",
              "transition-shadow duration-200"
            )}
            aria-label="رحلة جديدة"
          >
            <div className="absolute inset-0 rounded-2xl bg-[#5bdda6]/20 blur-md -z-10" />
            <Navigation className="w-6 h-6 stroke-[2.5px]" />
            <span className="text-[9px] font-bold leading-none">رحلة جديدة</span>
          </motion.button>
        </div>

        {/* يسار */}
        {LEFT_ITEMS.map((item) => (
          <NavItem key={item.id} {...item} />
        ))}
      </div>
    </div>
  );
};

export default RiderBottomNav;
