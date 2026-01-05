import { Link, useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { LogOut, History, Settings, CreditCard, MapPin, Car, Clock, XCircle, Loader2, Gift, Info, HelpCircle, Star, Navigation2, ToggleLeft, ToggleRight, MessageSquare } from "lucide-react";
import { useDriverStatus } from "@/hooks/useDriverStatus";
import { useRiderStore } from "@/stores/riderStore";
import { formatEmailToPhone } from "@/lib/validations";
interface RiderSideMenuProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}
const MenuLink = ({
  icon,
  label,
  href,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  onClick?: () => void;
}) => <Link to={href} onClick={onClick} className="flex items-center gap-3 p-3 rounded-xl text-foreground hover:bg-accent transition-colors">
    <span className="text-muted-foreground">{icon}</span>
    <span>{label}</span>
  </Link>;
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
  if (!isOpen) return null;
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
      return <button onClick={handleRegisterAsDriver} className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
          <Car className="w-5 h-5" />
          <span className="font-medium">سجّل كسائق</span>
        </button>;
    }
    if (driverStatus.isApproved && driverStatus.isActivated) {
      return <button onClick={handleSwitchToDriver} className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20">
          <Car className="w-5 h-5" />
          <span className="font-medium">التبديل لوضع السائق</span>
        </button>;
    }
    if (driverStatus.status === 'pending') {
      return <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
          <Clock className="w-5 h-5" />
          <span className="text-sm">طلب السائق قيد المراجعة</span>
        </div>;
    }
    if (driverStatus.status === 'rejected') {
      return <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
          <XCircle className="w-5 h-5" />
          <span className="text-sm">تم رفض طلب السائق</span>
        </div>;
    }
    if (!driverStatus.isActivated) {
      return <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
          <XCircle className="w-5 h-5" />
          <span className="text-sm">حساب السائق معطّل</span>
        </div>;
    }
    return null;
  };
  return <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div className="absolute top-0 right-0 h-full w-72 bg-card shadow-xl p-6 animate-slide-in-right" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
          
          <div>
            {user ? <>
                <p className="font-bold text-foreground">{user.user_metadata?.full_name || "مستخدم"}</p>
                <p className="text-sm text-muted-foreground" dir="ltr">
                  {formatEmailToPhone(user.email) || user.phone}
                </p>
              </> : <Link to="/rider/auth" className="text-primary font-medium">تسجيل الدخول</Link>}
          </div>
        </div>

        {/* Driver Mode Switch */}
        {user && <div className="mb-4">
            {driverStatus.loading ? <div className="flex items-center justify-center p-3">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div> : getDriverStatusLabel()}
          </div>}

        <nav className="space-y-2">
          <MenuLink icon={<History className="w-5 h-5" />} label="رحلاتي" href="/rider/rides" onClick={onClose} />
          <MenuLink icon={<CreditCard className="w-5 h-5" />} label="المحفظة الذكية" href="/rider/payments" onClick={onClose} />
          <MenuLink icon={<MapPin className="w-5 h-5" />} label="أماكني المحفوظة" href="/rider/saved-places" onClick={onClose} />

          {/* رابط الإحالات - مميز */}
          

          <MenuLink icon={<Settings className="w-5 h-5" />} label="الإعدادات" href="/rider/settings" onClick={onClose} />

          {/* خيارات الواجهة */}
          <div className="pt-3 border-t border-border space-y-2">
            <button onClick={toggleBottomNav} className="flex items-center gap-3 w-full p-3 rounded-xl text-foreground hover:bg-accent transition-colors">
              <span className="text-muted-foreground">
                {bottomNavEnabled ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5" />}
              </span>
              <span className="flex-1 text-right">شريط التنقل السفلي</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${bottomNavEnabled ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                {bottomNavEnabled ? 'مفعّل' : 'مخفي'}
              </span>
            </button>
          </div>

          {/* قسم المعلومات */}
          <div className="pt-3 border-t border-border space-y-2">
            <MenuLink icon={<MessageSquare className="w-5 h-5" />} label="تواصل معنا" href="/contact" onClick={onClose} />
            <MenuLink icon={<HelpCircle className="w-5 h-5" />} label="المساعدة والدعم" href="/help" onClick={onClose} />
            <MenuLink icon={<Info className="w-5 h-5" />} label="عن التطبيق" href="/about" onClick={onClose} />
          </div>

          {user && <div className="pt-4 border-t border-border">
              <button onClick={onLogout} className="flex items-center gap-3 w-full p-3 rounded-xl text-destructive hover:bg-destructive/10 transition-colors">
                <LogOut className="w-5 h-5" />
                <span>تسجيل الخروج</span>
              </button>
            </div>}
        </nav>
      </div>
    </div>;
};
export default RiderSideMenu;