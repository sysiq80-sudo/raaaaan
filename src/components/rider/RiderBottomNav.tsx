/**
 * ران - شريط التنقل السفلي للراكب
 * Premium Bottom Navigation Bar with Animated Glass Indicator
 * Features: Glassmorphism, Smooth Transitions, Dynamic Active States
 */

import { useLocation, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Car, Wallet, User, MapPin, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useRiderStore } from "@/stores/riderStore";

const navItems = [
  {
    id: "home",
    path: "/rider",
    label: "الرئيسية",
    icon: Home,
    exact: true,
  },
  {
    id: "schedule",
    path: "/rider/schedule",
    label: "حجز متقدم",
    icon: Sparkles,
    exact: true,
  },
  {
    id: "rides",
    path: "/rider/rides",
    label: "رحلاتي",
    icon: Car,
  },
  {
    id: "places",
    path: "/rider/saved-places",
    label: "أماكني",
    icon: MapPin,
  },
  {
    id: "account",
    path: "/rider/settings",
    label: "حسابي",
    icon: User,
  },
];

const RiderBottomNav = () => {
  const location = useLocation();
  const bottomNavEnabled = useRiderStore((state) => state.bottomNavEnabled);
  const [activeIndex, setActiveIndex] = useState(0);

  // تحديث حالة النشط بناءً على المسار الحالي - مع معالجة دقيقة للمسارات
  useEffect(() => {
    let currentIndex = 0;
    
    // تحقق من المسارات بالترتيب الدقيق
    for (let i = 0; i < navItems.length; i++) {
      const item = navItems[i];
      if (item.exact) {
        // مطابقة دقيقة للمسار الكامل
        if (location.pathname === item.path) {
          currentIndex = i;
          break;
        }
      } else {
        // مطابقة البادئة
        if (location.pathname.startsWith(item.path) && 
            location.pathname !== "/rider") { // تجنب تضارب مع الرئيسية
          currentIndex = i;
          break;
        }
      }
    }
    
    // إذا لم نجد تطابقاً، اختبر الرئيسية (home) كقيمة افتراضية
    if (location.pathname === "/rider") {
      currentIndex = 0;
    }
    
    setActiveIndex(currentIndex);
  }, [location.pathname]);

  const isActive = (itemId: string, path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path) && location.pathname !== "/rider";
  };

  // حساب الموضع الصحيح للـ RTL - index 0 على اليمين، index 4 على اليسار
  const itemPercentage = (activeIndex / navItems.length) * 100;

  return (
    <AnimatePresence mode="wait">
      {bottomNavEnabled && (
        <>
          {/* Spacer to prevent content from being hidden - with smooth transition */}
          <motion.div 
            key="nav-spacer"
            initial={{ height: 0 }}
            animate={{ height: 100 }}
            exit={{ height: 0 }}
            transition={{ 
              type: "spring",
              stiffness: 300,
              damping: 30,
              mass: 0.8
            }}
            className="w-full" 
            aria-hidden="true" 
          />
          
          <motion.nav 
            key="bottom-nav"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              mass: 0.8
            }}
            className="fixed bottom-0 left-0 right-0 z-50 safe-area-pb"
            role="navigation"
            aria-label="التنقل الرئيسي للراكب"
          >
            <div className="mx-4 mb-4">
              <motion.div 
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 25
                }}
                className="bg-card/85 backdrop-blur-2xl rounded-xl border border-primary/10 shadow-2xl overflow-hidden relative"
              >
                {/* Glassmorphism Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />

                <div className="relative flex items-center justify-around h-[72px] max-w-2xl mx-auto px-2">
                  {/* Animated Glass Indicator Background - True Glassmorphism Effect */}
                  <motion.div
                    layoutId="glass-indicator"
                    className="absolute h-[56px] top-2 rounded-lg pointer-events-none"
                    initial={false}
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 28,
                      mass: 0.6,
                    }}
                    style={{
                      width: `calc(100% / ${navItems.length} - 4px)`,
                      right: `calc(${itemPercentage}% + 2px)`,
                    }}
                  >
                    {/* Glass Background Layer - أكثر وضوحاً وبروزاً */}
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/40 via-primary/25 to-primary/15 rounded-lg" />
                    {/* Backdrop Blur Effect - تأثير بلوري قوي جداً */}
                    <div className="absolute inset-0 backdrop-blur-2xl rounded-lg" />
                    {/* Inner Glass Glow - توهج داخلي قوي */}
                    <div className="absolute inset-1 rounded-lg bg-gradient-to-t from-primary/10 to-primary/25 blur-sm opacity-70" />
                    {/* Bright Border - حد مضيء جداً وواضح */}
                    <div className="absolute inset-0 rounded-lg border-2 border-primary/70 shadow-[inset_0_3px_6px_rgba(255,255,255,0.4),0_0_20px_rgba(var(--primary-rgb),0.7)]" />
                    {/* Top Light Highlight - خط علوي مضيء قوي */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-primary/60 to-transparent rounded-t-lg" />
                    {/* Bottom Glow Edge */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent rounded-b-lg" />
                  </motion.div>

                  {navItems.map((item, index) => {
                    const active = isActive(item.id, item.path, item.exact);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.id}
                        to={item.path}
                        aria-label={item.label}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex flex-col items-center justify-center flex-1 h-full py-2 transition-all duration-300 rounded-lg cursor-pointer group min-h-[48px] min-w-[48px]"
                        )}
                      >
                        <motion.div
                          animate={{
                            scale: active ? 1.25 : 1,
                            y: active ? -6 : 0,
                          }}
                          transition={{ 
                            type: "spring", 
                            stiffness: 500, 
                            damping: 25 
                          }}
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

                        <motion.span
                          animate={{
                            scale: active ? 1.1 : 0.85,
                            opacity: active ? 1 : 0.5,
                          }}
                          transition={{ 
                            type: "spring", 
                            stiffness: 400, 
                            damping: 20 
                          }}
                          className={cn(
                            "text-[11px] font-bold relative z-10 transition-all duration-300 whitespace-nowrap",
                            active 
                              ? "text-primary" 
                              : "text-muted-foreground/40"
                          )}
                        >
                          {item.label}
                        </motion.span>
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  );
};

export default RiderBottomNav;