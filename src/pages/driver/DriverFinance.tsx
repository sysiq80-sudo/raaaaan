import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
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
    case 'ride_earning': return <Car className="w-5 h-5 text-green-600" />;
    case 'cancellation_compensation': return <XCircle className="w-5 h-5 text-yellow-600" />;
    case 'bonus': return <Gift className="w-5 h-5 text-primary" />;
    case 'withdrawal': return <ArrowUpRight className="w-5 h-5 text-red-600" />;
    case 'topup': return <Plus className="w-5 h-5 text-green-600" />;
    case 'commission_deduction': return <Percent className="w-5 h-5 text-orange-600" />;
    default: return <Wallet className="w-5 h-5" />;
  }
};

const getTransactionLabel = (type: string) => {
  switch (type) {
    case 'ride_earning': return 'أجرة رحلة';
    case 'cancellation_compensation': return 'تعويض إلغاء';
    case 'bonus': return 'مكافأة';
    case 'withdrawal': return 'سحب';
    case 'topup': return 'إضافة رصيد';
    case 'commission_deduction': return 'خصم عمولة';
    default: return type;
  }
};

const isIncome = (type: string) => ['ride_earning', 'cancellation_compensation', 'bonus', 'topup'].includes(type);

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

  // Topup form state
  const [topupAmount, setTopupAmount] = useState<number>(50000);
  const [topupMethod, setTopupMethod] = useState<string>("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [commissionRate, setCommissionRate] = useState(15);
  const [tierName, setTierName] = useState<string | null>(null);
  const [tierBadge, setTierBadge] = useState<string | null>(null);
  const [tierDiscount, setTierDiscount] = useState(0);

  // Payment breakdown
  const [earningsBreakdown, setEarningsBreakdown] = useState({
    cash: 0, zain_cash: 0, asia_hawala: 0, qi_card: 0
  });

  // Withdrawal state
  const [withdrawalAmount, setWithdrawalAmount] = useState<number>(25000);
  const [withdrawalMethod, setWithdrawalMethod] = useState<string>("zain_cash");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [minWithdrawal, setMinWithdrawal] = useState(10000);

  useEffect(() => {
    const fetchDriverId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/driver/auth'); return; }
      setUserId(user.id);
      const { data: driver } = await supabase
        .from('drivers')
        .select('id, wallet_balance, commission_balance, total_earnings, total_rides, rating')
        .eq('user_id', user.id)
        .maybeSingle();
      if (driver) {
        setDriverId(driver.id);
        setDriverData({
          total_earnings: driver.total_earnings || 0,
          total_rides: driver.total_rides || 0,
          rating: driver.rating || 5.0
        });

        // Fetch base commission rate from wallet_settings
        const { data: walletSettings } = await supabase
          .from('wallet_settings')
          .select('default_commission_rate')
          .limit(1)
          .maybeSingle();
        const baseRate = walletSettings?.default_commission_rate ?? 15;

        // Fetch driver's commission tier based on monthly rides & rating
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
      // Fetch transactions
      const { data: txns } = await supabase
        .from('driver_wallet_transactions')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false })
        .limit(50);
      setTransactions(txns || []);

      // Fetch driver balances
      const { data: driver } = await supabase
        .from('drivers')
        .select('wallet_balance, commission_balance')
        .eq('id', driverId)
        .maybeSingle();

      // Fetch completed rides
      const { data: completedRides } = await supabase
        .from("rides")
        .select("id, pickup_address, dropoff_address, final_fare, estimated_fare, payment_method, completed_at, distance_km, driver_rating, status")
        .eq("driver_id", driverId)
        .order("completed_at", { ascending: false })
        .limit(30);
      setRides(completedRides || []);

      // Calculate earnings breakdown
      if (completedRides) {
        const breakdown = completedRides.filter(r => r.status === 'completed').reduce((acc, ride) => {
          const method = ride.payment_method || "cash";
          const fare = ride.final_fare || ride.estimated_fare || 0;
          acc[method as keyof typeof acc] = (acc[method as keyof typeof acc] || 0) + fare;
          return acc;
        }, { cash: 0, zain_cash: 0, asia_hawala: 0, qi_card: 0 });
        setEarningsBreakdown(breakdown);
      }

      // Calculate stats
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = startOfWeek(now, { weekStartsOn: 6 });
      const monthStart = startOfMonth(now);

      const allTxns = txns || [];
      const totalEarnings = allTxns.filter(t => t.type === 'ride_earning').reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const totalCompensations = allTxns.filter(t => t.type === 'cancellation_compensation').reduce((sum, t) => sum + t.amount, 0);
      const todayEarnings = allTxns.filter(t => isIncome(t.type) && new Date(t.created_at) >= todayStart).reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const weekEarnings = allTxns.filter(t => isIncome(t.type) && new Date(t.created_at) >= weekStart).reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const monthEarnings = allTxns.filter(t => isIncome(t.type) && new Date(t.created_at) >= monthStart).reduce((sum, t) => sum + Math.abs(t.amount), 0);

      setStats({
        balance: driver?.wallet_balance || 0,
        commissionBalance: driver?.commission_balance || 0,
        totalEarnings,
        totalCompensations,
        todayEarnings,
        weekEarnings,
        monthEarnings
      });

      // Fetch payment accounts
      const { data: accounts } = await supabase
        .from('payment_accounts')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      if (accounts) {
        setPaymentAccounts(accounts);
        if (accounts.length > 0 && !topupMethod) setTopupMethod(accounts[0].payment_method);
      }

      // Fetch topup requests
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

      // Fetch driver wallet for withdrawal
      const { data: walletData } = await supabase
        .from('driver_wallets')
        .select('id, balance')
        .eq('driver_id', driverId)
        .maybeSingle();
      if (walletData) {
        setWalletId(walletData.id);
        setWalletBalance(Number(walletData.balance) || 0);
      }

      // Fetch withdrawal settings
      const { data: wSettings } = await supabase
        .from('wallet_settings')
        .select('min_withdrawal_amount')
        .limit(1)
        .maybeSingle();
      if (wSettings) setMinWithdrawal(Number(wSettings.min_withdrawal_amount) || 10000);

      // Fetch withdrawal requests
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">قيد المراجعة</Badge>;
      case "approved": return <Badge variant="secondary" className="bg-green-100 text-green-800">تمت الموافقة</Badge>;
      case "rejected": return <Badge variant="destructive">مرفوض</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const paymentMethods = [
    { id: "cash", name: "نقدي", icon: <Banknote className="w-5 h-5" />, earnings: earningsBreakdown.cash, gradient: "from-emerald-500 to-green-600" },
    { id: "zain_cash", name: "زين كاش", icon: <Phone className="w-5 h-5" />, earnings: earningsBreakdown.zain_cash, gradient: "from-purple-500 to-violet-600" },
    { id: "asia_hawala", name: "آسيا حوالة", icon: <Building2 className="w-5 h-5" />, earnings: earningsBreakdown.asia_hawala, gradient: "from-blue-500 to-cyan-600" },
    { id: "qi_card", name: "كي كارد", icon: <CreditCard className="w-5 h-5" />, earnings: earningsBreakdown.qi_card, gradient: "from-orange-500 to-amber-600" },
  ];

  const getPaymentMethodIcon = (method: string | null) => {
    const found = paymentMethods.find(m => m.id === method);
    return found?.icon || <Banknote className="w-4 h-4" />;
  };

  const getPaymentMethodName = (method: string | null) => {
    const found = paymentMethods.find(m => m.id === method);
    return found?.name || "نقدي";
  };

  const balancePercentage = stats ? Math.min(stats.balance / 100000 * 100, 100) : 0;
  const isLowBalance = stats && stats.balance < 5000 && stats.balance > 0;
  const isZeroBalance = stats && stats.balance <= 0;
  const dailyGoal = 50000;
  const dailyProgress = Math.min((stats?.todayEarnings || 0) / dailyGoal * 100, 100);
  const totalEarnings = driverData?.total_earnings || 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-lg mx-auto space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20" dir="rtl">
      <DriverPageHeader title="المالية" />

      {/* Hero — أسود/أبيض/أخضر */}
      <div className="bg-[#0a0a0a] pt-20 pb-6 px-4 border-b border-white/5">
        <div className="max-w-lg mx-auto">

          {/* زر تحديث */}
          <div className="flex items-center justify-end mb-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="تحديث البيانات"
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 active:scale-90 transition-all"
            >
              <RefreshCw className={`w-4 h-4 text-white/60 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* إجمالي الأرباح */}
          <div className="bg-white/5 border border-white/8 rounded-2xl p-5 mb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/50 text-xs mb-1">إجمالي الأرباح الكلية</p>
                <p className="text-4xl font-bold text-white">{totalEarnings.toLocaleString()}</p>
                <p className="text-emerald-400 text-sm font-medium mt-0.5">دينار عراقي</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
            {/* إحصاء سريع */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/8 text-sm">
              <div className="flex items-center gap-1.5 text-white/50">
                <Car className="w-4 h-4" />
                <span>{driverData?.total_rides || 0} رحلة</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/50">
                <Star className="w-4 h-4 text-amber-400" />
                <span className="text-white/70">{driverData?.rating?.toFixed(1) || "5.0"}</span>
              </div>
            </div>
          </div>

          {/* رصيد العمولة */}
          <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-white/60">
                <Wallet className="w-4 h-4" />
                <span className="text-sm">رصيد العمولة</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold ${isZeroBalance ? 'text-red-400' : isLowBalance ? 'text-amber-400' : 'text-white'}`}>
                  {stats?.balance.toLocaleString() || 0}
                </span>
                <span className="text-white/40 text-xs">د.ع</span>
              </div>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isZeroBalance ? 'bg-red-500' : isLowBalance ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${balancePercentage}%` }}
              />
            </div>
            {isZeroBalance && (
              <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-300">رصيد صفر! أضف رصيداً للاستمرار في استقبال الطلبات</p>
              </div>
            )}
            {isLowBalance && (
              <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-300">رصيد منخفض — يُنصح بالشحن</p>
              </div>
            )}
          </div>

        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4">
        {/* Daily Goal */}
        <Card className="border-border/50 shadow-sm mb-4 driver-geometric-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                <span className="font-medium text-foreground">هدف اليوم</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {(stats?.todayEarnings || 0).toLocaleString()} / {dailyGoal.toLocaleString()} د.ع
              </span>
            </div>
            <Progress value={dailyProgress} className="h-3" />
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>أرباح اليوم</span>
              <span className={dailyProgress >= 100 ? "text-emerald-500 font-medium" : ""}>
                {dailyProgress >= 100 ? "🎉 تم تحقيق الهدف!" : `${dailyProgress.toFixed(0)}%`}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Commission Tier Info */}
        {tierName && (
          <Card className="border-border/50 shadow-sm mb-4 driver-geometric-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{tierBadge || '🏷️'}</span>
                  <div>
                    <span className="font-medium text-foreground">المستوى: {tierName}</span>
                    {tierDiscount > 0 && (
                      <p className="text-xs text-emerald-600">خصم {tierDiscount}% على العمولة</p>
                    )}
                  </div>
                </div>
                <div className="text-left">
                  <span className="text-lg font-bold text-foreground">{commissionRate}%</span>
                  <p className="text-xs text-muted-foreground">نسبة العمولة</p>
                </div>
              </div>
              <Link to="/driver/subscription">
                <Button variant="outline" size="sm" className="w-full mt-3 text-xs">
                  <Star className="w-3.5 h-3.5 ml-1" />
                  عرض خطط الاشتراك لخصم إضافي
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="earnings" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="earnings" className="text-xs gap-1">
              <DollarSign className="w-3 h-3" />
              الأرباح
            </TabsTrigger>
            <TabsTrigger value="transactions" className="text-xs gap-1">
              <History className="w-3 h-3" />
              المعاملات
            </TabsTrigger>
            <TabsTrigger value="withdraw" className="text-xs gap-1">
              <ArrowDown className="w-3 h-3" />
              سحب
            </TabsTrigger>
            <TabsTrigger value="topup" className="text-xs gap-1">
              <Plus className="w-3 h-3" />
              الشحن
            </TabsTrigger>
          </TabsList>

          {/* Earnings Tab */}
          <TabsContent value="earnings" className="space-y-4">
            <div className="space-y-3">
              {paymentMethods.map((method) => {
                const percentage = totalEarnings > 0 ? (method.earnings / totalEarnings) * 100 : 0;
                return (
                  <Card key={method.id} className="overflow-hidden border-border/50 driver-geometric-card">
                    <CardContent className="p-0">
                      <div className="flex items-center">
                        <div className={`w-16 bg-gradient-to-br ${method.gradient} flex items-center justify-center py-4 text-white`}>
                          {method.icon}
                        </div>
                        <div className="flex-1 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-foreground">{method.name}</span>
                            <span className="font-bold text-foreground">
                              {method.earnings.toLocaleString()} <span className="text-xs text-muted-foreground">د.ع</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={percentage} className="h-1.5 flex-1" />
                            <span className="text-xs text-muted-foreground w-10 text-left">{percentage.toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-auto py-4" onClick={() => navigate('/driver/incentives')}>
                <div className="text-center">
                  <Gift className="w-6 h-6 mx-auto mb-1 text-primary" />
                  <span className="text-sm">المكافآت</span>
                </div>
              </Button>
              <Button variant="outline" className="h-auto py-4" onClick={() => navigate('/driver/statistics')}>
                <div className="text-center">
                  <TrendingUp className="w-6 h-6 mx-auto mb-1 text-primary" />
                  <span className="text-sm">الإحصائيات</span>
                </div>
              </Button>
            </div>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-4">
            <Card className="driver-geometric-card">
              <CardContent className="p-0">
                {transactions.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>لا توجد معاملات بعد</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {transactions.map(txn => (
                      <div key={txn.id} className="flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors">
                        <div className="p-2 rounded-full bg-secondary">{getTransactionIcon(txn.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{txn.description || getTransactionLabel(txn.type)}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(txn.created_at), 'dd MMM yyyy - HH:mm', { locale: ar })}
                          </p>
                        </div>
                        <div className={`text-left font-bold ${txn.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          <span className="text-xs">{txn.amount >= 0 ? '+' : ''}</span>
                          {txn.amount.toLocaleString()}
                          <span className="text-xs font-normal text-muted-foreground mr-1">د.ع</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdrawal Tab */}
          <TabsContent value="withdraw" className="space-y-4">
            <Card className="driver-geometric-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowDown className="w-5 h-5 text-primary" />
                  سحب الأرباح
                </CardTitle>
                <CardDescription>
                  اسحب أرباحك عبر الطرق المتاحة — الحد الأدنى {minWithdrawal.toLocaleString()} د.ع
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Available Balance */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">الرصيد المتاح للسحب</span>
                    <span className="text-xl font-bold text-primary">{walletBalance.toLocaleString()} د.ع</span>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <Label className="text-sm mb-2 block">مبلغ السحب</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {[25000, 50000, 100000, 200000].map(amount => (
                      <Button key={amount} variant={withdrawalAmount === amount ? "default" : "outline"} className="h-12" onClick={() => setWithdrawalAmount(amount)}>
                        {(amount / 1000).toLocaleString()}K
                      </Button>
                    ))}
                  </div>
                  <Input type="number" placeholder="أو أدخل مبلغ آخر" value={withdrawalAmount} onChange={e => setWithdrawalAmount(Number(e.target.value))} className="mt-2" />
                </div>

                {/* Method */}
                <div>
                  <Label className="text-sm mb-2 block">طريقة السحب</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "zain_cash", name: "زين كاش", icon: <Phone className="w-4 h-4" /> },
                      { id: "nas_wallet", name: "ناس واليت", icon: <Smartphone className="w-4 h-4" /> },
                      { id: "bank_transfer", name: "تحويل بنكي", icon: <Building2 className="w-4 h-4" /> },
                      { id: "manual", name: "صرف يدوي", icon: <Banknote className="w-4 h-4" /> },
                    ].map(m => (
                      <button key={m.id} onClick={() => setWithdrawalMethod(m.id)} className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm ${withdrawalMethod === m.id ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/50'}`}>
                        {m.icon}
                        <span>{m.name}</span>
                        {withdrawalMethod === m.id && <CheckCircle className="w-4 h-4 text-primary mr-auto" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Account Details */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm mb-1 block">اسم صاحب الحساب</Label>
                    <Input placeholder="الاسم الكامل" value={accountHolder} onChange={e => setAccountHolder(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-sm mb-1 block">
                      {withdrawalMethod === "bank_transfer" ? "رقم الحساب البنكي (IBAN)" :
                       withdrawalMethod === "zain_cash" ? "رقم زين كاش" :
                       withdrawalMethod === "nas_wallet" ? "رقم ناس واليت" : "رقم الهاتف"}
                    </Label>
                    <Input placeholder="أدخل رقم الحساب" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
                  </div>
                </div>

                {/* Submit */}
                <Button className="w-full gap-2" size="lg" onClick={handleSubmitWithdrawal} disabled={withdrawing || !accountHolder.trim() || !accountNumber.trim() || withdrawalAmount < minWithdrawal || withdrawalAmount > walletBalance}>
                  {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  إرسال طلب السحب
                </Button>
              </CardContent>
            </Card>

            {/* Withdrawal History */}
            {withdrawals.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="w-4 h-4" />
                    سجل طلبات السحب
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {withdrawals.map(w => (
                    <div key={w.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                      <div>
                        <p className="font-medium">{Number(w.amount).toLocaleString()} د.ع</p>
                        <p className="text-xs text-muted-foreground">{w.account_holder_name} — {w.withdrawal_method}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(w.created_at), "d MMM yyyy HH:mm", { locale: ar })}
                        </p>
                        {w.review_notes && <p className="text-xs text-orange-600 mt-1">{w.review_notes}</p>}
                      </div>
                      <Badge variant={
                        w.status === "completed" ? "outline" :
                        w.status === "approved" || w.status === "processing" ? "secondary" :
                        w.status === "rejected" ? "destructive" : "secondary"
                      } className={
                        w.status === "completed" ? "bg-green-100 text-green-800" :
                        w.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                        w.status === "rejected" ? "" : "bg-blue-100 text-blue-800"
                      }>
                        {w.status === "pending" ? "قيد المراجعة" :
                         w.status === "approved" ? "تمت الموافقة" :
                         w.status === "processing" ? "قيد التنفيذ" :
                         w.status === "completed" ? "تم التحويل" :
                         w.status === "rejected" ? "مرفوض" : w.status}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Topup Tab */}
          <TabsContent value="topup" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">إضافة رصيد للعمولة</CardTitle>
                <CardDescription>
                  يتم خصم العمولة من هذا الرصيد مع كل رحلة مكتملة
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quick Amounts */}
                <div>
                  <Label className="text-sm mb-2 block">اختر المبلغ</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {quickAmounts.map(amount => (
                      <Button key={amount} variant={topupAmount === amount ? "default" : "outline"} className="h-12" onClick={() => setTopupAmount(amount)}>
                        {(amount / 1000).toLocaleString()}K
                      </Button>
                    ))}
                  </div>
                  <Input type="number" placeholder="أو أدخل مبلغ آخر" value={topupAmount} onChange={e => setTopupAmount(Number(e.target.value))} className="mt-2" />
                </div>

                {/* Estimate */}
                <div className="bg-secondary/50 rounded-lg p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">عدد الرحلات التقريبي:</span>
                    <span className="font-medium">{Math.floor(topupAmount / (5000 * commissionRate / 100))} رحلة</span>
                  </div>
                </div>

                {/* Payment Method Selection */}
                <div>
                  <Label className="text-sm mb-2 block">طريقة الدفع</Label>
                  <div className="space-y-2">
                    {paymentAccounts.map(account => (
                      <button key={account.id} onClick={() => setTopupMethod(account.payment_method)} className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${topupMethod === account.payment_method ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/50'}`}>
                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                          <Smartphone className="w-5 h-5" />
                        </div>
                        <div className="flex-1 text-right">
                          <p className="font-medium">{account.account_name}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-muted-foreground">{account.account_number}</p>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); copyToClipboard(account.account_number); }}>
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {topupMethod === account.payment_method && <CheckCircle className="w-5 h-5 text-primary" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reference Number */}
                <div>
                  <Label className="text-sm mb-2 block">رقم العملية المرجعي</Label>
                  <Input placeholder="أدخل رقم العملية بعد التحويل" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} />
                </div>

                {/* Submit Button */}
                <Button className="w-full gap-2" size="lg" onClick={handleSubmitTopup} disabled={submitting || !referenceNumber.trim() || topupAmount < 1000}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  إرسال طلب الإضافة
                </Button>
              </CardContent>
            </Card>

            {/* Pending Requests */}
            {topupRequests.filter(r => r.status === "pending").length > 0 && (
              <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-900/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-yellow-700 dark:text-yellow-500">
                    <AlertTriangle className="w-4 h-4" />
                    طلبات قيد المراجعة
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {topupRequests.filter(r => r.status === "pending").map(request => (
                    <div key={request.id} className="flex items-center justify-between p-2 bg-background rounded-lg">
                      <div>
                        <p className="font-medium">{request.amount.toLocaleString()} د.ع</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(request.created_at), "d MMM yyyy HH:mm", { locale: ar })}
                        </p>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
