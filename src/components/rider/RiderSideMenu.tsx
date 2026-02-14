import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  LogOut,
  History,
  Settings,
  CreditCard,
  MapPin,
  Car,
  Clock,
  XCircle,
  Loader2,
  Gift,
  Info,
  HelpCircle,
  Star,
  Navigation2,
  ToggleLeft,
  ToggleRight,
  MessageSquare,
  ArrowLeftRight,
  UserCircle2,
  LogIn,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRiderStore } from "@/stores/riderStore";
import { formatEmailToPhone } from "@/lib/validations";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import RiderNotificationsBell from "./RiderNotificationsBell";
import StatusIcons from "@/components/common/StatusIcons";
import { useToast } from "@/hooks/use-toast";

interface RiderSideMenuProps {
  user?: any; // مهمل — يستخدم useAuth() داخلياً الآن
  isOpen?: boolean;
  onClose?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onLogout?: () => void;
}
const MenuLink = ({
  icon,
  label,
  href,
  onClick,
  isActive = false,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  onClick?: () => void;
  isActive?: boolean;
}) => (
  <Link
    to={href}
    onClick={onClick}
    className="relative flex items-center gap-3 p-3 rounded-lg transition-all duration-300 group"
  >
    {/* Animated Glass Background - يظهر فقط عند التفعيل */}
    <motion.div
      layoutId="side-menu-glass"
      className="absolute inset-0 rounded-lg pointer-events-none overflow-hidden"
      initial={false}
      animate={{
        opacity: isActive ? 1 : 0,
      }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 28,
      }}
    >
      {/* Glass Background Layer - قوي وواضح */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/50 via-primary/35 to-primary/20 rounded-lg" />
      {/* Backdrop Blur Effect - تأثير بلوري قوي جداً */}
      <div className="absolute inset-0 backdrop-blur-2xl rounded-lg" />
      {/* Inner Glass Glow - توهج قوي */}
      <div className="absolute inset-1 rounded-lg bg-gradient-to-r from-primary/20 to-primary/10 blur-sm opacity-80" />
      {/* Bright Border - حد مضيء واضح جداً */}
      <div className="absolute inset-0 rounded-lg border-2 border-primary/80 shadow-[inset_0_3px_8px_rgba(255,255,255,0.4),0_0_24px_rgba(var(--primary-rgb),0.8)]" />
      {/* Top Light Edge */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-b from-primary/70 to-transparent rounded-t-lg" />
      {/* Right Light Highlight - خط على اليمين */}
      <div className="absolute top-0 bottom-0 right-0 w-2 bg-gradient-to-b from-primary/90 via-primary/50 to-transparent rounded-r-lg" />
    </motion.div>
    
    {/* Content Layer - يبقى فوق الزجاج دائماً */}
    <motion.span
      className={cn(
        "text-muted-foreground/50 transition-all duration-300 relative z-10",
        isActive && "text-white scale-140 drop-shadow-[0_0_12px_rgba(0,0,0,0.8)]"
      )}
      animate={{
        color: isActive ? "white" : "rgb(120, 113, 108)",
      }}
    >
      {icon}
    </motion.span>
    
    <motion.span
      className={cn(
        "transition-all duration-300 font-medium relative z-10",
        isActive ? "text-white font-bold text-base" : "text-foreground"
      )}
      animate={{
        color: isActive ? "white" : "rgb(228, 228, 231)",
      }}
    >
      {label}
    </motion.span>
  </Link>
);
const RiderSideMenu = ({
  user: _userProp,
  isOpen,
  onClose,
  open,
  onOpenChange,
  onLogout,
}: RiderSideMenuProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user: authUser, logout } = useAuth();
  // ✅ نستخدم المستخدم من AuthContext مباشرة — أكثر موثوقية من الـ prop
  const user = authUser;
  const bottomNavEnabled = useRiderStore((state) => state.bottomNavEnabled);
  const toggleBottomNav = useRiderStore((state) => state.toggleBottomNav);
  const userLocation = useRiderStore((s) => s.userLocation);

  const isMenuOpen = isOpen !== undefined ? isOpen : open || false;
  
  const isActiveLink = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href);
  };
  const handleClose = () => {
    if (onClose) onClose();
    if (onOpenChange) onOpenChange(false);
  };

  if (!isMenuOpen) return null;

  // لم نعد بحاجة لـ getDriverStatusLabel — الزر يظهر دائماً

  return (
    <div
      className="fixed inset-0 z-[1000] bg-background/80 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="absolute top-0 right-0 h-full w-72 bg-card shadow-xl p-6 animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 pb-4 border-b border-border">
          {user ? (
            <div className="flex items-center gap-3">
              {/* صورة المستخدم أو أيقونة افتراضية */}
              <div className="w-11 h-11 rounded-full bg-[#00E676]/15 flex items-center justify-center flex-shrink-0 border border-[#00E676]/30">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt=""
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <UserCircle2 className="w-6 h-6 text-[#00E676]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-foreground truncate">
                  {user.user_metadata?.full_name || "مستخدم ران"}
                </p>
                <p className="text-xs text-muted-foreground truncate" dir="ltr">
                  {formatEmailToPhone(user.email) || user.phone || ""}
                </p>
              </div>
            </div>
          ) : (
            <Link
              to="/auth"
              onClick={handleClose}
              className="flex items-center gap-3 p-3 rounded-lg bg-[#00E676]/10 border border-[#00E676]/20 hover:bg-[#00E676]/20 transition-colors"
            >
              <LogIn className="w-5 h-5 text-[#00E676]" />
              <span className="text-[#00E676] font-semibold">تسجيل الدخول</span>
            </Link>
          )}
        </div>

        {/* Status icons & notifications - moved into side menu */}
        {user && (
          <div className="mb-4 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              {user && <RiderNotificationsBell userId={user.id} />}
            </div>
            <div className="flex items-center">
              <StatusIcons userLocation={userLocation} />
            </div>
          </div>
        )}

        {/* Driver Mode Switch — يظهر دائماً للمستخدم المسجل */}
        {user && (
          <div className="mb-4">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 border-[#00E676]/40 text-[#00E676] hover:bg-[#00E676]/10 h-12 text-base font-bold rounded-xl"
              onClick={() => {
                // Hard reload: يدمر كل مكونات الخريطة و Location Watchers بالكامل
                window.location.href = '/driver';
              }}
            >
              <Car className="w-5 h-5" />
              التبديل لوضع السائق
            </Button>
          </div>
        )}

        <nav className="space-y-2">
          <MenuLink
            icon={<History className="w-5 h-5" />}
            label="رحلاتي"
            href="/rider/rides"
            onClick={handleClose}
            isActive={isActiveLink("/rider/rides")}
          />
          <MenuLink
            icon={<CreditCard className="w-5 h-5" />}
            label="المحفظة الذكية"
            href="/rider/payments"
            onClick={handleClose}
            isActive={isActiveLink("/rider/payments")}
          />
          <MenuLink
            icon={<MapPin className="w-5 h-5" />}
            label="أماكني المحفوظة"
            href="/rider/saved-places"
            onClick={handleClose}
            isActive={isActiveLink("/rider/saved-places")}
          />

          {/* رابط الإحالات - مميز */}

          <MenuLink
            icon={<Settings className="w-5 h-5" />}
            label="الإعدادات"
            href="/rider/settings"
            onClick={handleClose}
            isActive={isActiveLink("/rider/settings")}
          />

          {/* خيارات الواجهة */}
          <div className="pt-3 border-t border-border space-y-2">
            <button
              onClick={toggleBottomNav}
              className="flex items-center gap-3 w-full p-3 rounded-md text-foreground hover:bg-accent transition-colors"
            >
              <span className="text-muted-foreground">
                {bottomNavEnabled ? (
                  <ToggleRight className="w-5 h-5 text-primary" />
                ) : (
                  <ToggleLeft className="w-5 h-5" />
                )}
              </span>
              <span className="flex-1 text-right">شريط التنقل السفلي</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  bottomNavEnabled
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {bottomNavEnabled ? "مفعّل" : "مخفي"}
              </span>
            </button>
          </div>

          {/* Map provider setting removed per design */}

          {/* قسم المعلومات */}
          <div className="pt-3 border-t border-border space-y-2">
            <MenuLink
              icon={<MessageSquare className="w-5 h-5" />}
              label="تواصل معنا"
              href="/contact"
              onClick={handleClose}
              isActive={isActiveLink("/contact")}
            />
            <MenuLink
              icon={<HelpCircle className="w-5 h-5" />}
              label="المساعدة والدعم"
              href="/help"
              onClick={handleClose}
              isActive={isActiveLink("/help")}
            />
            <MenuLink
              icon={<Info className="w-5 h-5" />}
              label="عن التطبيق"
              href="/about"
              onClick={handleClose}
              isActive={isActiveLink("/about")}
            />
          </div>

          {user && (
            <div className="pt-4 border-t border-border">
              <button
                onClick={async () => {
                  handleClose();
                  if (onLogout) {
                    onLogout();
                  } else {
                    await logout();
                    navigate("/auth");
                  }
                }}
                className="flex items-center gap-3 w-full p-3 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          )}
        </nav>
      </div>
    </div>
  );
};
export default RiderSideMenu;
