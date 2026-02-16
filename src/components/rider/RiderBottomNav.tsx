/**
 * ران - شريط التنقل السفلي للراكب
 * Premium Bottom Navigation Bar — layoutId Shared Layout Approach
 * RTL: dir="rtl" + CSS Grid → index 0 على أقصى اليمين تلقائياً
 * Indicator: Framer Motion layoutId — بدون حسابات يدوية للموضع
 */

import { useLocation, Link } from "react-router-dom";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Home, Car, User, MapPin, Sparkles, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRiderStore } from "@/stores/riderStore";

// ترتيب RTL: index 0 = أقصى اليمين، index 4 = أقصى اليسار
const NAV_ITEMS = [
  { id: "home",     path: "/rider/go",             label: "الخريطة",   icon: Home,     exact: true },
  { id: "places",   path: "/rider/saved-places",   label: "أماكني",     icon: MapPin,   exact: false },
  { id: "voice",    path: "/rider",                 label: "صوتي AI",   icon: Mic,      exact: true },
  { id: "rides",    path: "/rider/rides",           label: "رحلاتي",    icon: Car,      exact: false },
  { id: "account",  path: "/rider/settings",        label: "حسابي",     icon: User,     exact: false },
] as const;

const RiderBottomNav = () => {
  const location = useLocation();
  const bottomNavEnabled = useRiderStore((state) => state.bottomNavEnabled);

  const getActiveId = () => {
    // الخريطة (GoPage)
    if (location.pathname === "/rider/go") return "home";
    // الصفحة الرئيسية الصوتية
    if (location.pathname === "/rider") return "voice";
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
            animate={{ height: 100 }}
            exit={{ height: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.8 }}
            className="w-full"
            aria-hidden="true"
          />

          <motion.nav
            key="bottom-nav"
            dir="rtl"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.8 }}
            className="fixed bottom-0 left-0 right-0 z-50 safe-area-pb"
            role="navigation"
            aria-label="التنقل الرئيسي للراكب"
          >
            <div className="mx-4 mb-4">
              <div className="bg-card/85 backdrop-blur-2xl rounded-xl border border-primary/10 shadow-2xl overflow-hidden relative">
                {/* خلفية زجاجية */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />

                {/* ✅ CSS Grid — 5 أعمدة متساوية، dir="rtl" يرتب من اليمين */}
                <LayoutGroup>
                  <div className="relative grid grid-cols-5 h-[72px] max-w-2xl mx-auto">
                    {NAV_ITEMS.map((item) => {
                      const active = activeId === item.id;
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.id}
                          to={item.path}
                          aria-label={item.label}
                          aria-current={active ? "page" : undefined}
                          className="relative flex flex-col items-center justify-center h-full py-2 cursor-pointer group min-h-[48px]"
                        >
                          {/* ✅ layoutId Indicator — يتحرك تلقائياً بين العناصر */}
                          {active && (
                            <motion.div
                              layoutId="nav-indicator"
                              className="absolute inset-1 rounded-lg z-0"
                              initial={false}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            >
                              <div className="absolute inset-0 bg-gradient-to-b from-primary/40 via-primary/25 to-primary/15 rounded-lg" />
                              <div className="absolute inset-0 backdrop-blur-2xl rounded-lg" />
                              <div className="absolute inset-1 rounded-lg bg-gradient-to-t from-primary/10 to-primary/25 blur-sm opacity-70" />
                              <div className="absolute inset-0 rounded-lg border-2 border-primary/70 shadow-[inset_0_3px_6px_rgba(255,255,255,0.4),0_0_20px_rgba(var(--primary-rgb),0.7)]" />
                              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-primary/60 to-transparent rounded-t-lg" />
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent rounded-b-lg" />
                            </motion.div>
                          )}

                          {/* أيقونة */}
                          <motion.div
                            animate={{ scale: active ? 1.25 : 1, y: active ? -4 : 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 25 }}
                            className="relative z-10"
                          >
                            <Icon
                              className={cn(
                                "w-6 h-6 mb-1 transition-all duration-300",
                                active
                                  ? "text-primary stroke-[3px] drop-shadow-[0_0_12px_rgba(var(--primary-rgb),0.8)]"
                                  : "text-muted-foreground/50 stroke-2 group-hover:text-foreground/60"
                              )}
                            />
                          </motion.div>

                          {/* نص */}
                          <motion.span
                            animate={{ scale: active ? 1.1 : 0.85, opacity: active ? 1 : 0.5 }}
                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                            className={cn(
                              "text-[11px] font-bold relative z-10 whitespace-nowrap",
                              active ? "text-primary" : "text-muted-foreground/40"
                            )}
                          >
                            {item.label}
                          </motion.span>
                        </Link>
                      );
                    })}
                  </div>
                </LayoutGroup>
              </div>
            </div>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  );
};

export default RiderBottomNav;