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
          {/* Spacer - 80px to match fixed nav height */}
          <motion.div
            key="nav-spacer"
            initial={{ height: 0 }}
            animate={{ height: 80 }}
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
            {/* خلفية تدرجية من الأسفل */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/15 via-primary/5 to-transparent pointer-events-none" />
            
            <div className="w-full">
              <div className="relative overflow-hidden w-full">
                {/* تأثير الضوء العلوي */}
                <div className="absolute -top-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                
                {/* الشريط الرئيسي - ملاصق تماماً للأسفل */}
                <div className="bg-gradient-to-b from-card/70 via-card/80 to-card/90 backdrop-blur-3xl border-t border-primary/20 shadow-2xl overflow-hidden relative w-full">
                  {/* خلفية زجاجية متقدمة */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-secondary/8 pointer-events-none" />
                  
                  {/* ضوء علوي ناعم */}
                  <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-white/5 via-transparent to-transparent pointer-events-none" />
                  
                  {/* تأثير الوهج الداخلي */}
                  <div className="absolute inset-0 add-glow pointer-events-none" />
                  
                  {/* ✅ CSS Grid — 5 أعمدة متساوية، dir="rtl" يرتب من اليمين */}
                  <LayoutGroup>
                    <div className="relative grid grid-cols-5 h-20 w-full">
                      {NAV_ITEMS.map((item) => {
                        const active = activeId === item.id;
                        const Icon = item.icon;

                        return (
                          <Link
                            key={item.id}
                            to={item.path}
                            aria-label={item.label}
                            aria-current={active ? "page" : undefined}
                            className="relative flex flex-col items-center justify-center h-full cursor-pointer group"
                          >
                            {/* ✅ layoutId Indicator — يتحرك تلقائياً بين العناصر */}
                            {active && (
                              <motion.div
                                layoutId="nav-indicator"
                                className="absolute inset-3 rounded-xl z-0"
                                initial={false}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              >
                                {/* طبقة التدرج الأساسية */}
                                <div className="absolute inset-0 bg-gradient-to-b from-primary/35 via-primary/20 to-primary/10 rounded-xl" />
                                
                                {/* طبقة الزجاج الضبابي */}
                                <div className="absolute inset-0 backdrop-blur-2xl rounded-xl" />
                                
                                {/* طبقة الإضاءة الداخلية */}
                                <div className="absolute inset-0 bg-gradient-to-t from-white/8 via-white/3 to-transparent rounded-xl" />
                                
                                {/* إطار ناعم مع توهج */}
                                <div className="absolute inset-0 rounded-xl border border-primary/50 shadow-[inset_0_2px_8px_rgba(255,255,255,0.4),0_0_24px_rgba(var(--primary-rgb),0.5),inset_0_-2px_8px_rgba(0,0,0,0.1)]" />
                                
                                {/* شريط ضوء أمامي */}
                                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-t-xl" />
                                
                                {/* شريط ظل خلفي */}
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-black/20 to-transparent rounded-b-xl" />
                              </motion.div>
                            )}

                            {/* أيقونة محسّنة */}
                            <motion.div
                              animate={{ 
                                scale: active ? 1.35 : 1, 
                                y: active ? -3 : 0,
                                rotateZ: active ? 0 : 0
                              }}
                              transition={{ type: "spring", stiffness: 500, damping: 25 }}
                              className="relative z-10 flex items-center justify-center"
                            >
                              <motion.div
                                animate={{
                                  boxShadow: active 
                                    ? "0 0 20px rgba(var(--primary-rgb),0.6), 0 0 40px rgba(var(--primary-rgb),0.3)"
                                    : "0 0 0px rgba(var(--primary-rgb),0)"
                                }}
                                transition={{ duration: 0.3 }}
                                className="p-2 rounded-lg"
                              >
                                <Icon
                                  className={cn(
                                    "w-6 h-6 transition-all duration-300",
                                    active
                                      ? "text-primary stroke-[2.5px] drop-shadow-[0_0_12px_rgba(var(--primary-rgb),0.9)]"
                                      : "text-muted-foreground/50 stroke-2 group-hover:text-foreground/70 group-hover:drop-shadow-[0_0_6px_rgba(var(--primary-rgb),0.3)]"
                                  )}
                                />
                              </motion.div>
                            </motion.div>

                            {/* نص محسّن */}
                            <motion.span
                              animate={{ 
                                scale: active ? 1.15 : 0.8, 
                                opacity: active ? 1 : 0.45,
                                y: active ? 0 : 2
                              }}
                              transition={{ type: "spring", stiffness: 400, damping: 20 }}
                              className={cn(
                                "text-[10px] font-bold relative z-10 whitespace-nowrap tracking-wide",
                                active ? "text-primary drop-shadow-sm" : "text-muted-foreground/40"
                              )}
                            >
                              {item.label}
                            </motion.span>

                            {/* ضوء خفي للـ hover */}
                            {!active && (
                              <motion.div
                                whileHover={{ opacity: 0.5 }}
                                className="absolute inset-2 rounded-lg bg-primary/5 opacity-0 -z-10"
                              />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </LayoutGroup>
                </div>
              </div>
            </div>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  );
};

export default RiderBottomNav;