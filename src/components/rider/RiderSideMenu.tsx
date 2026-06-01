import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  X, LogOut, History, Settings, CreditCard, MapPin,
  HelpCircle, LogIn, Wallet, PlusCircle,
} from "lucide-react";

interface RiderSideMenuProps {
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
    className="group flex items-center gap-3.5 rounded-2xl border border-border/20 bg-card/40 p-3.5 transition-all duration-200 hover:border-ring/30 hover:bg-secondary/60 active:scale-[0.98] shadow-sm no-underline"
  >
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/10 ${iconBg} transition-transform duration-200 group-hover:scale-105`}>
      {icon}
    </span>
    <div className="text-right min-w-0 flex-1">
      <p className="text-[13px] font-bold text-foreground truncate">{label}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{description}</p>
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
  const [balance, setBalance] = useState<number>(0);
  const [profileName, setProfileName] = useState<string>("");

  useEffect(() => {
    if (!user || !isMenuOpen) return;
    const fetchProfileData = async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("wallet_balance, full_name")
          .eq("user_id", user.id)
          .single();
        if (profile) {
          setBalance(profile.wallet_balance || 0);
          if (profile.full_name) setProfileName(profile.full_name);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      }
    };
    fetchProfileData();
  }, [user, isMenuOpen]);

  const handleClose = () => {
    if (onClose) onClose();
    if (onOpenChange) onOpenChange(false);
  };

  const menuItems = [
    { icon: <History className="h-5 w-5" />, label: "سجل الرحلات", description: "عرض جميع رحلاتك السابقة", href: "/rider/rides", iconBg: "bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20" },
    { icon: <CreditCard className="h-5 w-5" />, label: "طرق الدفع", description: "إدارة البطاقات والمحفظة", href: "/rider/payments", iconBg: "bg-cyan-500/10 text-cyan-500 dark:bg-cyan-500/20" },
    { icon: <MapPin className="h-5 w-5" />, label: "الأماكن المحفوظة", description: "المنزل، العمل، والمواقع المفضلة", href: "/rider/saved-places", iconBg: "bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20" },
    { icon: <HelpCircle className="h-5 w-5" />, label: "مركز المساعدة", description: "الدعم الفني والأسئلة الشائعة", href: "/help", iconBg: "bg-amber-500/10 text-amber-500 dark:bg-amber-500/20" },
    { icon: <Settings className="h-5 w-5" />, label: "الإعدادات", description: "الخصوصية والتنبيهات واللغة", href: "/rider/settings", iconBg: "bg-slate-500/10 text-slate-500 dark:bg-slate-500/20" },
    // 🚧 TODO: ميزة مستقبلية - ادعُ واربح (Invite & Earn) - سيتم تفعيلها لاحقاً
    // { icon: <Gift className="h-5 w-5" />, label: "ادعُ واربح", description: "شارك التطبيق واحصل على مكافآت", href: "/rider/referral", iconBg: "bg-rose-500/10 text-rose-500 dark:bg-rose-500/20" },
    // 🚧 TODO: ميزة مستقبلية - عن التطبيق (About) - سيتم تفعيلها لاحقاً
    // { icon: <Info className="h-5 w-5" />, label: "عن التطبيق", description: "تعرف أكثر على منصة ران", href: "/about", iconBg: "bg-blue-500/10 text-blue-500 dark:bg-blue-500/20" },
  ];

  const displayName =
    profileName
    || (user as { user_metadata?: { full_name?: string } })?.user_metadata?.full_name
    || "مستخدم ران";

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
            className="fixed inset-0 z-[60] overflow-hidden bg-background h-[100dvh]"
            dir="rtl"
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-ring/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl" />
            <div 
              className="absolute top-0 left-0 z-30 pb-4 px-4"
              style={{ paddingTop: "max(16px, calc(env(safe-area-inset-top, 0px) + 16px))" }}
            >
              <button
                onClick={handleClose}
                aria-label="إغلاق القائمة"
                className="w-10 h-10 rounded-xl bg-[#5bdda6] flex items-center justify-center shadow-[0_0_20px_rgba(91,221,166,0.45)] hover:bg-[#4ecf99] active:bg-[#3dbe88] active:scale-95 transition-all duration-200 text-[#0b1326]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative h-full overflow-y-auto custom-scrollbar px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(3.25rem,calc(env(safe-area-inset-top)+2.5rem))]">
              <div className="mx-auto w-full max-w-2xl">
                {user ? (
                  <>
                    <section className="mb-7 text-center">
                      <h2 className="text-2xl font-extrabold text-foreground">{displayName}</h2>
                    </section>
                    <section className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#064e3b] via-[#0a3d2f] to-[#0f2922] p-5 text-white shadow-md shadow-emerald-900/30 border border-emerald-500/15">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold text-white/70">الرصيد الحالي</p>
                          <p className="mt-1 text-2xl font-extrabold">{balance.toLocaleString('en-US')} د.ع</p>
                        </div>
                        <Link to="/rider/wallet-topup" onClick={handleClose} className="flex items-center gap-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 px-4 py-2.5 text-sm font-bold text-[#0b1326] shadow-lg shadow-emerald-400/40 hover:shadow-emerald-300/50 transition-all duration-200 active:scale-95">
                          <PlusCircle className="h-4 w-4" />
                          <span>شحن الرصيد</span>
                        </Link>
                      </div>
                    </section>
                    <section className="flex flex-col gap-2.5">
                      {menuItems.map((item) => (
                        <MenuListItem key={item.href + item.label} icon={item.icon} label={item.label} description={item.description} href={item.href} iconBg={item.iconBg} onClick={handleClose} />
                      ))}
                    </section>
                    <button
                      onClick={async () => { handleClose(); if (onLogout) { onLogout(); } else { await logout(); navigate("/auth"); } }}
                      className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:bg-red-400 active:bg-red-600 py-4 text-base font-bold text-white transition-all duration-200 active:scale-[0.98]"
                    >
                      <LogOut className="h-5 w-5" />
                      <span>تسجيل الخروج</span>
                    </button>
                  </>
                ) : (
                  <section className="mx-auto mt-12 max-w-sm rounded-3xl border border-border/30 bg-card/90 p-6 text-center shadow-lg">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-ring">
                      <Wallet className="h-8 w-8" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground">أهلاً بك في ران</h2>
                    <p className="mt-2 text-sm text-muted-foreground">سجّل الدخول للوصول إلى المحفظة، سجل الرحلات، والإعدادات.</p>
                    <Link to="/auth" onClick={handleClose} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-ring/10 hover:bg-ring/15 px-5 py-2.5 text-sm font-bold text-ring">
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
