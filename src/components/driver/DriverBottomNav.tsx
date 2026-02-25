/**
 * ران - شريط التنقل السفلي للسائق
 * Bottom Navigation Bar for Driver with Glassmorphism
 */

import { useLocation, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Car, Wallet, User, BarChart3 } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    id: "home",
    path: "/driver",
    label: "الرئيسية",
    icon: Home,
    exact: true,
  },
  {
    id: "rides",
    path: "/driver/rides",
    label: "رحلاتي",
    icon: Car,
  },
  {
    id: "finance",
    path: "/driver/finance",
    label: "المالية",
    icon: Wallet,
  },
  {
    id: "stats",
    path: "/driver/statistics",
    label: "الإحصائيات",
    icon: BarChart3,
  },
  {
    id: "profile",
    path: "/driver/profile",
    label: "حسابي",
    icon: User,
  },
];

const DriverBottomNav = () => {
  const location = useLocation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getActiveIndex = () => {
    for (let i = 0; i < navItems.length; i++) {
      const item = navItems[i];
      if (item.exact) {
        if (location.pathname === item.path) return i;
      } else {
        if (location.pathname.startsWith(item.path)) return i;
      }
    }
    return 0;
  };

  const activeIndex = getActiveIndex();

  // لا تعرض شريط التنقل في صفحات التوثيق أو التسجيل
  const hiddenPaths = ["/driver/auth", "/driver/register", "/driver/complete-registration", "/driver/application-status"];
  if (hiddenPaths.some(p => location.pathname.startsWith(p))) {
    return null;
  }

  return (
    <>
      {/* Spacer */}
      <div className="h-[85px]" />

      <AnimatePresence>
        {mounted && (
          <motion.nav
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 safe-area-pb"
            dir="rtl"
            role="navigation"
            aria-label="القائمة الرئيسية للسائق"
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

                  {/* Nav items */}
                  <div className="relative flex items-center justify-around py-1">
                    {navItems.map((item, index) => {
                      const isActive = index === activeIndex;
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.id}
                          to={item.path}
                          className="flex flex-col items-center justify-center flex-1 py-1 relative z-10 min-h-[56px] min-w-[56px] group"
                          aria-label={item.label}
                          aria-current={isActive ? "page" : undefined}
                        >
                          {/* Background glow */}
                          {isActive && (
                            <motion.div
                              layoutId="driver-nav-indicator"
                              className="absolute inset-2 rounded-xl z-0"
                              initial={false}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            >
                              {/* Gradient layer */}
                              <div className="absolute inset-0 bg-gradient-to-b from-primary/35 via-primary/20 to-primary/10 rounded-xl" />
                              
                              {/* Glass blur */}
                              <div className="absolute inset-0 backdrop-blur-2xl rounded-xl" />
                              
                              {/* Inner light */}
                              <div className="absolute inset-0 bg-gradient-to-t from-white/8 via-white/3 to-transparent rounded-xl" />
                              
                              {/* Border with glow */}
                              <div className="absolute inset-0 rounded-xl border border-primary/50 shadow-[inset_0_2px_8px_rgba(255,255,255,0.4),0_0_24px_rgba(var(--primary-rgb),0.5),inset_0_-2px_8px_rgba(0,0,0,0.1)]" />
                              
                              {/* Top light stripe */}
                              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-t-xl" />
                              
                              {/* Bottom shadow stripe */}
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-black/20 to-transparent rounded-b-xl" />
                            </motion.div>
                          )}

                          {/* Icon */}
                          <motion.div
                            animate={{ 
                              scale: isActive ? 1.35 : 1, 
                              y: isActive ? -3 : 0
                            }}
                            transition={{ type: "spring", stiffness: 500, damping: 25 }}
                            className="relative z-10 flex items-center justify-center"
                          >
                            <motion.div
                              animate={{
                                boxShadow: isActive 
                                  ? "0 0 20px rgba(var(--primary-rgb),0.6), 0 0 40px rgba(var(--primary-rgb),0.3)"
                                  : "0 0 0px rgba(var(--primary-rgb),0)"
                              }}
                              transition={{ duration: 0.3 }}
                              className="p-2 rounded-lg"
                            >
                              <Icon
                                className={cn(
                                  "w-6 h-6 transition-all duration-300",
                                  isActive
                                    ? "text-primary stroke-[2.5px] drop-shadow-[0_0_12px_rgba(var(--primary-rgb),0.9)]"
                                    : "text-muted-foreground/50 stroke-2 group-hover:text-foreground/70 group-hover:drop-shadow-[0_0_6px_rgba(var(--primary-rgb),0.3)]"
                                )}
                              />
                            </motion.div>
                          </motion.div>

                          {/* Label */}
                          <motion.span
                            animate={{ 
                              scale: isActive ? 1.15 : 0.8, 
                              opacity: isActive ? 1 : 0.45,
                              y: isActive ? 0 : 2
                            }}
                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                            className={cn(
                              "text-[10px] font-bold relative z-10 whitespace-nowrap tracking-wide",
                              isActive ? "text-primary drop-shadow-sm" : "text-muted-foreground/40"
                            )}
                          >
                            {item.label}
                          </motion.span>

                          {/* Hover light effect */}
                          {!isActive && (
                            <motion.div
                              whileHover={{ opacity: 0.5 }}
                              className="absolute inset-2 rounded-lg bg-primary/5 opacity-0 -z-10"
                            />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
};

export default DriverBottomNav;
