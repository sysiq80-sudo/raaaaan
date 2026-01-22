/**
 * ران - شريط التنقل السفلي للراكب
 * Premium Bottom Navigation Bar
 */

import { useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Car, Wallet, User, MapPin, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRiderStore } from "@/stores/riderStore";

const navItems = [
  {
    path: "/rider",
    label: "الرئيسية",
    icon: Home,
    exact: true,
  },
  {
    path: "/rider/complete",
    label: "حجز متقدم",
    icon: Sparkles,
    exact: true,
  },
  {
    path: "/rider/rides",
    label: "رحلاتي",
    icon: Car,
  },
  {
    path: "/rider/saved-places",
    label: "أماكني",
    icon: MapPin,
  },
  {
    path: "/rider/settings",
    label: "حسابي",
    icon: User,
  },
];

const RiderBottomNav = () => {
  const location = useLocation();
  const bottomNavEnabled = useRiderStore((state) => state.bottomNavEnabled);

  if (!bottomNavEnabled) {
    return null;
  }

  const isActive = (path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-pb">
      <div className="mx-4 mb-4">
        <div className="bg-card/95 backdrop-blur-xl rounded-md border border-border/50 shadow-lg overflow-hidden">
          <div className="flex items-center justify-around h-[68px] max-w-lg mx-auto px-2">
            {navItems.map((item) => {
              const active = isActive(item.path, item.exact);
              const Icon = item.icon;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "relative flex flex-col items-center justify-center flex-1 h-full py-2 transition-all duration-300",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {/* Active background */}
                  {active && (
                    <motion.div
                      layoutId="nav-bg"
                      className="absolute inset-x-1 inset-y-1.5 rounded-md bg-primary/10"
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 35,
                      }}
                    />
                  )}

                  {/* Active indicator line */}
                  {active && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full"
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                      }}
                    />
                  )}

                  <motion.div
                    animate={{
                      scale: active ? 1.1 : 1,
                      y: active ? -2 : 0,
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className="relative z-10"
                  >
                    <Icon
                      className={cn(
                        "w-5 h-5 mb-1 transition-all",
                        active && "stroke-[2.5px]",
                      )}
                    />
                  </motion.div>

                  <span
                    className={cn(
                      "text-[10px] font-medium relative z-10 transition-all",
                      active && "font-bold",
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default RiderBottomNav;
