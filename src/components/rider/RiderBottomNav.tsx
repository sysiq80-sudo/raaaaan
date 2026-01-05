/**
 * ران - شريط التنقل السفلي للراكب
 * Bottom Navigation Bar
 */

import { useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Car, Wallet, User, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRiderStore } from "@/stores/riderStore";

const navItems = [
    {
        path: "/rider",
        label: "الرئيسية",
        icon: Home,
        exact: true
    },
    {
        path: "/rider/rides",
        label: "رحلاتي",
        icon: Car
    },
    {
        path: "/rider/saved-places",
        label: "أماكني",
        icon: MapPin
    },
    {
        path: "/rider/payments",
        label: "المحفظة الذكية",
        icon: Wallet
    },
    {
        path: "/rider/settings",
        label: "حسابي",
        icon: User
    },
];

const RiderBottomNav = () => {
    const location = useLocation();
    const bottomNavEnabled = useRiderStore((state) => state.bottomNavEnabled);

    // إخفاء الشريط إذا كان معطلاً
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
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border shadow-lg safe-area-pb">
            <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
                {navItems.map((item) => {
                    const active = isActive(item.path, item.exact);
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex flex-col items-center justify-center flex-1 h-full relative transition-colors",
                                active
                                    ? "text-primary"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {active && (
                                <motion.div
                                    layoutId="nav-indicator"
                                    className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-12 h-1 bg-primary rounded-b-full"
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            )}

                            <motion.div
                                animate={{
                                    scale: active ? 1 : 0.9,
                                    y: active ? -2 : 0
                                }}
                                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                            >
                                <Icon className={cn(
                                    "w-5 h-5 mb-1",
                                    active && "stroke-[2.5px]"
                                )} />
                            </motion.div>

                            <span className={cn(
                                "text-[10px] font-medium",
                                active && "font-bold"
                            )}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default RiderBottomNav;
