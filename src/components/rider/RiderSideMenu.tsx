import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, LogOut, History, Settings, CreditCard, MapPin,
  HelpCircle, Info, LogIn, Gift, Wallet, PlusCircle, BadgeCheck,
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

const MenuListItem = ({
  icon, label, description, href, iconBg, onClick,
}: {
  icon: React.ReactNode; label: string; description: string;
  href: string; iconBg: string; onClick?: () => void;
}) => (
  <Link
    to={href}
    onClick={onClick}
    dir="rtl"
    className="group flex flex-col items-center gap-2.5 rounded-2xl border border-[#2e3a55] bg-[#151f33]/80 p-4 transition-all duration-200 hover:border-[#5bdda6]/30 hover:bg-[#1a253a]/90"
  >
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 ${iconBg} text-[#5bdda6] transition-transform duration-200 group-hover:scale-105`}>
      {icon}
    </span>
    <div className="text-center min-w-0 w-full">
      <p className="text-[14px] font-bold text-[#e6edff] truncate">{label}</p>
      <p className="mt-0.5 text-[11px] text-[#a8b4d3] truncate">{description}</p>
    </div>
  </Link>
);

/* ─── حركة الدرج — مطابقة لتطبيقات iOS النيتيف ─── */
const DRAWER_VARIANTS = {
  hidden:  { x: "100%" },
  visible: { x: "0%" },
  exit:    { x: "100%" },
};
const OPEN_TRANSITION  = { type: "tween", duration: 0.35, ease: [0.32, 0.72, 0, 1] } as const;
const BACKDROP_VARIANTS = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1 },
  exit:    { opacity: 0 },
};
const BACKDROP_TRANSITION = { type: "tween", duration: 0.25, ease: "easeInOut" } as const;

const RiderSideMenu = ({
  isOpen, onClose, open, onOpenChange, onLogout,
}: RiderSideMenuProps) => {
  const navigate = useNavigate();
  const { user: authUser, logout } = useAuth();
  const user = authUser;
  const isMenuOpen = isOpen !== undefined ? isOpen : open || false;

  const handleClose = () => {
    if (onClose) onClose();
    if (onOpenChange) onOpenChange(false);
  };

  const menuItems = [
    { icon: <History className="h-5 w-5" />, label: "سجل الرحلات", description: "عرض جميع رحلاتك السابقة", href: "/rider/rides", iconBg: "bg-[#23314c]" },
    { icon: <CreditCard className="h-5 w-5" />, label: "طرق الدفع", description: "إدارة البطاقات والمحفظة", href: "/rider/payments", iconBg: "bg-[#22394a]" },
    { icon: <MapPin className="h-5 w-5" />, label: "الأماكن المحفوظة", description: "المنزل، العمل، والمواقع المفضلة", href: "/rider/saved-places", iconBg: "bg-[#3a2a45]" },
    { icon: <HelpCircle className="h-5 w-5" />, label: "مركز المساعدة", description: "الدعم الفني والأسئلة الشائعة", href: "/help", iconBg: "bg-[#3b3423]" },
    { icon: <Settings className="h-5 w-5" />, label: "الإعدادات", description: "الخصوصية والتنبيهات واللغة", href: "/rider/settings", iconBg: "bg-[#2a3442]" },
    { icon: <Gift className="h-5 w-5" />, label: "ادعُ واربح", description: "شارك التطبيق واحصل على مكافآت", href: "/rider/settings", iconBg: "bg-[#3a2742]" },
    { icon: <Info className="h-5 w-5" />, label: "عن التطبيق", description: "تعرف أكثر على منصة ران", href: "/about", iconBg: "bg-[#2d3046]" },
  ];

  const displayName =
    (user as { user_metadata?: { full_name?: string } })?.user_metadata?.full_name || "مستخدم ران";

  return (
    <AnimatePresence>
      {isMenuOpen && (
        <>
          <motion.div
            key="rider-menu-backdrop"
            className="fixed inset-0 z-[59] bg-black/60 backdrop-blur-[2px]"
            variants={BACKDROP_VARIANTS}
            initial="hidden" animate="visible" exit="exit"
            transition={BACKDROP_TRANSITION}
            onClick={handleClose}
            aria-hidden="true"
          />
          <motion.div
            key="rider-menu-drawer"
            variants={DRAWER_VARIANTS}
            initial="hidden" animate="visible" exit="exit"
            transition={OPEN_TRANSITION}
            style={{ willChange: "transform" }}
            className="fixed inset-0 z-[60] overflow-hidden bg-[#0b1326]"
            dir="rtl"
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#5bdda6]/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-[#27b481]/10 blur-3xl" />
            <div 
              className="absolute top-0 left-0 z-30 pb-4 px-4"
              style={{ paddingTop: "max(16px, calc(env(safe-area-inset-top, 0px) + 16px))" }}
            >
              <button
                onClick={handleClose}
                aria-label="إغلاق القائمة"
                className="w-11 h-11 rounded-2xl bg-[#5bdda6] flex items-center justify-center shadow-[0_0_20px_rgba(91,221,166,0.45)] hover:bg-[#4ecf99] active:bg-[#3dbe88] transition-all duration-200 text-[#0b1326]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative h-full overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(3.25rem,calc(env(safe-area-inset-top)+2.5rem))]">
              <div className="mx-auto w-full max-w-2xl">
                {user ? (
                  <>
                    <section className="mb-7 text-center">
                      <div className="relative mx-auto mb-4 h-24 w-24 rounded-full bg-gradient-to-br from-[#5bdda6] to-[#27b481] p-[3px] shadow-[0_10px_40px_rgba(91,221,166,0.25)]">
                        <div className="flex h-full w-full items-center justify-center rounded-full bg-[#0f192b]">
                          <img src={logo} alt="RAAN" className="h-11 w-11 opacity-90" />
                        </div>
                        <span className="absolute bottom-0 left-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0b1326] bg-[#5bdda6] text-[#083d2b]">
                          <BadgeCheck className="h-4 w-4" />
                        </span>
                      </div>
                      <h2 className="text-2xl font-extrabold text-[#e6edff]">{displayName}</h2>
                      <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full border border-[#5bdda6]/30 bg-[#1a2a3e] px-3 py-1">
                        <span className="text-xs font-bold uppercase tracking-widest text-[#7ef8c3]">عضوية النخبة</span>
                      </div>
                    </section>
                    <section className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#5bdda6] to-[#27b481] p-5 text-[#083d2b] shadow-[0_22px_45px_-18px_rgba(91,221,166,0.45)]">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold text-[#0b5037]/80">الرصيد الحالي</p>
                          <p className="mt-1 text-2xl font-extrabold">0.00 د.ع</p>
                        </div>
                        <Link to="/rider/wallet-topup" onClick={handleClose} className="flex items-center gap-1.5 rounded-xl bg-[#0f3f2d]/85 px-4 py-2 text-sm font-bold text-[#d9ffe8] transition-transform active:scale-95">
                          <PlusCircle className="h-4 w-4" />
                          <span>شحن الرصيد</span>
                        </Link>
                      </div>
                    </section>
                    <section className="grid grid-cols-2 gap-3">
                      {menuItems.map((item) => (
                        <MenuListItem key={item.href + item.label} icon={item.icon} label={item.label} description={item.description} href={item.href} iconBg={item.iconBg} onClick={handleClose} />
                      ))}
                    </section>
                    <button
                      onClick={async () => { handleClose(); if (onLogout) { onLogout(); } else { await logout(); navigate("/auth"); } }}
                      className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 py-4 text-base font-bold text-red-300 transition-colors hover:bg-red-500/15"
                    >
                      <LogOut className="h-5 w-5" />
                      <span>تسجيل الخروج</span>
                    </button>
                  </>
                ) : (
                  <section className="mx-auto mt-12 max-w-sm rounded-3xl border border-[#2e3a55] bg-[#141e32]/90 p-6 text-center shadow-lg">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1f2e48] text-[#5bdda6]">
                      <Wallet className="h-8 w-8" />
                    </div>
                    <h2 className="text-xl font-bold text-[#e6edff]">أهلاً بك في ران</h2>
                    <p className="mt-2 text-sm text-[#a8b4d3]">سجّل الدخول للوصول إلى المحفظة، سجل الرحلات، والإعدادات.</p>
                    <Link to="/auth" onClick={handleClose} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#5bdda6]/15 px-5 py-2.5 text-sm font-bold text-[#7ef8c3]">
                      <LogIn className="h-4 w-4" />
                      <span>تسجيل الدخول</span>
                    </Link>
                  </section>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default RiderSideMenu;
