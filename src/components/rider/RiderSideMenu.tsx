/**
 * RiderSideMenu — قائمة الراكب بتصميم ملء الشاشة | بدون سكرول
 */
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { formatEmailToPhone } from "@/lib/validations";
import {
  X,
  LogOut,
  History,
  Settings,
  CreditCard,
  MapPin,
  HelpCircle,
  Info,
  LogIn,
} from "lucide-react";
import logo from "@/assets/logo.png";

interface RiderSideMenuProps {
  user?: unknown;
  isOpen?: boolean;
  onClose?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onLogout?: () => void;
}

// ── بطاقة زر القائمة ──────────────────────────────────────────
const MenuCard = ({
  icon,
  label,
  href,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  color: string;
  onClick?: () => void;
}) => (
  <Link
    to={href}
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 ${color} active:scale-95 transition-all duration-200 shadow-sm`}
  >
    <span className="[&>svg]:w-9 [&>svg]:h-9">{icon}</span>
    <span className="text-sm font-bold text-center leading-tight px-1">{label}</span>
  </Link>
);

// ── المكوّن الرئيسي ────────────────────────────────────────────
const RiderSideMenu = ({
  isOpen,
  onClose,
  open,
  onOpenChange,
  onLogout,
}: RiderSideMenuProps) => {
  const navigate = useNavigate();
  const { user: authUser, logout } = useAuth();
  const user = authUser;

  const isMenuOpen = isOpen !== undefined ? isOpen : open || false;

  const handleClose = () => {
    if (onClose) onClose();
    if (onOpenChange) onOpenChange(false);
  };

  if (!isMenuOpen) return null;

  const menuItems = [
    { icon: <History className="text-blue-400" />,     label: "رحلاتي",           href: "/rider/rides",        color: "bg-blue-500/10" },
    { icon: <CreditCard className="text-emerald-400" />, label: "المحفظة",        href: "/rider/payments",     color: "bg-emerald-500/10" },
    { icon: <MapPin className="text-rose-400" />,      label: "أماكني المحفوظة",  href: "/rider/saved-places", color: "bg-rose-500/10" },
    { icon: <Settings className="text-slate-400" />,   label: "الإعدادات",        href: "/rider/settings",     color: "bg-slate-500/10" },
    { icon: <HelpCircle className="text-amber-400" />, label: "المساعدة",         href: "/help",               color: "bg-amber-500/10" },
    { icon: <Info className="text-purple-400" />,      label: "عن التطبيق",       href: "/about",              color: "bg-purple-500/10" },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] bg-card flex flex-col overflow-hidden"
      dir="rtl"
    >
      {/* ── هيدر: شعار + اسم في سطر واحد بالوسط ── */}
      <div className="flex-shrink-0 relative flex flex-col items-center pt-[max(2.5rem,calc(env(safe-area-inset-top)+2rem))] pb-4 border-b border-border bg-card">

        {/* زر إغلاق — أقصى اليسار */}
        <button
          onClick={handleClose}
          aria-label="إغلاق القائمة"
          className="absolute top-3 left-3 w-9 h-9 rounded-full bg-secondary flex items-center justify-center active:scale-90 transition-all z-10"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* شعار ران + الاسم والرقم — سطر واحد بالوسط */}
        {user ? (
          <div className="flex items-center gap-3">
            <img src={logo} alt="RAAN" className="w-10 h-10 rounded-xl opacity-90 flex-shrink-0" />
            <div className="text-right">
              <p className="font-bold text-foreground text-base leading-tight">
                {user.user_metadata?.full_name || "مستخدم ران"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">
                {formatEmailToPhone(user.email) || user.phone || ""}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <img src={logo} alt="RAAN" className="w-10 h-10 rounded-xl opacity-90 flex-shrink-0" />
            <Link
              to="/auth"
              onClick={handleClose}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20"
            >
              <LogIn className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-primary font-semibold text-sm">تسجيل الدخول</span>
            </Link>
          </div>
        )}
      </div>


      {/* ── شبكة الكاردات — بدون سكرول، ملء المساحة المتاحة ── */}
      <div className="flex-1 flex flex-col px-3 py-3 gap-3 min-h-0">
        {/* 6 كاردات 3×2 */}
        <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-3 min-h-0">
          {menuItems.map((item) => (
            <MenuCard
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              color={item.color}
              onClick={handleClose}
            />
          ))}
        </div>
      </div>

      {/* ── زر تسجيل الخروج فقط ── */}
      <div className="flex-shrink-0 border-t border-border">
        {user && (
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
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-none text-white bg-destructive hover:bg-destructive/90 active:bg-destructive/80 transition-colors font-semibold text-base pb-[max(0.875rem,env(safe-area-inset-bottom))]"
          >
            <LogOut className="w-5 h-5" />
            <span>تسجيل الخروج</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default RiderSideMenu;
