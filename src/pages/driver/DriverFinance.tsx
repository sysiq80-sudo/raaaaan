import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Wallet, ArrowUpRight, ArrowDownLeft, TrendingUp, Clock, Car, XCircle, Gift, 
  ChevronLeft, RefreshCw, AlertTriangle, Plus, Smartphone, Copy, CheckCircle, 
  Send, Loader2, Percent, History, DollarSign, Banknote, CreditCard, Phone, 
  Building2, Target, Star, Receipt, MapPin, ArrowDown, Ban
} from "lucide-react";
import { format, startOfWeek, startOfMonth } from "date-fns";
import { ar } from "date-fns/locale";
import DriverPageHeader from "@/components/driver/DriverPageHeader";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
  ride_id: string | null;
}

interface WalletStats {
  balance: number;
  commissionBalance: number;
  totalEarnings: number;
  totalCompensations: number;
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
}

interface PaymentAccount {
  id: string;
  payment_method: string;
  account_name: string;
  account_number: string;
  account_holder: string | null;
  instructions: string | null;
}

interface TopupRequest {
  id: string;
  amount: number;
  payment_method: string;
  reference_number: string;
  status: string;
  created_at: string;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  withdrawal_method: string;
  account_holder_name: string;
  account_details: Record<string, string>;
  status: string;
  review_notes: string | null;
  created_at: string;
}

interface EarningRecord {
  id: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  final_fare: number | null;
  estimated_fare: number | null;
  payment_method: string | null;
  completed_at: string | null;
  distance_km: number | null;
  driver_rating: number | null;
  status: string;
}

const quickAmounts = [25000, 50000, 100000, 200000];

const getTransactionIcon = (type: string) => {
  switch (type) {
    case 'ride_earning': return <Car className="w-5 h-5 text-[#5bdda6]" />;
    case 'cancellation_compensation': return <XCircle className="w-5 h-5 text-amber-400" />;
    case 'bonus': return <Gift className="w-5 h-5 text-[#5bdda6]" />;
    case 'withdrawal': return <ArrowUpRight className="w-5 h-5 text-red-400" />;
    case 'topup': return <Plus className="w-5 h-5 text-[#5bdda6]" />;
    case 'daily_fee': return <Clock className="w-5 h-5 text-orange-400" />;
    case 'commission': return <Percent className="w-5 h-5 text-orange-400" />;
    case 'commission_deduction': return <Percent className="w-5 h-5 text-orange-400" />;
    default: return <Wallet className="w-5 h-5 text-slate-400" />;
  }
};

const getTransactionLabel = (type: string) => {
  switch (type) {
    case 'ride_earning': return 'أجرة رحلة';
    case 'cancellation_compensation': return 'تعويض إلغاء';
    case 'bonus': return 'مكافأة';
    case 'withdrawal': return 'سحب';
    case 'topup': return 'إضافة رصيد';
    case 'daily_fee': return 'اشتراك يومي';
    case 'commission': return 'عمولة رحلة';
    case 'commission_deduction': return 'خصم عمولة';
    default: return type;
  }
};

const isIncome = (type: string) => ['ride_earning', 'cancellation_compensation', 'bonus', 'topup', 'tip', 'refund'].includes(type);

export default function DriverFinance() {
  const [driverId, setDriverId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rides, setRides] = useState<EarningRecord[]>([]);
  const [stats, setStats] = useState<WalletStats | null>(null);
  const [driverData, setDriverData] = useState<{ total_earnings: number; total_rides: number; rating: number } | null>(null);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [topupAmount, setTopupAmount] = useState<number>(50000);
  const [topupMethod, setTopupMethod] = useState<string>("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [commissionRate, setCommissionRate] = useState(15);
  const [tierName, setTierName] = useState<string | null>(null);
  const [tierBadge, setTierBadge] = useState<string | null>(null);
  const [tierDiscount, setTierDiscount] = useState(0);
  const [dailyGoal, setDailyGoal] = useState<number>(50000);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState("");
  const [activeTab, setActiveTab] = useState<'earnings' | 'transactions' | 'withdraw' | 'topup'>('earnings');

  const [earningsBreakdown, setEarningsBreakdown] = useState({
    cash: 0, zain_cash: 0, asia_hawala: 0, qi_card: 0
  });

  const [withdrawalAmount, setWithdrawalAmount] = useState<number>(25000);
  const [withdrawalMethod, setWithdrawalMethod] = useState<string>("zain_cash");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [minWithdrawal, setMinWithdrawal] = useState(10000);

  // إزالة قيود السكرول من body لتفعيل التمرير في صفحة المالية
  useEffect(() => {
    const hadDriverMode = document.body.classList.contains('driver-mode');
    document.body.classList.remove('driver-mode');
    document.body.style.overflow = 'auto';
    document.body.style.position = 'static';
    return () => {
      if (hadDriverMode) {
        document.body.classList.add('driver-mode');
      }
      document.body.style.overflow = '';
      document.body.style.position = '';
    };
  }, []);

  useEffect(() => {
    const fetchDriverId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/driver/auth'); return; }
      setUserId(user.id);
      const { data: driver } = await supabase
        .from('drivers')
        .select('id, total_earnings, total_rides, rating')
        .eq('user_id', user.id)
        .maybeSingle();
      if (driver) {
        setDriverId(driver.id);
        setDriverData({
          total_earnings: driver.total_earnings || 0,
          total_rides: driver.total_rides || 0,
          rating: driver.rating || 5.0
        });

        const savedGoal = localStorage.getItem(`driver_daily_goal_${driver.id}`);
        if (savedGoal) {
          setDailyGoal(Number(savedGoal));
        }

        const { data: walletSettings } = await supabase
          .from('wallet_settings')
          .select('default_commission_rate')
          .limit(1)
          .maybeSingle();
        const baseRate = walletSettings?.default_commission_rate ?? 15;

        const driverRating = driver.rating || 5.0;
        const monthlyRides = driver.total_rides || 0;
        const { data: tiers } = await supabase
          .from('commission_tiers')
          .select('name_ar, commission_discount, badge_icon')
          .eq('is_active', true)
          .lte('min_rides_monthly', monthlyRides)
          .lte('min_rating', driverRating)
          .order('priority', { ascending: false })
          .limit(1);

        if (tiers && tiers.length > 0) {
          const tier = tiers[0];
          setTierName(tier.name_ar);
          setTierBadge(tier.badge_icon);
          setTierDiscount(tier.commission_discount || 0);
          setCommissionRate(Math.max(0, baseRate - (tier.commission_discount || 0)));
        } else {
          setCommissionRate(baseRate);
        }
      } else {
        navigate('/driver/auth');
      }
    };
    fetchDriverId();
  }, [navigate]);

  const fetchAllData = async () => {
    if (!driverId) return;
    try {
      const { data: txns } = await supabase
        .from('wallet_transactions')
        .select('id, amount, transaction_type, description, created_at, ride_id')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false })
        .limit(50);

      const mappedTransactions = (txns || []).map((txn: any) => ({
        id: txn.id,
        amount: Number(txn.amount) || 0,
        type: txn.transaction_type,
        description: txn.description,
        created_at: txn.created_at,
        ride_id: txn.ride_id,
      }));
      setTransactions(mappedTransactions);

      const { data: walletData } = await supabase
        .from('driver_wallets')
        .select('id, balance, commission_paid')
        .eq('driver_id', driverId)
        .maybeSingle();
      const currentWalletBalance = Number(walletData?.balance ?? 0);
      setWalletId(walletData?.id ?? null);
      setWalletBalance(currentWalletBalance);

      const { data: completedRides } = await supabase
        .from("rides")
        .select("id, pickup_address, dropoff_address, final_fare, estimated_fare, payment_method, completed_at, distance_km, driver_rating, status")
        .eq("driver_id", driverId)
        .order("completed_at", { ascending: false })
        .limit(30);
      setRides(completedRides || []);

      if (completedRides) {
        const breakdown = completedRides.filter(r => r.status === 'completed').reduce((acc, ride) => {
          const method = ride.payment_method || "cash";
          const fare = ride.final_fare || ride.estimated_fare || 0;
          acc[method as keyof typeof acc] = (acc[method as keyof typeof acc] || 0) + fare;
          return acc;
        }, { cash: 0, zain_cash: 0, asia_hawala: 0, qi_card: 0 });
        setEarningsBreakdown(breakdown);
      }

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = startOfWeek(now, { weekStartsOn: 6 });
      const monthStart = startOfMonth(now);

      const allTxns = mappedTransactions;
      const totalEarnings = allTxns.filter(t => t.type === 'ride_earning').reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const totalCompensations = allTxns.filter(t => t.type === 'cancellation_compensation').reduce((sum, t) => sum + t.amount, 0);
      const todayEarnings = allTxns.filter(t => isIncome(t.type) && new Date(t.created_at) >= todayStart).reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const weekEarnings = allTxns.filter(t => isIncome(t.type) && new Date(t.created_at) >= weekStart).reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const monthEarnings = allTxns.filter(t => isIncome(t.type) && new Date(t.created_at) >= monthStart).reduce((sum, t) => sum + Math.abs(t.amount), 0);

      setStats({
        balance: currentWalletBalance,
        commissionBalance: Number(walletData?.commission_paid ?? 0),
        totalEarnings,
        totalCompensations,
        todayEarnings,
        weekEarnings,
        monthEarnings
      });

      const { data: accounts } = await supabase
        .from('payment_accounts')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      if (accounts) {
        setPaymentAccounts(accounts);
        if (accounts.length > 0 && !topupMethod) setTopupMethod(accounts[0].payment_method);
      }

      if (userId) {
        const { data: requests } = await supabase
          .from('wallet_topup_requests')
          .select('*')
          .eq('user_id', userId)
          .eq('user_type', 'driver')
          .order('created_at', { ascending: false })
          .limit(10);
        if (requests) setTopupRequests(requests);
      }

      const { data: wSettings } = await supabase
        .from('wallet_settings')
        .select('min_withdrawal_amount')
        .limit(1)
        .maybeSingle();
      if (wSettings) setMinWithdrawal(Number(wSettings.min_withdrawal_amount) || 10000);

      const { data: wRequests } = await (supabase as any)
        .from('withdrawal_requests')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (wRequests) setWithdrawals(wRequests as WithdrawalRequest[]);
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { if (driverId) fetchAllData(); }, [driverId, userId]);

  const handleRefresh = () => { setRefreshing(true); fetchAllData(); };

  const handleSubmitTopup = async () => {
    if (!userId || !topupMethod || !referenceNumber.trim()) {
      toast({ title: "خطأ", description: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("wallet_topup_requests").insert({
        user_id: userId,
        user_type: "driver",
        amount: topupAmount,
        payment_method: topupMethod,
        reference_number: referenceNumber.trim(),
        payment_account: paymentAccounts.find(a => a.payment_method === topupMethod)?.account_number
      });
      if (error) throw error;
      toast({ title: "تم إرسال الطلب", description: "سيتم مراجعة طلبك وإضافة الرصيد خلال دقائق" });
      setReferenceNumber("");
      await fetchAllData();
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitWithdrawal = async () => {
    if (!driverId || !walletId) return;
    if (!accountHolder.trim() || !accountNumber.trim()) {
      toast({ title: "خطأ", description: "يرجى ملء اسم صاحب الحساب ورقم الحساب", variant: "destructive" });
      return;
    }
    if (withdrawalAmount < minWithdrawal) {
      toast({ title: "خطأ", description: `الحد الأدنى للسحب ${minWithdrawal.toLocaleString()} د.ع`, variant: "destructive" });
      return;
    }
    if (withdrawalAmount > walletBalance) {
      toast({ title: "رصيد غير كافٍ", description: `رصيدك الحالي ${walletBalance.toLocaleString()} د.ع`, variant: "destructive" });
      return;
    }
    setWithdrawing(true);
    try {
      const { error } = await (supabase as any).from("withdrawal_requests").insert({
        driver_id: driverId,
        wallet_id: walletId,
        amount: withdrawalAmount,
        withdrawal_method: withdrawalMethod,
        account_holder_name: accountHolder.trim(),
        account_details: { account_number: accountNumber.trim(), method: withdrawalMethod },
        status: "pending",
      });
      if (error) throw error;
      toast({ title: "✅ تم إرسال طلب السحب", description: "سيتم مراجعة طلبك من قبل الإدارة" });
      setAccountHolder("");
      setAccountNumber("");
      await fetchAllData();
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } finally {
      setWithdrawing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "تم النسخ", description: "تم نسخ رقم الحساب" });
  };

  const paymentMethods = [
    { id: "cash", name: "نقدي", icon: <Banknote className="w-5 h-5" />, earnings: earningsBreakdown.cash, color: "#5bdda6" },
    { id: "zain_cash", name: "زين كاش", icon: <Phone className="w-5 h-5" />, earnings: earningsBreakdown.zain_cash, color: "#a78bfa" },
    { id: "asia_hawala", name: "آسيا حوالة", icon: <Building2 className="w-5 h-5" />, earnings: earningsBreakdown.asia_hawala, color: "#38bdf8" },
    { id: "qi_card", name: "كي كارد", icon: <CreditCard className="w-5 h-5" />, earnings: earningsBreakdown.qi_card, color: "#fb923c" },
  ];

  const balancePercentage = stats ? Math.min(stats.balance / 100000 * 100, 100) : 0;
  const isLowBalance = stats && stats.balance < 5000 && stats.balance > 0;
  const isZeroBalance = stats && stats.balance <= 0;
  const dailyProgress = Math.min((stats?.todayEarnings || 0) / dailyGoal * 100, 100);
  const totalEarnings = driverData?.total_earnings || 0;

  const handleSaveGoal = () => {
    const parsed = Number(tempGoal);
    if (!isNaN(parsed) && parsed >= 5000) {
      setDailyGoal(parsed);
      localStorage.setItem(`driver_daily_goal_${driverId}`, parsed.toString());
    }
    setIsEditingGoal(false);
  };

  const tabs = [
    { id: 'earnings' as const, label: 'الأرباح', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'transactions' as const, label: 'المعاملات', icon: <History className="w-4 h-4" /> },
    { id: 'withdraw' as const, label: 'سحب', icon: <ArrowDown className="w-4 h-4" /> },
    { id: 'topup' as const, label: 'الشحن', icon: <Plus className="w-4 h-4" /> },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1326]">
        <DriverPageHeader title="المالية" />
        <div className="pt-20 px-5 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#171f33] rounded-2xl h-32 animate-pulse border border-slate-700/30" />
          ))}
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-[#0b1326] pb-8 overflow-y-auto" dir="rtl">
      <DriverPageHeader title="المالية" />

      {/* ═══ روابط سريعة — المكافآت والإحصائيات ═══ */}
      <div className="px-5 pt-[calc(3.5rem+env(safe-area-inset-top)+0.75rem)] pb-4 relative z-10">
        <div className="max-w-lg mx-auto">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/driver/incentives')}
              className="bg-[#171f33] rounded-2xl border border-slate-700/30 p-4 flex flex-col items-center gap-2 hover:bg-[#1d2740] active:scale-[0.97] transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Gift className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-sm font-semibold text-white">المكافآت</span>
            </button>
            <button
              onClick={() => navigate('/driver/statistics')}
              className="bg-[#171f33] rounded-2xl border border-slate-700/30 p-4 flex flex-col items-center gap-2 hover:bg-[#1d2740] active:scale-[0.97] transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-[#5bdda6]/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#5bdda6]" />
              </div>
              <span className="text-sm font-semibold text-white">الإحصائيات</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ خلفية ديكورية ═══ */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-[#5bdda6]/5 blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-[#5bdda6]/3 blur-[100px]" />
      </div>

      <div className="relative z-10">
        {/* ═══ Hero Section — إجمالي الأرباح ═══ */}
        <div className="pt-2 pb-5 px-5">
          <div className="max-w-lg mx-auto space-y-4">



            {/* ═══ كارد الأرباح الرئيسي ═══ */}
            <div className="bg-[#171f33] rounded-2xl border border-slate-700/30 overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              {/* خط متدرج علوي */}
              <div className="h-1 bg-gradient-to-r from-transparent via-[#5bdda6]/50 to-transparent" />

              <div className="p-5" dir="rtl">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-[#5bdda6]/10 border border-[#5bdda6]/20 flex items-center justify-center shadow-[0_0_20px_rgba(91,221,166,0.15)] flex-shrink-0">
                    <DollarSign className="w-7 h-7 text-[#5bdda6]" />
                  </div>
                  <div className="text-right">
                    <p className="text-slate-500 text-xs font-medium mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>إجمالي الأرباح الكلية</p>
                    <div className="flex items-baseline gap-1.5 justify-end">
                      <p className="text-4xl font-black text-white tracking-tight tabular-nums" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                        {totalEarnings.toLocaleString()}
                      </p>
                      <p className="text-[#5bdda6] text-sm font-semibold">د.ع</p>
                    </div>
                  </div>
                </div>

                {/* إحصاء سريع */}
                <div className="flex flex-row-reverse items-center justify-end gap-5 mt-5 pt-4 border-t border-slate-700/30">
                  <div className="flex flex-row-reverse items-center gap-2 text-slate-400">
                    <Car className="w-4 h-4" />
                    <span className="text-sm font-medium">{driverData?.total_rides || 0} رحلة</span>
                  </div>
                  <div className="flex flex-row-reverse items-center gap-2 text-slate-400">
                    <Star className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium">{driverData?.rating?.toFixed(1) || "5.0"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ رصيد المحفظة ═══ */}
            <div className="bg-[#171f33] rounded-2xl border border-slate-700/30 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-baseline gap-1.5 justify-end">
                  <span className={`text-2xl font-black tabular-nums ${isZeroBalance ? 'text-red-400' : isLowBalance ? 'text-amber-400' : 'text-white'}`} style={{ fontFamily: 'Inter, sans-serif' }}>
                    {stats?.balance.toLocaleString() || 0}
                  </span>
                  <span className="text-slate-500 text-xs font-medium">د.ع</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-400">
                  <span className="text-sm font-medium">رصيد المحفظة</span>
                  <div className="w-8 h-8 rounded-xl bg-[#0b1326] border border-slate-700/50 flex items-center justify-center">
                    <Wallet className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* شريط التقدم */}
              <div className="h-2 bg-[#0b1326] rounded-full overflow-hidden border border-slate-800/50">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${isZeroBalance ? 'bg-red-500' : isLowBalance ? 'bg-amber-500' : 'bg-gradient-to-r from-[#5bdda6] to-[#3eba89]'}`}
                  style={{ width: `${balancePercentage}%` }}
                />
              </div>

              {isZeroBalance && (
                <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2.5">
                  <p className="text-xs text-red-300 font-medium text-right flex-1">رصيد صفر! أضف رصيداً للاستمرار في استقبال الطلبات</p>
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                </div>
              )}
              {isLowBalance && (
                <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-2.5">
                  <p className="text-xs text-amber-300 font-medium text-right flex-1">رصيد منخفض — يُنصح بالشحن</p>
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                </div>
              )}
            </div>

            {/* ═══ هدف اليوم ═══ */}
            <div className="bg-[#171f33] rounded-2xl border border-slate-700/30 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  {isEditingGoal ? null : (
                    <button 
                      onClick={() => { setTempGoal(dailyGoal.toString()); setIsEditingGoal(true); }}
                      className="text-xs text-slate-300 font-medium tabular-nums hover:text-white transition-colors bg-[#0b1326] px-2.5 py-1.5 rounded-lg border border-slate-700/50 hover:border-[#5bdda6]/30 active:scale-95" 
                      style={{ fontFamily: 'Inter, sans-serif' }}
                      dir="ltr"
                    >
                      {(stats?.todayEarnings || 0).toLocaleString()} / <span className="text-[#5bdda6]">{dailyGoal.toLocaleString()}</span> د.ع
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="text-right">
                    <span className="font-semibold text-white text-sm block">هدف اليوم</span>
                    <span className="text-[10px] text-slate-500">انقر على المبلغ لتعديله</span>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-[#5bdda6]/10 flex items-center justify-center flex-shrink-0">
                    <Target className="w-4 h-4 text-[#5bdda6]" />
                  </div>
                </div>

                {isEditingGoal && (
                  <div className="flex items-center gap-1.5 mt-2" dir="ltr">
                    <button onClick={() => setIsEditingGoal(false)} className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 transition-colors" aria-label="إلغاء">
                      <XCircle className="w-4 h-4" />
                    </button>
                    <button onClick={handleSaveGoal} className="w-7 h-7 rounded-lg bg-[#5bdda6] text-[#0b1326] flex items-center justify-center hover:bg-[#4ac794] transition-colors" aria-label="حفظ">
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      value={tempGoal}
                      onChange={e => setTempGoal(e.target.value)}
                      className="w-20 h-8 bg-[#0b1326] border border-[#5bdda6]/50 rounded-lg px-2 text-white text-xs text-center focus:outline-none focus:border-[#5bdda6] tabular-nums"
                      autoFocus
                      placeholder="الهدف"
                    />
                  </div>
                )}
              </div>
              <div className="h-2.5 bg-[#0b1326] rounded-full overflow-hidden border border-slate-800/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#5bdda6] to-[#27b481] transition-all duration-700"
                  style={{ width: `${dailyProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2.5 text-xs">
                <span className={dailyProgress >= 100 ? "text-[#5bdda6] font-bold" : "text-slate-400"}>
                  {dailyProgress >= 100 ? "🎉 تم تحقيق الهدف!" : `${dailyProgress.toFixed(0)}%`}
                </span>
                <span className="text-slate-500">أرباح اليوم</span>
              </div>
            </div>

            {/* ═══ مستوى العمولة ═══ */}
            {tierName && (
              <div className="bg-[#171f33] rounded-2xl border border-slate-700/30 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xl font-black text-white tabular-nums" style={{ fontFamily: 'Inter, sans-serif' }}>{commissionRate}%</span>
                    <p className="text-[10px] text-slate-500">نسبة العمولة</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="font-semibold text-white text-sm">المستوى: {tierName}</span>
                      {tierDiscount > 0 && (
                        <p className="text-xs text-[#5bdda6] font-medium mt-0.5">خصم {tierDiscount}% على العمولة</p>
                      )}
                    </div>
                    <span className="text-2xl">{tierBadge || '🏷️'}</span>
                  </div>
                </div>
                <Link to="/driver/subscription">
                  <button className="w-full mt-4 h-11 rounded-xl bg-[#0b1326] border border-slate-700/50 text-slate-300 text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#111b30] active:scale-[0.98] transition-all">
                    <Star className="w-3.5 h-3.5 text-amber-400" />
                    عرض خطط الاشتراك لخصم إضافي
                  </button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ═══ التبويبات ═══ */}
        <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 bg-[#0b1326]/90 backdrop-blur-xl border-b border-slate-700/30">
          <div className="max-w-lg mx-auto px-5">
            <div className="flex flex-row-reverse gap-1 py-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex flex-row-reverse items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-[#5bdda6]/15 text-[#5bdda6] border border-[#5bdda6]/30 shadow-[0_0_10px_rgba(91,221,166,0.1)]'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ محتوى التبويبات ═══ */}
        <div className="max-w-lg mx-auto px-5 pt-5 pb-8">

          {/* ── تبويب الأرباح ── */}
          {activeTab === 'earnings' && (
            <div className="space-y-4 animate-fade-in">
              {/* طرق الدفع */}
              {paymentMethods.map((method) => {
                const percentage = totalEarnings > 0 ? (method.earnings / totalEarnings) * 100 : 0;
                return (
                  <div key={method.id} className="bg-[#171f33] rounded-2xl border border-slate-700/30 overflow-hidden">
                    <div className="flex flex-row-reverse items-center">
                      <div className="w-16 flex items-center justify-center py-5" style={{ backgroundColor: `${method.color}15` }}>
                        <span style={{ color: method.color }}>{method.icon}</span>
                      </div>
                      <div className="flex-1 p-4">
                        <div className="flex flex-row-reverse items-center justify-between mb-2.5">
                          <span className="font-semibold text-white text-sm">{method.name}</span>
                          <span className="font-bold text-white tabular-nums text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
                            {method.earnings.toLocaleString()} <span className="text-[10px] text-slate-500 font-medium">د.ع</span>
                          </span>
                        </div>
                        <div className="flex flex-row-reverse items-center gap-2.5">
                          <div className="flex-1 h-1.5 bg-[#0b1326] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: method.color }} />
                          </div>
                          <span className="text-[10px] text-slate-500 w-8 text-right tabular-nums font-medium">{percentage.toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── تبويب المعاملات ── */}
          {activeTab === 'transactions' && (
            <div className="animate-fade-in">
              <div className="bg-[#171f33] rounded-2xl border border-slate-700/30 overflow-hidden">
                {transactions.length === 0 ? (
                  <div className="p-10 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-[#0b1326] border border-slate-700/50 flex items-center justify-center mx-auto mb-4">
                      <Wallet className="w-8 h-8 text-slate-600" />
                    </div>
                    <p className="text-slate-500 font-medium text-sm">لا توجد معاملات بعد</p>
                  </div>
                ) : (
                  <div>
                    {transactions.map((txn, index) => (
                      <div key={txn.id} className={`flex flex-row-reverse items-center gap-3.5 p-4 hover:bg-[#1d2740]/50 transition-colors ${index < transactions.length - 1 ? 'border-b border-slate-700/20' : ''}`}>
                        <div className="w-10 h-10 rounded-xl bg-[#0b1326] border border-slate-700/50 flex items-center justify-center flex-shrink-0">
                          {getTransactionIcon(txn.type)}
                        </div>
                        <div className="flex-1 min-w-0 text-right">
                          <p className="font-semibold text-sm text-white truncate">{txn.description || getTransactionLabel(txn.type)}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                            {format(new Date(txn.created_at), 'dd MMM yyyy - HH:mm', { locale: ar })}
                          </p>
                        </div>
                        <div className={`font-bold tabular-nums ${txn.amount >= 0 ? 'text-[#5bdda6]' : 'text-red-400'}`} style={{ fontFamily: 'Inter, sans-serif' }}>
                          <span className="text-xs">{txn.amount >= 0 ? '+' : ''}</span>
                          <span className="text-sm">{txn.amount.toLocaleString()}</span>
                          <span className="text-[10px] font-medium text-slate-500 mr-1">د.ع</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── تبويب السحب ── */}
          {activeTab === 'withdraw' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-[#171f33] rounded-2xl border border-slate-700/30 overflow-hidden">
                {/* العنوان */}
                <div className="p-5 border-b border-slate-700/20">
                  <div className="flex flex-row-reverse items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#5bdda6]/10 flex items-center justify-center">
                      <ArrowDown className="w-5 h-5 text-[#5bdda6]" />
                    </div>
                    <div className="text-right">
                      <h3 className="text-base font-bold text-white" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>سحب الأرباح</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">الحد الأدنى {minWithdrawal.toLocaleString()} د.ع</p>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* الرصيد المتاح */}
                  <div className="bg-[#5bdda6]/5 border border-[#5bdda6]/20 rounded-xl p-4">
                    <div className="flex flex-row-reverse items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">الرصيد المتاح للسحب</span>
                      <span className="text-xl font-black text-[#5bdda6] tabular-nums" style={{ fontFamily: 'Inter, sans-serif' }}>{walletBalance.toLocaleString()} د.ع</span>
                    </div>
                  </div>

                  {/* المبلغ */}
                  <div>
                    <label className="text-xs text-slate-400 font-bold mb-2.5 block">مبلغ السحب</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[25000, 50000, 100000, 200000].map(amount => (
                        <button
                          key={amount}
                          onClick={() => setWithdrawalAmount(amount)}
                          className={`h-11 rounded-xl text-xs font-bold transition-all ${
                            withdrawalAmount === amount
                              ? 'bg-[#5bdda6] text-[#0b1326] shadow-[0_0_15px_rgba(91,221,166,0.3)]'
                              : 'bg-[#0b1326] text-slate-400 border border-slate-700/50 hover:border-slate-600'
                          }`}
                        >
                          {(amount / 1000).toLocaleString()}K
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      placeholder="أو أدخل مبلغ آخر"
                      value={withdrawalAmount}
                      onChange={e => setWithdrawalAmount(Number(e.target.value))}
                      className="w-full mt-2.5 h-12 bg-[#0b1326] border border-slate-700/50 rounded-xl px-4 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#5bdda6]/50 transition-colors"
                    />
                  </div>

                  {/* طريقة السحب */}
                  <div>
                    <label className="text-xs text-slate-400 font-bold mb-2.5 block">طريقة السحب</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "zain_cash", name: "زين كاش", icon: <Phone className="w-4 h-4" /> },
                        { id: "nas_wallet", name: "ناس واليت", icon: <Smartphone className="w-4 h-4" /> },
                        { id: "bank_transfer", name: "تحويل بنكي", icon: <Building2 className="w-4 h-4" /> },
                        { id: "manual", name: "صرف يدوي", icon: <Banknote className="w-4 h-4" /> },
                      ].map(m => (
                        <button
                          key={m.id}
                          onClick={() => setWithdrawalMethod(m.id)}
                          className={`flex flex-row-reverse items-center gap-2.5 p-3.5 rounded-xl border transition-all text-sm ${
                            withdrawalMethod === m.id
                              ? 'border-[#5bdda6]/40 bg-[#5bdda6]/5 text-[#5bdda6]'
                              : 'border-slate-700/50 text-slate-400 hover:border-slate-600'
                          }`}
                        >
                          {m.icon}
                          <span className="font-semibold text-xs">{m.name}</span>
                          {withdrawalMethod === m.id && <CheckCircle className="w-4 h-4 text-[#5bdda6] ml-auto" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* بيانات الحساب */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400 font-bold mb-1.5 block">اسم صاحب الحساب</label>
                      <input
                        placeholder="الاسم الكامل"
                        value={accountHolder}
                        onChange={e => setAccountHolder(e.target.value)}
                        className="w-full h-12 bg-[#0b1326] border border-slate-700/50 rounded-xl px-4 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#5bdda6]/50 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-bold mb-1.5 block">
                        {withdrawalMethod === "bank_transfer" ? "رقم الحساب البنكي (IBAN)" :
                         withdrawalMethod === "zain_cash" ? "رقم زين كاش" :
                         withdrawalMethod === "nas_wallet" ? "رقم ناس واليت" : "رقم الهاتف"}
                      </label>
                      <input
                        placeholder="أدخل رقم الحساب"
                        value={accountNumber}
                        onChange={e => setAccountNumber(e.target.value)}
                        className="w-full h-12 bg-[#0b1326] border border-slate-700/50 rounded-xl px-4 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#5bdda6]/50 transition-colors"
                      />
                    </div>
                  </div>

                  {/* زر الإرسال */}
                  <button
                    onClick={handleSubmitWithdrawal}
                    disabled={withdrawing || !accountHolder.trim() || !accountNumber.trim() || withdrawalAmount < minWithdrawal || withdrawalAmount > walletBalance}
                    className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#5bdda6] to-[#3eba89] text-[#0b1326] font-bold text-base flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(91,221,166,0.25)] hover:shadow-[0_0_30px_rgba(91,221,166,0.4)] active:scale-[0.98] transition-all disabled:opacity-40 disabled:shadow-none"
                    style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  >
                    {withdrawing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    إرسال طلب السحب
                  </button>
                </div>
              </div>

              {/* سجل طلبات السحب */}
              {withdrawals.length > 0 && (
                <div className="bg-[#171f33] rounded-2xl border border-slate-700/30 overflow-hidden">
                  <div className="p-4 border-b border-slate-700/20 flex flex-row-reverse items-center gap-2">
                    <History className="w-4 h-4 text-slate-400" />
                    <h4 className="text-sm font-bold text-white">سجل طلبات السحب</h4>
                  </div>
                  <div>
                    {withdrawals.map((w, index) => (
                      <div key={w.id} className={`flex flex-row-reverse items-center justify-between p-4 ${index < withdrawals.length - 1 ? 'border-b border-slate-700/20' : ''}`}>
                        <div className="text-right">
                          <p className="font-bold text-white text-sm tabular-nums" style={{ fontFamily: 'Inter, sans-serif' }}>{Number(w.amount).toLocaleString()} د.ع</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{w.account_holder_name} — {w.withdrawal_method}</p>
                          <p className="text-[11px] text-slate-600">{format(new Date(w.created_at), "d MMM yyyy HH:mm", { locale: ar })}</p>
                          {w.review_notes && <p className="text-[11px] text-orange-400 mt-1">{w.review_notes}</p>}
                        </div>
                        <span className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${
                          w.status === "completed" ? "bg-[#5bdda6]/10 text-[#5bdda6]" :
                          w.status === "pending" ? "bg-amber-500/10 text-amber-400" :
                          w.status === "rejected" ? "bg-red-500/10 text-red-400" :
                          "bg-blue-500/10 text-blue-400"
                        }`}>
                          {w.status === "pending" ? "قيد المراجعة" :
                           w.status === "approved" ? "تمت الموافقة" :
                           w.status === "processing" ? "قيد التنفيذ" :
                           w.status === "completed" ? "تم التحويل" :
                           w.status === "rejected" ? "مرفوض" : w.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── تبويب الشحن ── */}
          {activeTab === 'topup' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-[#171f33] rounded-2xl border border-slate-700/30 overflow-hidden">
                {/* العنوان */}
                <div className="p-5 border-b border-slate-700/20">
                  <h3 className="text-base font-bold text-white" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>إضافة رصيد للمحفظة</h3>
                  <p className="text-[11px] text-slate-500 mt-1">يتم خصم الاشتراك اليومي أو العمولة من هذا الرصيد</p>
                </div>

                <div className="p-5 space-y-5">
                  {/* اختيار المبلغ */}
                  <div>
                    <label className="text-xs text-slate-400 font-bold mb-2.5 block">اختر المبلغ</label>
                    <div className="grid grid-cols-4 gap-2">
                      {quickAmounts.map(amount => (
                        <button
                          key={amount}
                          onClick={() => setTopupAmount(amount)}
                          className={`h-11 rounded-xl text-xs font-bold transition-all ${
                            topupAmount === amount
                              ? 'bg-[#5bdda6] text-[#0b1326] shadow-[0_0_15px_rgba(91,221,166,0.3)]'
                              : 'bg-[#0b1326] text-slate-400 border border-slate-700/50 hover:border-slate-600'
                          }`}
                        >
                          {(amount / 1000).toLocaleString()}K
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      placeholder="أو أدخل مبلغ آخر"
                      value={topupAmount}
                      onChange={e => setTopupAmount(Number(e.target.value))}
                      className="w-full mt-2.5 h-12 bg-[#0b1326] border border-slate-700/50 rounded-xl px-4 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#5bdda6]/50 transition-colors"
                    />
                  </div>

                  {/* التقدير */}
                  <div className="bg-[#0b1326] border border-slate-700/50 rounded-xl p-3.5">
                    <div className="flex flex-row-reverse justify-between text-sm">
                      <span className="text-slate-500 font-medium text-xs">عدد الرحلات التقريبي:</span>
                      <span className="font-bold text-[#5bdda6] text-sm tabular-nums" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {Math.floor(topupAmount / (5000 * commissionRate / 100))} رحلة
                      </span>
                    </div>
                  </div>

                  {/* طريقة الدفع */}
                  <div>
                    <label className="text-xs text-slate-400 font-bold mb-2.5 block">طريقة الدفع</label>
                    <div className="space-y-2">
                      {paymentAccounts.map(account => (
                        <button
                          key={account.id}
                          onClick={() => setTopupMethod(account.payment_method)}
                          className={`w-full flex flex-row-reverse items-center gap-3.5 p-3.5 rounded-xl border transition-all ${
                            topupMethod === account.payment_method
                              ? 'border-[#5bdda6]/40 bg-[#5bdda6]/5'
                              : 'border-slate-700/50 hover:border-slate-600'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-xl bg-[#0b1326] border border-slate-700/50 flex items-center justify-center flex-shrink-0">
                            <Smartphone className="w-5 h-5 text-slate-400" />
                          </div>
                          <div className="flex-1 text-right min-w-0">
                            <p className="font-semibold text-white text-sm truncate">{account.account_name}</p>
                            <div className="flex flex-row-reverse items-center gap-2 mt-0.5">
                              <p className="text-[11px] text-slate-500 truncate" dir="ltr">{account.account_number}</p>
                              <button
                                onClick={e => { e.stopPropagation(); copyToClipboard(account.account_number); }}
                                className="p-1 rounded-md hover:bg-slate-700/50 transition-colors flex-shrink-0"
                                aria-label="نسخ رقم الحساب"
                              >
                                <Copy className="w-3 h-3 text-slate-500" />
                              </button>
                            </div>
                          </div>
                          {topupMethod === account.payment_method && <CheckCircle className="w-5 h-5 text-[#5bdda6] flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* رقم العملية */}
                  <div>
                    <label className="text-xs text-slate-400 font-bold mb-1.5 block">رقم العملية المرجعي</label>
                    <input
                      placeholder="أدخل رقم العملية بعد التحويل"
                      value={referenceNumber}
                      onChange={e => setReferenceNumber(e.target.value)}
                      className="w-full h-12 bg-[#0b1326] border border-slate-700/50 rounded-xl px-4 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#5bdda6]/50 transition-colors"
                    />
                  </div>

                  {/* زر الإرسال */}
                  <button
                    onClick={handleSubmitTopup}
                    disabled={submitting || !referenceNumber.trim() || topupAmount < 1000}
                    className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#5bdda6] to-[#3eba89] text-[#0b1326] font-bold text-base flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(91,221,166,0.25)] hover:shadow-[0_0_30px_rgba(91,221,166,0.4)] active:scale-[0.98] transition-all disabled:opacity-40 disabled:shadow-none"
                    style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    إرسال طلب الإضافة
                  </button>
                </div>
              </div>

              {/* طلبات قيد المراجعة */}
              {topupRequests.filter(r => r.status === "pending").length > 0 && (
                <div className="bg-[#171f33] rounded-2xl border border-amber-500/20 overflow-hidden">
                  <div className="p-4 border-b border-amber-500/10 flex flex-row-reverse items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <h4 className="text-sm font-bold text-amber-400">طلبات قيد المراجعة</h4>
                  </div>
                  <div>
                    {topupRequests.filter(r => r.status === "pending").map((request, index) => (
                      <div key={request.id} className={`flex flex-row-reverse items-center justify-between p-4 ${index < topupRequests.filter(r => r.status === "pending").length - 1 ? 'border-b border-slate-700/20' : ''}`}>
                        <div className="text-right">
                          <p className="font-bold text-white text-sm tabular-nums" style={{ fontFamily: 'Inter, sans-serif' }}>{request.amount.toLocaleString()} د.ع</p>
                          <p className="text-[11px] text-slate-500">{format(new Date(request.created_at), "d MMM yyyy HH:mm", { locale: ar })}</p>
                        </div>
                        <span className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500/10 text-amber-400">
                          قيد المراجعة
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
