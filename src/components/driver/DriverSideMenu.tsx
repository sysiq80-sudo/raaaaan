import { Link, useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { 
  X, 
  LogOut, 
  History, 
  Settings, 
  Wallet,
  Gift,
  BarChart3,
  UserCircle,
  FileSearch,
  Phone,
  Star,
  Car,
  Users
} from "lucide-react";
import logo from "@/assets/logo.png";

interface DriverSideMenuProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  driverName: string | null;
  driverPhone: string | null;
  driverProfileImage: string | null;
  driverStatus: string | null;
  vehicleType: string | null;
  rating: number;
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
}) => (
  <Link 
    to={href}
    onClick={onClick}
    className="flex items-center gap-3 p-3 rounded-xl text-foreground hover:bg-accent transition-colors"
  >
    <span className="text-muted-foreground w-5 h-5">{icon}</span>
    <span>{label}</span>
  </Link>
);

const DriverSideMenu = ({ 
  user, 
  isOpen, 
  onClose, 
  onLogout,
  driverName,
  driverPhone,
  driverProfileImage,
  driverStatus,
  vehicleType,
  rating
}: DriverSideMenuProps) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const getVehicleTypeName = (type: string | null) => {
    const types: Record<string, string> = {
      economy: 'اقتصادي',
      comfort: 'مريح',
      premium: 'فاخر',
      women_only: 'نسائي'
    };
    return types[type || ''] || 'اقتصادي';
  };

  const getStatusBadge = () => {
    switch (driverStatus) {
      case 'approved':
        return { label: 'معتمد', color: 'bg-green-500' };
      case 'pending':
        return { label: 'قيد المراجعة', color: 'bg-amber-500' };
      case 'rejected':
        return { label: 'مرفوض', color: 'bg-destructive' };
      case 'suspended':
        return { label: 'موقوف', color: 'bg-destructive' };
      default:
        return { label: 'غير معروف', color: 'bg-muted' };
    }
  };

  const handleSwitchToRider = async () => {
    onClose();
    navigate('/rider');
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="absolute top-0 right-0 h-full w-72 bg-card shadow-xl p-6 animate-slide-in-right overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Profile Header */}
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
          <img 
            src={driverProfileImage || logo} 
            alt={driverProfileImage ? "صورة السائق" : "شعار ران"} 
            className="w-14 h-14 rounded-xl flex-shrink-0 object-cover" 
            loading="lazy"
            onError={(e) => { e.currentTarget.src = logo; }}
          />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-card-foreground text-lg truncate min-h-[24px]">
              {driverName?.trim() ||
                user?.user_metadata?.full_name?.trim() ||
                driverPhone ||
                user?.email?.split("@")[0] ||
                "كابتن"}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Star className="w-5 h-5 text-warning fill-warning flex-shrink-0" />
              <span className="text-base font-medium text-card-foreground">{rating.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Driver Status Badge */}
        <div className="mb-6 p-3 bg-secondary/50 rounded-xl">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${statusBadge.color}`} />
            <span className="text-sm font-medium">{statusBadge.label}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {getVehicleTypeName(vehicleType)}
          </p>
        </div>

        {/* Switch to Rider Mode Button */}
        <button
          onClick={handleSwitchToRider}
          className="w-full flex items-center gap-3 p-3 mb-4 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
        >
          <Users className="w-5 h-5" />
          <span className="font-medium">التبديل لوضع الراكب</span>
        </button>

        <nav className="space-y-2">
          <MenuLink icon={<UserCircle className="w-5 h-5" />} label="الملف الشخصي" href="/driver/profile" onClick={onClose} />
          {driverStatus !== 'approved' && (
            <MenuLink icon={<FileSearch className="w-5 h-5" />} label="حالة الطلب" href="/driver/application-status" onClick={onClose} />
          )}
          <MenuLink icon={<History className="w-5 h-5" />} label="رحلاتي" href="/driver/rides" onClick={onClose} />
          <MenuLink icon={<Wallet className="w-5 h-5" />} label="المالية" href="/driver/finance" onClick={onClose} />
          <MenuLink icon={<Gift className="w-5 h-5" />} label="المكافآت والحوافز" href="/driver/incentives" onClick={onClose} />
          <MenuLink icon={<BarChart3 className="w-5 h-5" />} label="الإحصائيات المتقدمة" href="/driver/statistics" onClick={onClose} />
          <MenuLink icon={<Settings className="w-5 h-5" />} label="الإعدادات" href="/driver/settings" onClick={onClose} />
          <MenuLink icon={<Phone className="w-5 h-5" />} label="الدعم الفني" href="/driver/settings" onClick={onClose} />
          
          <div className="pt-4 border-t border-border">
            <button 
              onClick={onLogout}
              className="flex items-center gap-3 w-full p-3 rounded-xl text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
};

export default DriverSideMenu;
