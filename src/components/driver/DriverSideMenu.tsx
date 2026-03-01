import { Link, useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import GamifiedEarnings from "@/components/driver/GamifiedEarnings";
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
  Calendar,
  BookOpen
} from "lucide-react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";

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

const DAILY_GOAL_DEFAULT = 50000; // هدف يومي افتراضي
const DAILY_GOAL_MIN = 25000; // الحد الأدنى للهدف
const DAILY_GOAL_MAX = 200000; // الحد الأقصى للهدف

interface Stats {
  todayEarnings: number;
  todayRides: number;
  dynamicGoal: number;
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
  const { switchToRider } = useAuth();
  const [stats, setStats] = useState<Stats>({
    todayEarnings: 0,
    todayRides: 0,
    dynamicGoal: DAILY_GOAL_DEFAULT,
  });
  const [loading, setLoading] = useState(false);

  // Fetch today's stats AND calculate dynamic goal from last 7 days
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

        // جلب أرباح اليوم
        const { data: todayData, error: todayError } = await supabase
          .from("rides")
          .select("final_fare")
          .eq("driver_id", driverId)
          .eq("status", "completed")
          .gte("completed_at", todayStart.toISOString())
          .lt("completed_at", todayEnd.toISOString());

        if (todayError) throw todayError;

        const earnings = todayData?.reduce((sum, ride) => sum + (ride.final_fare || 0), 0) || 0;
        const rides = todayData?.length || 0;

        // حساب الهدف الديناميكي من آخر 7 أيام
        const weekAgo = new Date(todayStart);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const { data: weekData, error: weekError } = await supabase
          .from("rides")
          .select("final_fare, completed_at")
          .eq("driver_id", driverId)
          .eq("status", "completed")
          .gte("completed_at", weekAgo.toISOString())
          .lt("completed_at", todayStart.toISOString());

        let dynamicGoal = DAILY_GOAL_DEFAULT;
        
        if (!weekError && weekData && weekData.length > 0) {
          // حساب المعدل اليومي من الأيام التي عمل فيها فعلاً
          const dailyEarningsMap = new Map<string, number>();
          weekData.forEach(ride => {
            if (ride.completed_at) {
              const day = new Date(ride.completed_at).toDateString();
              dailyEarningsMap.set(day, (dailyEarningsMap.get(day) || 0) + (ride.final_fare || 0));
            }
          });

          const activeDays = dailyEarningsMap.size;
          if (activeDays > 0) {
            const totalWeekEarnings = Array.from(dailyEarningsMap.values()).reduce((a, b) => a + b, 0);
            const avgDaily = totalWeekEarnings / activeDays;
            // الهدف = 10% أعلى من المعدل، مقرب لأقرب 5000
            const rawGoal = avgDaily * 1.1;
            dynamicGoal = Math.ceil(rawGoal / 5000) * 5000;
            // تقييد بالحدود الدنيا والعليا
            dynamicGoal = Math.max(DAILY_GOAL_MIN, Math.min(DAILY_GOAL_MAX, dynamicGoal));
          }
        }

        setStats({
          todayEarnings: earnings,
          todayRides: rides,
          dynamicGoal,
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

  const handleSwitchToRider = () => {
    try {
      switchToRider();
      navigate('/rider');
    } catch (err) {
      console.error('switchToRider failed', err);
      navigate('/rider');
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="absolute top-0 right-0 h-full w-72 bg-card shadow-xl p-6 animate-slide-in-right overflow-y-auto pb-24"
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

        {/* Today's Earnings Section - Gamified */}
        {driverId && (
          <div className="mb-6 p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl">
            <GamifiedEarnings
              todayEarnings={stats.todayEarnings}
              todayRides={stats.todayRides}
              dailyGoal={stats.dynamicGoal}
            />
          </div>
        )}

        <nav className="space-y-2">
          <MenuLink icon={<BookOpen className="w-5 h-5 text-amber-500" />} label="خاص لعائلة ران" href="/driver/guide" onClick={onClose} />
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
