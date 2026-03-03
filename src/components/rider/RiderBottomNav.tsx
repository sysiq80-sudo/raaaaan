/**
 * ران - شريط التنقل السفلي للراكب
 * تصميم مسطح بحواف حادة + فواصل بين الأزرار
 */

import { useLocation, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Car, User, MapPin, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRiderStore } from "@/stores/riderStore";

const NAV_ITEMS = [
  { id: "home",    path: "/rider/go",           label: "الخريطة", icon: Home,   exact: true  },
  { id: "places",  path: "/rider/saved-places",  label: "أماكني",  icon: MapPin, exact: false },
  { id: "voice",   path: "/rider",               label: "صوتي AI", icon: Mic,    exact: true  },
  { id: "rides",   path: "/rider/rides",         label: "رحلاتي",  icon: Car,    exact: false },
  { id: "account", path: "/rider/settings",      label: "حسابي",   icon: User,   exact: false },
] as const;

const RiderBottomNav = () => {
  const location  = useLocation();
  const bottomNavEnabled = useRiderStore((s) => s.bottomNavEnabled);

  const getActiveId = () => {
    if (location.pathname === "/rider/go") return "home";
    if (location.pathname === "/rider")    return "voice";
    for (const item of NAV_ITEMS) {
      if (item.exact) {
        if (location.pathname === item.path) return item.id;
      } else {
        if (location.pathname.startsWith(item.path) && location.pathname !== "/rider") return item.id;
      }
    }
    return "home";
  };

  const activeId = getActiveId();

  return (
    <AnimatePresence mode="wait">
      {bottomNavEnabled && (
        <>
          {/* Spacer */}
          <motion.div
            key="nav-spacer"
            initial={{ height: 0 }}
            animate={{ height: 64 }}
            exit={{ height: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full"
            aria-hidden="true"
          />

          <motion.nav
            key="bottom-nav"
            dir="rtl"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            exit={{ y: 80,   opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50"
            role="navigation"
            aria-label="التنقل الرئيسي للراكب"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {/* خط علوي مضيء عند النشاط */}
            <div className="h-px w-full bg-border/60" />

            {/* الشريط الرئيسي */}
            <div className="bg-card/95 backdrop-blur-xl grid grid-cols-5 h-16 w-full">
              {NAV_ITEMS.map((item, idx) => {
                const active = activeId === item.id;
                const Icon   = item.icon;
                const isLast = idx === NAV_ITEMS.length - 1;

                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex flex-col items-center justify-center h-full gap-1 transition-colors duration-150",
                      !isLast && "border-l border-border/30",
                      active ? "bg-primary/8" : "hover:bg-muted/40"
                    )}
                  >
                    {/* مؤشر نشاط — خط علوي حاد */}
                    {active && (
                      <motion.div
                        layoutId="nav-active-bar"
                        className="absolute top-0 left-0 right-0 h-0.5 bg-primary"
                        initial={false}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}

                    {/* الأيقونة */}
                    <Icon
                      className={cn(
                        "w-5 h-5 transition-all duration-150",
                        active
                          ? "text-primary stroke-[2.5px]"
                          : "text-muted-foreground/60 stroke-2"
                      )}
                    />

                    {/* النص */}
                    <span
                      className={cn(
                        "text-[10px] font-semibold leading-none transition-colors duration-150",
                        active ? "text-primary" : "text-muted-foreground/50"
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  );
};

export default RiderBottomNav;