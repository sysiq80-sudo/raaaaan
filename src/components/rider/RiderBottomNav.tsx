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
            className="absolute top-0 inset-x-3 h-0.5 rounded-full bg-primary"
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}
        <Icon
          className={cn(
            "w-5 h-5 transition-all duration-200",
            active
              ? "text-primary stroke-[2.5px]"
              : "text-muted-foreground/60 group-hover:text-muted-foreground"
          )}
        />
        <span
          className={cn(
            "text-[10px] font-semibold leading-none transition-colors",
            active ? "text-primary" : "text-muted-foreground/50 group-hover:text-muted-foreground"
          )}
        >
          {label}
        </span>
      </Link>
    );
  };

  return (
    <div
      dir="rtl"
      className="shrink-0 w-full border-t border-border/50"
      role="navigation"
      aria-label="التنقل الرئيسي"
    >
      {/* خط علوي */}
      <div className="h-px w-full bg-border/50" />

      <div
        className="bg-card/95 backdrop-blur-xl flex items-center h-[68px]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* يمين: رحلاتي + المحفظة */}
        {RIGHT_ITEMS.map((item) => (
          <NavItem key={item.id} {...item} />
        ))}

        {/* وسط: زر رحلة جديدة البارز */}
        <div className="flex items-center justify-center flex-shrink-0 px-3">
          <motion.button
            onClick={() => navigate("/rider")}
            whileTap={{ scale: 0.92 }}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1.5",
              "w-[64px] h-[52px] rounded-2xl -mt-4",
              "bg-primary text-primary-foreground",
              "shadow-lg shadow-primary/40",
              "transition-shadow duration-200"
            )}
            aria-label="رحلة جديدة"
          >
            <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-md -z-10" />
            <Navigation className="w-6 h-6 stroke-[2.5px]" />
            <span className="text-[9px] font-bold leading-none">رحلة جديدة</span>
          </motion.button>
        </div>

        {/* يسار: أماكني + الإعدادات */}
        {LEFT_ITEMS.map((item) => (
          <NavItem key={item.id} {...item} />
        ))}
      </div>
    </div>
  );
};

export default RiderBottomNav;
