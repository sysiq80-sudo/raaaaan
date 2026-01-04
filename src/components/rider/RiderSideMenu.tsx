import { Link, useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LogOut, History, Settings, CreditCard, MapPin, Car, Clock, 
  XCircle, Loader2, Gift, Info, HelpCircle, Star, ToggleLeft, 
  ToggleRight, MessageSquare, X, ChevronLeft, Wallet, User as UserIcon,
  Shield, Sparkles
} from "lucide-react";
import { useDriverStatus } from "@/hooks/useDriverStatus";
import { useRiderStore } from "@/stores/riderStore";
import { formatEmailToPhone } from "@/lib/validations";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface RiderSideMenuProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

interface MenuLinkProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  onClick?: () => void;
  badge?: string;
  highlight?: boolean;
}

const MenuLink = ({ icon, label, href, onClick, badge, highlight }: MenuLinkProps) => (
  <Link 
    to={href} 
    onClick={onClick} 
    className={`flex items-center gap-4 p-3.5 rounded-2xl transition-all duration-200 group ${
      highlight 
        ? 'bg-gradient-to-l from-primary/15 to-transparent text-primary hover:from-primary/25' 
        : 'text-foreground hover:bg-secondary/80'
    }`}
  >
    <span className={`${highlight ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'} transition-colors`}>
      {icon}
    </span>
    <span className="flex-1 font-medium">{label}</span>
    {badge && (
      <span className="px-2.5 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold">
        {badge}
      </span>
    )}
    <ChevronLeft className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
  </Link>
);

const RiderSideMenu = ({
  user,
  isOpen,
  onClose,
  onLogout
}: RiderSideMenuProps) => {
  const navigate = useNavigate();
  const driverStatus = useDriverStatus(user?.id || null);
  const bottomNavEnabled = useRiderStore(state => state.bottomNavEnabled);
  const toggleBottomNav = useRiderStore(state => state.toggleBottomNav);

  const handleSwitchToDriver = () => {
    onClose();
    navigate('/driver');
  };

  const handleRegisterAsDriver = () => {
    onClose();
    navigate('/driver/register');
  };

  const getDriverStatusLabel = () => {
    if (driverStatus.loading) return null;

    if (!driverStatus.isDriver) {
      return (
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleRegisterAsDriver} 
          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-l from-primary/20 to-secondary text-foreground hover:from-primary/30 transition-all border border-primary/20"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <Car className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 text-right">
            <span className="font-bold text-base block">سجّل كسائق</span>
            <span className="text-xs text-muted-foreground">وابدأ بتحقيق الأرباح</span>
          </div>
          <Sparkles className="w-5 h-5 text-primary" />
        </motion.button>
      );
    }

    if (driverStatus.isApproved && driverStatus.isActivated) {
      return (
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSwitchToDriver} 
          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-l from-primary to-primary-dark text-primary-foreground transition-all shadow-glow-sm hover:shadow-glow"
        >
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <Car className="w-6 h-6" />
          </div>
          <div className="flex-1 text-right">
            <span className="font-bold text-base block">التبديل لوضع السائق</span>
            <span className="text-xs opacity-80">انتقل لتطبيق السائق</span>
          </div>
          <ChevronLeft className="w-5 h-5" />
        </motion.button>
      );
    }

    if (driverStatus.status === 'pending') {
      return (
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-warning/10 text-warning border border-warning/20">
          <Clock className="w-6 h-6" />
          <div className="flex-1">
            <span className="font-medium block">طلب السائق قيد المراجعة</span>
            <span className="text-xs opacity-80">سيتم إعلامك عند الموافقة</span>
          </div>
        </div>
      );
    }

    if (driverStatus.status === 'rejected') {
      return (
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20">
          <XCircle className="w-6 h-6" />
          <span className="font-medium">تم رفض طلب السائق</span>
        </div>
      );
    }

    if (!driverStatus.isActivated) {
      return (
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20">
          <XCircle className="w-6 h-6" />
          <span className="font-medium">حساب السائق معطّل</span>
        </div>
      );
    }

    return null;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" 
            onClick={onClose}
          />

          {/* Menu Panel */}
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-[85%] max-w-sm bg-card shadow-2xl z-50 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header with gradient */}
            <div className="relative bg-gradient-to-b from-primary/10 to-transparent p-6 pb-8">
              {/* Close button */}
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="absolute top-4 left-4 w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors"
              >
                <X className="w-5 h-5" />
              </motion.button>

              {/* User Info */}
              <div className="flex items-center gap-4 mt-8">
                <Avatar className="w-16 h-16 border-2 border-primary/30">
                  <AvatarImage src={user?.user_metadata?.avatar_url} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xl font-bold">
                    {user?.user_metadata?.full_name?.[0] || user?.email?.[0] || 'م'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  {user ? (
                    <>
                      <p className="font-bold text-lg truncate">
                        {user.user_metadata?.full_name || "مستخدم"}
                      </p>
                      <p className="text-sm text-muted-foreground" dir="ltr">
                        {formatEmailToPhone(user.email) || user.phone}
                      </p>
                    </>
                  ) : (
                    <Link 
                      to="/rider/auth" 
                      className="text-primary font-bold text-lg hover:underline"
                    >
                      تسجيل الدخول
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: 'calc(100vh - 180px)' }}>
              {/* Driver Mode Switch */}
              {user && (
                <div className="mb-2">
                  {driverStatus.loading ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    getDriverStatusLabel()
                  )}
                </div>
              )}

              {/* Main Navigation */}
              <nav className="space-y-1">
                <MenuLink 
                  icon={<History className="w-5 h-5" />} 
                  label="رحلاتي" 
                  href="/rider/rides" 
                  onClick={onClose} 
                />
                <MenuLink 
                  icon={<Wallet className="w-5 h-5" />} 
                  label="المحفظة الذكية" 
                  href="/rider/payments" 
                  onClick={onClose}
                  badge="جديد"
                />
                <MenuLink 
                  icon={<MapPin className="w-5 h-5" />} 
                  label="أماكني المحفوظة" 
                  href="/rider/saved-places" 
                  onClick={onClose} 
                />
                <MenuLink 
                  icon={<Gift className="w-5 h-5" />} 
                  label="الإحالات والمكافآت" 
                  href="/rider/referrals" 
                  onClick={onClose}
                  highlight
                />
                <MenuLink 
                  icon={<Settings className="w-5 h-5" />} 
                  label="الإعدادات" 
                  href="/rider/settings" 
                  onClick={onClose} 
                />
              </nav>

              {/* UI Options */}
              <div className="pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-3 px-1">خيارات العرض</p>
                <button 
                  onClick={toggleBottomNav} 
                  className="flex items-center gap-4 w-full p-3.5 rounded-2xl text-foreground hover:bg-secondary/80 transition-colors"
                >
                  <span className="text-muted-foreground">
                    {bottomNavEnabled ? (
                      <ToggleRight className="w-5 h-5 text-primary" />
                    ) : (
                      <ToggleLeft className="w-5 h-5" />
                    )}
                  </span>
                  <span className="flex-1 text-right font-medium">شريط التنقل السفلي</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    bottomNavEnabled 
                      ? 'bg-primary/20 text-primary' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {bottomNavEnabled ? 'مفعّل' : 'مخفي'}
                  </span>
                </button>
              </div>

              {/* Support Section */}
              <div className="pt-4 border-t border-border/50 space-y-1">
                <p className="text-xs text-muted-foreground mb-3 px-1">الدعم والمساعدة</p>
                <MenuLink 
                  icon={<MessageSquare className="w-5 h-5" />} 
                  label="تواصل معنا" 
                  href="/contact" 
                  onClick={onClose} 
                />
                <MenuLink 
                  icon={<HelpCircle className="w-5 h-5" />} 
                  label="المساعدة والدعم" 
                  href="/help" 
                  onClick={onClose} 
                />
                <MenuLink 
                  icon={<Info className="w-5 h-5" />} 
                  label="عن التطبيق" 
                  href="/about" 
                  onClick={onClose} 
                />
              </div>

              {/* Logout */}
              {user && (
                <div className="pt-4 border-t border-border/50">
                  <motion.button 
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={onLogout} 
                    className="flex items-center gap-4 w-full p-3.5 rounded-2xl text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">تسجيل الخروج</span>
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default RiderSideMenu;
