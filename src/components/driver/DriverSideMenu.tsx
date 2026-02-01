import { Link, useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
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
  Users,
  DollarSign,
  TrendingUp,
  Calendar
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
  driverId?: string | null;
}

const DAILY_GOAL = 50000; // هدف يومي

interface Stats {
  todayEarnings: number;
  todayRides: number;
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
  rating,
  driverId
}: DriverSideMenuProps) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    todayEarnings: 0,
    todayRides: 0,
  });
  const [loading, setLoading] = useState(false);

  // Fetch today's stats
  useEffect(() => {
    if (!driverId) return;

    const fetchStats = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const todayStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);

        const { data, error } = await supabase
          .from("rides")
          .select("final_fare")
          .eq("driver_id", driverId)
          .eq("status", "completed")
          .gte("completed_at", todayStart.toISOString())
          .lt("completed_at", todayEnd.toISOString());

        if (error) throw error;

        const earnings = data?.reduce((sum, ride) => sum + (ride.final_fare || 0), 0) || 0;
        const rides = data?.length || 0;

        setStats({
          todayEarnings: earnings,
          todayRides: rides,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [driverId]);

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

        {/* Today's Earnings Section */}
        {driverId && (
          <div className="mb-6 p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-green-600 dark:text-green-400" />
              <h3 className="text-sm font-bold text-foreground">أرباح اليوم</h3>
            </div>
            
            {/* Earnings Amount */}
            <div className="mb-3">
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {stats.todayEarnings.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.todayRides} رحلات مكتملة
              </p>
            </div>

            {/* Daily Goal Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">الهدف اليومي</span>
                <span className="font-semibold text-foreground">
                  {Math.round((stats.todayEarnings / DAILY_GOAL) * 100)}%
                </span>
              </div>
              <Progress 
                value={Math.min((stats.todayEarnings / DAILY_GOAL) * 100, 100)} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">
                {DAILY_GOAL - stats.todayEarnings > 0 
                  ? `متبقي: ${(DAILY_GOAL - stats.todayEarnings).toLocaleString()} د.ع`
                  : "✅ تم تحقيق الهدف!"
                }
              </p>
            </div>
          </div>
        )}

        <nav className="space-y-2">
          <MenuLink icon={<UserCircle className="w-5 h-5" />} label="الملف الشخصي" href="/driver/profile" onClick={onClose} />
          {driverStatus !== 'approved' && (
            <MenuLink icon={<FileSearch className="w-5 h-5" />} label="حالة الطلب" href="/driver/application-status" onClick={onClose} />
          )}
          <MenuLink icon={<History className="w-5 h-5" />} label="سجل الرحلات" href="/driver/rides" onClick={onClose} />
          <MenuLink icon={<Wallet className="w-5 h-5" />} label="الأرباح" href="/driver/payments" onClick={onClose} />
          <MenuLink icon={<Gift className="w-5 h-5" />} label="المكافآت والحوافز" href="/driver/incentives" onClick={onClose} />
          <MenuLink icon={<BarChart3 className="w-5 h-5" />} label="الإحصائيات" href="/driver/statistics" onClick={onClose} />
          <MenuLink icon={<Settings className="w-5 h-5" />} label="الإعدادات" href="/driver/settings" onClick={onClose} />
          <MenuLink icon={<Phone className="w-5 h-5" />} label="الدعم الفني" href="/driver/support" onClick={onClose} />
          
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
