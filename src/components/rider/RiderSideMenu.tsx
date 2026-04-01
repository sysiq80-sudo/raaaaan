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
    className={`flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-700/40 ${color} hover:border-[#5bdda6]/30 active:scale-95 transition-all duration-200 shadow-sm`}
  >
    <span className="[&>svg]:w-8 [&>svg]:h-8">{icon}</span>
    <span className="text-[13px] font-bold text-center leading-tight px-1 text-white">{label}</span>
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
      className="fixed inset-0 z-[60] bg-[#0b1326] flex flex-col overflow-hidden"
      dir="rtl"
    >
      {/* هيدر */}
      <div className="flex-shrink-0 relative flex flex-col items-center pt-[max(2.5rem,calc(env(safe-area-inset-top)+2rem))] pb-5 border-b border-[#5bdda6]/10 bg-[#0b1326]">
        {/* زر إغلاق */}
        <button
          onClick={handleClose}
          aria-label="إغلاق القائمة"
          className="absolute top-3 left-3 w-9 h-9 rounded-xl bg-[#5bdda6]/10 border border-[#5bdda6]/20 flex items-center justify-center active:scale-90 transition-all z-10"
        >
          <X className="w-5 h-5 text-[#5bdda6]" />
        </button>

        {/* شعار + معلومات المستخدم */}
        {user ? (
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src={logo} alt="RAAN" className="w-12 h-12 rounded-2xl shadow-[0_0_16px_rgba(91,221,166,0.3)] flex-shrink-0" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#5bdda6] border-2 border-[#0b1326]" />
            </div>
            <div className="text-right">
              <p className="font-bold text-white text-base leading-tight">
                {(user as {user_metadata?: {full_name?: string}}).user_metadata?.full_name || "مستخدم ران"}
              </p>
              <p className="text-xs text-[#5bdda6]/60 mt-0.5" dir="ltr">
                {formatEmailToPhone((user as {email?: string}).email) || (user as {phone?: string}).phone || ""}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <img src={logo} alt="RAAN" className="w-12 h-12 rounded-2xl shadow-[0_0_16px_rgba(91,221,166,0.3)] flex-shrink-0" />
            <Link
              to="/auth"
              onClick={handleClose}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5bdda6]/10 border border-[#5bdda6]/20 hover:bg-[#5bdda6]/20 transition-colors"
            >
              <LogIn className="w-4 h-4 text-[#5bdda6] flex-shrink-0" />
              <span className="text-[#5bdda6] font-semibold text-sm">تسجيل الدخول</span>
            </Link>
          </div>
        )}
      </div>


      {/* شبكة الكاردات */}
      <div className="flex-1 flex flex-col px-3 py-4 gap-3 min-h-0 bg-[#0b1326]">
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

      {/* زر تسجيل الخروج */}
      <div className="flex-shrink-0 border-t border-[#5bdda6]/10 bg-[#0b1326]">
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
            className="flex items-center justify-center gap-2 w-full py-4 text-red-400 bg-red-500/10 hover:bg-red-500/15 active:bg-red-500/20 transition-colors font-semibold text-base border-none pb-[max(1rem,env(safe-area-inset-bottom))]"
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
