/**
 * ران - شريط التنقل السفلي للسائق
 * Bottom Navigation Bar for Driver — Clean & Minimal RTL
 */

import { useLocation, Link } from "react-router-dom";
import { Home, Car, Wallet, User, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <>
      {/* Spacer */}
      <div className="h-[72px]" />

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 safe-area-pb"
        dir="rtl"
        role="navigation"
        aria-label="القائمة الرئيسية للسائق"
      >
        {/* الشريط الرئيسي */}
        <div className="bg-card/95 backdrop-blur-xl border-t border-border/50 shadow-lg">
          <div className="flex items-center justify-around">
            {navItems.map((item, index) => {
              const isActive = index === activeIndex;
              const Icon = item.icon;

              return (
                <Link
                  key={item.id}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center justify-center flex-1 py-2.5 relative min-h-[56px] transition-colors duration-200 outline-none focus:outline-none focus-visible:outline-none select-none",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground/60 active:text-foreground/80"
                  )}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                >
                  {/* Active indicator dot */}
                  {isActive && (
                    <div className="absolute top-1.5 w-1 h-1 rounded-full bg-primary shadow-[0_0_6px_rgba(var(--primary-rgb),0.8)]" />
                  )}

                  {/* Icon */}
                  <Icon
                    className={cn(
                      "w-5.5 h-5.5 mb-0.5 transition-all duration-200",
                      isActive
                        ? "stroke-[2.5px] drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.6)]"
                        : "stroke-[1.8px]"
                    )}
                    style={{ width: 22, height: 22 }}
                  />

                  {/* Label */}
                  <span
                    className={cn(
                      "text-[10px] leading-tight transition-all duration-200",
                      isActive
                        ? "font-bold opacity-100"
                        : "font-medium opacity-60"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
};

export default DriverBottomNav;
