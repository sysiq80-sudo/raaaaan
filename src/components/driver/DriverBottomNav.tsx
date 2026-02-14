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
            className="fixed bottom-0 left-0 right-0 z-50 mx-4 mb-4"
            role="navigation"
            aria-label="القائمة الرئيسية للسائق"
          >
            <div className="relative bg-card/85 backdrop-blur-2xl rounded-xl border border-border/30 shadow-2xl shadow-black/10 overflow-hidden">
              {/* Active indicator */}
              <motion.div
                className="absolute top-0 bottom-0 rounded-xl overflow-hidden"
                animate={{
                  right: `${(activeIndex / navItems.length) * 100}%`,
                  width: `${100 / navItems.length}%`,
                }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-primary/5 border-2 border-primary/50 rounded-xl" />
                <div className="absolute top-0 left-2 right-2 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent rounded-full" />
              </motion.div>

              {/* Nav items */}
              <div className="relative flex items-center justify-around py-2">
                {navItems.map((item, index) => {
                  const isActive = index === activeIndex;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.id}
                      to={item.path}
                      className="flex flex-col items-center justify-center flex-1 py-1 relative z-10 min-h-[48px] min-w-[48px]"
                      aria-label={item.label}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <motion.div
                        animate={{
                          scale: isActive ? 1.2 : 1,
                          y: isActive ? -4 : 0,
                        }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      >
                        <Icon
                          className={cn(
                            "w-[22px] h-[22px] transition-colors duration-200",
                            isActive
                              ? "text-primary stroke-[2.5px] drop-shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                              : "text-muted-foreground/50"
                          )}
                        />
                      </motion.div>
                      <span
                        className={cn(
                          "text-[11px] mt-1 transition-all duration-200 whitespace-nowrap",
                          isActive
                            ? "text-primary font-bold"
                            : "text-muted-foreground/50 font-medium"
                        )}
                      >
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
};

export default DriverBottomNav;
