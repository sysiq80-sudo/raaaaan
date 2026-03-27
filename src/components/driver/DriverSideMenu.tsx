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
    <div className="fixed inset-0 z-[60] bg-card flex flex-col" dir="rtl">

      {/* ── هيدر: معلومات السائق في الوسط ── */}
      <div className="flex-shrink-0 relative flex flex-col items-center pt-12 pb-4 border-b border-border">
        {/* زر الإغلاق — أعلى اليسار */}
        <button
          onClick={onClose}
          className="absolute top-3 left-3 w-9 h-9 rounded-full bg-secondary flex items-center justify-center active:scale-90 transition-all"
          aria-label="إغلاق القائمة"
        >
          <X className="w-4 h-4 text-foreground" />
        </button>

        {/* الصورة */}
        <img
          src={driverProfileImage || logo}
          alt="السائق"
          className="w-16 h-16 rounded-full object-cover border-2 border-border mb-2"
          onError={(e) => { e.currentTarget.src = logo; }}
        />

        {/* الاسم */}
        <p className="font-bold text-foreground text-base text-center">
          {driverName?.trim() || user?.user_metadata?.full_name?.trim() || driverPhone || "كابتن"}
        </p>

        {/* ── 5 نجوم + الرقم الحقيقي ── */}
        <div className="flex flex-col items-center gap-1 mt-1.5">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-4 h-4 ${
                  star <= Math.round(rating)
                    ? "text-warning fill-warning"
                    : "text-muted-foreground/30 fill-muted-foreground/10"
                }`}
              />
            ))}
          </div>
          <span className="text-base font-bold text-foreground">{rating.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">/ 5</span></span>
        </div>

        {/* الحالة + نوع السيارة */}
        <div className="flex items-center justify-center gap-2 mt-1.5">
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium text-white ${statusBadge.color}`}>{statusBadge.label}</span>
          <span className="text-border">·</span>
          <span className="text-[11px] text-muted-foreground">{getVehicleTypeName(vehicleType)}</span>
        </div>

      </div>

      {/* ── التبديل لوضع الراكب ── */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2">
        <button
          onClick={handleSwitchToRider}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-none bg-primary/10 text-primary hover:bg-primary/20 active:bg-primary/30 transition-colors border border-primary/20"
        >
          <Users className="w-4 h-4" />
          <span className="font-semibold text-sm">التبديل لوضع الراكب</span>
        </button>
      </div>

      {/* ── شبكة الكاردات — تملأ المساحة المتبقية ── */}
      <div className="flex-1 px-3 py-2 min-h-0 overflow-hidden">
        <div className="grid grid-cols-3 grid-rows-3 gap-2 w-full h-full">
          {[
            { icon: <Phone className="w-5 h-5" />, label: "الدعم الفني", href: "/help", bg: "bg-blue-500/12", color: "text-blue-400" },
            { icon: <Settings className="w-5 h-5" />, label: "الإعدادات", href: "/driver/settings", bg: "bg-slate-500/12", color: "text-slate-400" },
            { icon: <BarChart3 className="w-5 h-5" />, label: "الإحصائيات", href: "/driver/statistics", bg: "bg-purple-500/12", color: "text-purple-400" },
            { icon: <Gift className="w-5 h-5" />, label: "المكافآت", href: "/driver/incentives", bg: "bg-pink-500/12", color: "text-pink-400" },
            { icon: <Wallet className="w-5 h-5" />, label: "الأرباح", href: "/driver/payments", bg: "bg-emerald-500/12", color: "text-emerald-400" },
            { icon: <History className="w-5 h-5" />, label: "سجل الرحلات", href: "/driver/rides", bg: "bg-orange-500/12", color: "text-orange-400" },
            ...(driverStatus !== 'approved' ? [{ icon: <FileSearch className="w-5 h-5" />, label: "حالة الطلب", href: "/driver/application-status", bg: "bg-amber-500/12", color: "text-amber-400" }] : []),
            { icon: <UserCircle className="w-5 h-5" />, label: "ملفي", href: "/driver/profile", bg: "bg-cyan-500/12", color: "text-cyan-400" },
            { icon: <BookOpen className="w-5 h-5" />, label: "لعائلة ران", href: "/driver/guide", bg: "bg-amber-500/12", color: "text-amber-500" },
          ].map(({ icon, label, href, bg, color }) => (
            <Link
              key={href}
              to={href}
              onClick={onClose}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 ${bg} hover:opacity-80 active:scale-95 transition-all duration-150 min-h-0`}
            >
              <span className={`${color} [&>svg]:w-7 [&>svg]:h-7`}>{icon}</span>
              <span className="font-semibold text-sm text-foreground text-center leading-tight px-1">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── زر تسجيل الخروج ── */}
      <div className="flex-shrink-0 px-4 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] border-t border-border">
        <button
          onClick={() => { onClose(); setTimeout(() => onLogout(), 50); }}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-none text-white bg-destructive hover:bg-destructive/90 active:bg-destructive/80 transition-colors font-semibold text-base"
        >
          <LogOut className="w-5 h-5" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );


};

export default DriverSideMenu;
