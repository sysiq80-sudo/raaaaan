/**
 * ران - شريط التنقل السفلي للراكب
 * shrink-0 — لا fixed، لا تراكب، يدفع المحتوى للأعلى طبيعياً
 *
 * Haptic-like feedback: motion(Link) + whileTap
 * يحافظ على accessibility وسلوك React Router الكامل
 */

import { useLocation, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Car, Wallet, Navigation, MapPin, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { preloadRiderRoute } from "@/lib/riderRoutePreload";

/** motion-enhanced Link يحافظ على كل سلوك <Link> الأصلي */
const MotionLink = motion(Link);

/* ───────────── عناصر الشريط ───────────── */
const RIGHT_ITEMS = [
  { id: "rides",  path: "/rider/rides",    label: "رحلاتي",  icon: Car    },
  { id: "wallet", path: "/rider/payments", label: "المحفظة", icon: Wallet },
] as const;

const LEFT_ITEMS = [
  { id: "places",   path: "/rider/saved-places", label: "أماكني",    icon: MapPin   },
  { id: "settings", path: "/rider/settings",     label: "الإعدادات", icon: Settings },
] as const;

const NAV_TAP_TRANSITION = { type: "tween", duration: 0.1, ease: "easeOut" } as const;

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
      <MotionLink
        to={path}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className="relative flex flex-col items-center justify-center flex-1 h-full gap-1 group"
        style={{ WebkitTapHighlightColor: "transparent" }}
        onPointerDown={() => preloadRiderRoute(path)}
        onMouseEnter={() => preloadRiderRoute(path)}
        whileTap={{ scale: 0.94, opacity: 0.82 }}
        transition={NAV_TAP_TRANSITION}
      >
        {active && (
          <motion.div
            layoutId="rider-nav-indicator"
            className="absolute top-0 inset-x-3 h-0.5 rounded-full"
            style={{ background: 'var(--raan-accent)' }}
            transition={{ type: "tween", duration: 0.16, ease: "easeOut" }}
          />
        )}
        <Icon
          className="w-5 h-5 transition-colors duration-150"
          style={{ color: active ? 'var(--raan-accent)' : 'var(--raan-text-muted)' }}
        />
        <span
          className="text-[10px] font-semibold leading-none"
          style={{ color: active ? 'var(--raan-accent)' : 'var(--raan-text-muted)' }}
        >
          {label}
        </span>
      </MotionLink>
    );
  };

  return (
    <div
      dir="rtl"
      className="shrink-0 w-full"
      style={{
        borderTop: '1px solid var(--raan-border)',
        paddingBottom: 0,
      }}
      role="navigation"
      aria-label="التنقل الرئيسي"
    >
      <div
        className="backdrop-blur-xl flex items-center h-[68px]"
        style={{ background: 'var(--raan-bg)' }}
      >
        {/* يمين */}
        {RIGHT_ITEMS.map((item) => (
          <NavItem key={item.id} {...item} />
        ))}

        {/* وسط: زر رحلة جديدة */}
        <div className="flex items-center justify-center flex-shrink-0 px-3">
          <motion.button
            onClick={() => navigate("/rider")}
            onPointerDown={() => preloadRiderRoute("/rider")}
            onMouseEnter={() => preloadRiderRoute("/rider")}
            whileTap={{ scale: 0.94, opacity: 0.88 }}
            transition={NAV_TAP_TRANSITION}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1.5",
              "w-[64px] h-[52px] rounded-2xl -mt-4",
              "bg-[#5bdda6] text-[#0b1326]",
              "shadow-lg shadow-[#5bdda6]/30"
            )}
            aria-label="رحلة جديدة"
            style={{ WebkitTapHighlightColor: "transparent" }}
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
