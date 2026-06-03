/**
 * ران - شريط التنقل السفلي للسائق
 * shrink-0 — لا fixed، لا تراكب، يدفع المحتوى للأعلى طبيعياً
 * مطابق لتصميم RiderBottomNav في الأبعاد والارتفاع والـ safe-area
 *
 * Haptic-like feedback: motion(Link) + whileTap
 * يحافظ على accessibility وسلوك React Router الكامل
 */

import { useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Car, Wallet, User, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { preloadDriverRoute } from "@/lib/driverRoutePreload";

/** motion-enhanced Link يحافظ على كل سلوك <Link> الأصلي */
const MotionLink = motion(Link);
const NAV_TAP_TRANSITION = { type: "tween", duration: 0.1, ease: "easeOut" } as const;

// ترتيب من اليمين لليسار (RTL) — الرئيسية أولاً من اليمين
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
    <div
      dir="rtl"
      className="shrink-0 w-full border-t border-[#5bdda6]/10 bg-[#0b1326]"
      role="navigation"
      aria-label="القائمة الرئيسية للسائق"
      style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}
    >
      <div
        className="backdrop-blur-xl flex items-center h-[68px] bg-[#0b1326]"
      >
        {navItems.map((item, index) => {
          const isActive = index === activeIndex;
          const Icon = item.icon;

          return (
            <MotionLink
              key={item.id}
              to={item.path}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className="relative flex flex-col items-center justify-center flex-1 h-full gap-1 group"
              style={{ WebkitTapHighlightColor: "transparent" }}
              onPointerDown={() => preloadDriverRoute(item.path)}
              onMouseEnter={() => preloadDriverRoute(item.path)}
              whileTap={{ scale: 0.94, opacity: 0.82 }}
              transition={NAV_TAP_TRANSITION}
            >
              {isActive && (
                <motion.div
                  layoutId="driver-nav-indicator"
                  className="absolute top-0 inset-x-3 h-0.5 rounded-full bg-[#5bdda6]"
                  transition={{ type: "tween", duration: 0.16, ease: "easeOut" }}
                />
              )}
              <Icon
                className={cn(
                  "w-5 h-5 transition-colors duration-150",
                  isActive
                    ? "text-[#5bdda6] stroke-[2.5px] drop-shadow-[0_0_8px_rgba(91,221,166,0.6)]"
                    : "text-slate-600 stroke-[1.8px]"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-semibold leading-none transition-colors duration-150",
                  isActive ? "text-[#5bdda6]" : "text-slate-600"
                )}
              >
                {item.label}
              </span>
            </MotionLink>
          );
        })}
      </div>
    </div>
  );
};

export default DriverBottomNav;
