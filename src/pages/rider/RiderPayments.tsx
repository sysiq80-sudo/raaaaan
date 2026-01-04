import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Wallet, Banknote, CreditCard, Smartphone, Building2, CheckCircle, Loader2, TrendingUp, Calendar, MapPin, Clock, Receipt, Car, ChevronLeft, Plus, Copy, AlertCircle, History, Send, Upload, Image, MessageCircle, Sparkles, Shield, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
interface PaymentMethod {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  isActive: boolean;
  color: string;
}
interface PaymentAccount {
  id: string;
  payment_method: string;
  account_name: string;
  account_number: string;
  account_holder: string | null;
  instructions: string | null;
}
interface WalletTransaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
  payment_method: string | null;
}
interface TopupRequest {
  id: string;
  amount: number;
  payment_method: string;
  reference_number: string;
  status: string;
  created_at: string;
  admin_notes: string | null;
}
interface PaymentRecord {
  id: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  final_fare: number | null;
  estimated_fare: number | null;
  payment_method: string | null;
  completed_at: string | null;
  created_at: string;
  distance_km: number | null;
  duration_minutes: number | null;
  vehicle_type: string | null;
}
const quickAmounts = [10000, 15000, 20000, 25000];

// Validate custom amount (must be multiple of 5000 for amounts > 25000)
const validateCustomAmount = (amount: number): { valid: boolean; message?: string } => {
  if (amount < 5000) {
    return { valid: false, message: "الحد الأدنى 5,000 د.ع" };
  }
  if (amount > 25000 && amount % 5000 !== 0) {
    return { valid: false, message: "المبلغ يجب أن يكون من مضاعفات 5,000" };
  }
  return { valid: true };
};
const RiderPayments = () => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<string>("cash");
  const [walletBalance, setWalletBalance] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [rideCount, setRideCount] = useState(0);
  const [thisMonthSpent, setThisMonthSpent] = useState(0);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Topup form state
  const [topupAmount, setTopupAmount] = useState<number>(25000);
  const [topupMethod, setTopupMethod] = useState<string>("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [receiptImage, setReceiptImage] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [customAmountInput, setCustomAmountInput] = useState<string>("");
  const [amountError, setAmountError] = useState<string>("");
  const [submitProgress, setSubmitProgress] = useState<number>(0);
  const [submitStep, setSubmitStep] = useState<string>("");
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const paymentMethods: PaymentMethod[] = [{
    id: "cash",
    name: "نقداً",
    icon: <Banknote className="w-6 h-6" />,
    description: "الدفع نقداً للسائق عند الوصول",
    isActive: true,
    color: "from-emerald-500 to-green-600"
  }, {
    id: "wallet",
    name: "محفظة ران",
    icon: <Wallet className="w-6 h-6" />,
    description: "الدفع من رصيد محفظتك",
    isActive: true,
    color: "from-primary to-primary/80"
  }, {
    id: "zain_cash",
    name: "زين كاش",
    icon: <Smartphone className="w-6 h-6" />,
    description: "الدفع عبر محفظة زين كاش الإلكترونية",
    isActive: true,
    color: "from-purple-500 to-violet-600"
  }, {
    id: "asia_hawala",
    name: "آسيا حوالة",
    icon: <Building2 className="w-6 h-6" />,
    description: "الدفع عبر خدمة آسيا حوالة",
    isActive: true,
    color: "from-blue-500 to-cyan-600"
  }];
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      await Promise.all([fetchWalletBalance(session.user.id), fetchPaymentStats(session.user.id), fetchPaymentHistory(session.user.id), fetchWalletTransactions(session.user.id), fetchTopupRequests(session.user.id), fetchPaymentAccounts()]);
      setLoading(false);
    };
    checkAuth();
  }, [navigate]);
  const fetchWalletBalance = async (userId: string) => {
    const {
      data
    } = await supabase.from("profiles").select("wallet_balance").eq("user_id", userId).single();
    if (data) {
      setWalletBalance(data.wallet_balance || 0);
    }
  };
  const fetchPaymentStats = async (userId: string) => {
    const {
      data,
      error
    } = await supabase.from("rides").select("final_fare, estimated_fare, completed_at").eq("rider_id", userId).eq("status", "completed");
    if (!error && data) {
      const total = data.reduce((sum, ride) => sum + (ride.final_fare || ride.estimated_fare || 0), 0);
      setTotalSpent(total);
      setRideCount(data.length);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyTotal = data.filter(ride => ride.completed_at && new Date(ride.completed_at) >= startOfMonth).reduce((sum, ride) => sum + (ride.final_fare || ride.estimated_fare || 0), 0);
      setThisMonthSpent(monthlyTotal);
    }
  };
  const fetchPaymentHistory = async (userId: string) => {
    setHistoryLoading(true);
    const {
      data,
      error
    } = await supabase.from("rides").select("id, pickup_address, dropoff_address, final_fare, estimated_fare, payment_method, completed_at, created_at, distance_km, duration_minutes, vehicle_type").eq("rider_id", userId).eq("status", "completed").order("completed_at", {
      ascending: false
    }).limit(20);
    if (!error && data) {
      setPaymentHistory(data);
    }
    setHistoryLoading(false);
  };
  const fetchWalletTransactions = async (userId: string) => {
    const {
      data
    } = await supabase.from("rider_wallet_transactions").select("*").eq("user_id", userId).order("created_at", {
      ascending: false
    }).limit(30);
    if (data) {
      setWalletTransactions(data);
    }
  };
  const fetchTopupRequests = async (userId: string) => {
    const {
      data
    } = await supabase.from("wallet_topup_requests").select("*").eq("user_id", userId).eq("user_type", "rider").order("created_at", {
      ascending: false
    }).limit(10);
    if (data) {
      setTopupRequests(data);
    }
  };
  const fetchPaymentAccounts = async () => {
    const {
      data
    } = await supabase.from("payment_accounts").select("*").eq("is_active", true).order("display_order");
    if (data) {
      setPaymentAccounts(data);
      if (data.length > 0) {
        setTopupMethod(data[0].payment_method);
      }
    }
  };
  // Check if at least one of reference or image is provided
  const hasValidProof = referenceNumber.trim() || receiptImage;
  
  const handleSubmitTopup = async () => {
    if (!user || !topupMethod) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار طريقة الدفع",
        variant: "destructive"
      });
      return;
    }
    
    if (!hasValidProof) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال رقم العملية أو رفع صورة الإشعار (أحدهما على الأقل)",
        variant: "destructive"
      });
      return;
    }
    
    const validation = validateCustomAmount(topupAmount);
    if (!validation.valid) {
      toast({
        title: "خطأ",
        description: validation.message,
        variant: "destructive"
      });
      return;
    }
    setSubmitting(true);
    setSubmitProgress(0);
    setSubmitStep("جاري التحقق من البيانات...");
    setShowSuccess(false);
    
    try {
      // Step 1: Validate
      await new Promise(resolve => setTimeout(resolve, 400));
      setSubmitProgress(25);
      setSubmitStep("جاري تحضير الطلب...");
      
      // Step 2: Prepare
      await new Promise(resolve => setTimeout(resolve, 400));
      setSubmitProgress(50);
      setSubmitStep("جاري إرسال الطلب...");
      
      // Step 3: Submit
      const {
        error
      } = await supabase.from("wallet_topup_requests").insert({
        user_id: user.id,
        user_type: "rider",
        amount: topupAmount,
        payment_method: topupMethod,
        reference_number: referenceNumber.trim(),
        payment_account: paymentAccounts.find(a => a.payment_method === topupMethod)?.account_number
      });
      if (error) throw error;
      
      setSubmitProgress(75);
      setSubmitStep("جاري تأكيد الطلب...");
      await new Promise(resolve => setTimeout(resolve, 400));
      
      setSubmitProgress(100);
      setSubmitStep("تم بنجاح!");
      setShowSuccess(true);
      
      // Reset form after success
      setTimeout(() => {
        setReferenceNumber("");
        setReceiptImage(null);
        setReceiptPreview(null);
        setCustomAmountInput("");
        setTopupAmount(quickAmounts[0]);
        setShowSuccess(false);
        setSubmitProgress(0);
        setSubmitStep("");
      }, 3000);
      
      await fetchTopupRequests(user.id);
    } catch (error: any) {
      setSubmitProgress(0);
      setSubmitStep("");
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      if (!showSuccess) {
        setSubmitting(false);
      } else {
        setTimeout(() => setSubmitting(false), 3000);
      }
    }
  };
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "تم النسخ",
      description: "تم نسخ رقم الحساب"
    });
  };
  const getPaymentMethodName = (method: string | null) => {
    const found = paymentMethods.find(m => m.id === method);
    return found?.name || "نقداً";
  };
  const getPaymentMethodIcon = (method: string | null) => {
    const found = paymentMethods.find(m => m.id === method);
    return found?.icon || <Banknote className="w-4 h-4" />;
  };
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 border border-amber-500/30">قيد المراجعة</Badge>;
      case "approved":
        return <Badge variant="secondary" className="bg-green-500/20 text-green-400 border border-green-500/30">تمت الموافقة</Badge>;
      case "rejected":
        return <Badge variant="destructive">مرفوض</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };
  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      topup: "إضافة رصيد",
      ride_payment: "دفع رحلة",
      refund: "استرداد",
      bonus: "مكافأة",
      transfer_to_driver: "تحويل للسائق"
    };
    return labels[type] || type;
  };
  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20" dir="rtl">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container flex items-center justify-between h-16">
          <Button variant="ghost" size="icon" onClick={() => navigate("/rider")}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-lg">المحفظة الذكية</h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Content */}
      <main className="pt-20 pb-8 px-4">
        <div className="container max-w-lg space-y-6">
          
          {/* Wallet Balance Card */}
          <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0 shadow-xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-full opacity-10">
              <div className="absolute top-4 left-4 w-32 h-32 rounded-full bg-white/30 blur-2xl" />
              <div className="absolute bottom-4 right-4 w-24 h-24 rounded-full bg-white/20 blur-xl" />
            </div>
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm opacity-80">رصيد المحفظة</p>
                    <p className="text-3xl font-bold">{walletBalance.toLocaleString()}</p>
                    <p className="text-xs opacity-70">دينار عراقي</p>
                  </div>
                </div>
              </div>
              
              {/* Pending requests indicator */}
              {topupRequests.filter(r => r.status === "pending").length > 0 && <div className="flex items-center gap-2 bg-primary-foreground/10 rounded-lg p-2 mt-2">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">
                    {topupRequests.filter(r => r.status === "pending").length} طلب قيد المراجعة
                  </span>
                </div>}
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">هذا الشهر</p>
                    <p className="text-lg font-bold">{thisMonthSpent.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">د.ع</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Car className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">عدد الرحلات</p>
                    <p className="text-lg font-bold">{rideCount}</p>
                    <p className="text-xs text-muted-foreground">رحلة</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="topup" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="topup" className="text-xs gap-1">
                <Plus className="w-3 h-3" />
                إضافة رصيد
              </TabsTrigger>
              <TabsTrigger value="methods" className="text-xs gap-1">
                <CreditCard className="w-3 h-3" />
                طرق الدفع
              </TabsTrigger>
              <TabsTrigger value="transactions" className="text-xs gap-1">
                <History className="w-3 h-3" />
                المعاملات
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs gap-1">
                <Receipt className="w-3 h-3" />
                الرحلات
              </TabsTrigger>
            </TabsList>

            {/* Topup Tab */}
            <TabsContent value="topup" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">إضافة رصيد للمحفظة</CardTitle>
                  <CardDescription>اختر المبلغ وطريقة الدفع ثم أدخل رقم العملية</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Quick Amounts */}
                  <div>
                    <Label className="text-sm mb-2 block">اختر المبلغ</Label>
                    <div className="grid grid-cols-4 gap-2" dir="rtl">
                      {quickAmounts.map(amount => (
                        <Button 
                          key={amount} 
                          variant={topupAmount === amount && !customAmountInput ? "default" : "outline"} 
                          className="h-12 text-sm font-medium" 
                          onClick={() => {
                            setTopupAmount(amount);
                            setCustomAmountInput("");
                            setAmountError("");
                          }}
                        >
                          {amount.toLocaleString()}
                          <span className="text-xs mr-1 opacity-70">د.ع</span>
                        </Button>
                      ))}
                    </div>
                    
                    {/* Custom Amount Input */}
                    <div className="mt-3">
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        أو أدخل مبلغ مخصص (بالآلاف - سيُضاف 000 تلقائياً)
                      </Label>
                      <div className="relative">
                        <Input 
                          type="number" 
                          placeholder="مثال: 30 تصبح 30,000" 
                          value={customAmountInput}
                          onChange={e => {
                            const inputVal = e.target.value;
                            setCustomAmountInput(inputVal);
                            
                            if (inputVal) {
                              const amount = Number(inputVal) * 1000;
                              const validation = validateCustomAmount(amount);
                              
                              if (!validation.valid) {
                                setAmountError(validation.message || "");
                              } else {
                                setAmountError("");
                                setTopupAmount(amount);
                              }
                            } else {
                              setAmountError("");
                              setTopupAmount(quickAmounts[0]);
                            }
                          }}
                          className={`pl-16 ${amountError ? 'border-destructive' : ''}`}
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          ,000 د.ع
                        </span>
                      </div>
                      {amountError && (
                        <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {amountError}
                        </p>
                      )}
                      {customAmountInput && !amountError && (
                        <p className="text-xs text-muted-foreground mt-1">
                          المبلغ النهائي: <span className="font-medium text-foreground">{topupAmount.toLocaleString()} د.ع</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Payment Method Selection */}
                  <div>
                    <Label className="text-sm mb-2 block">طريقة الدفع</Label>
                    <div className="space-y-2">
                      {paymentAccounts.map(account => (
                        <button 
                          key={account.id} 
                          onClick={() => setTopupMethod(account.payment_method)} 
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${topupMethod === account.payment_method ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/50'}`}
                        >
                          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                            <Smartphone className="w-5 h-5" />
                          </div>
                          <div className="flex-1 text-right">
                            <div className="flex items-center gap-2 justify-start">
                              <p className="font-medium">{account.account_name}</p>
                              {account.account_holder && (
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                  المستلم: {account.account_holder}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-muted-foreground">{account.account_number}</p>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6" 
                                onClick={e => {
                                  e.stopPropagation();
                                  copyToClipboard(account.account_number);
                                }}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                            {account.instructions && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
                                {account.instructions}
                              </p>
                            )}
                          </div>
                          {topupMethod === account.payment_method && <CheckCircle className="w-5 h-5 text-primary" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reference Number and Receipt Upload */}
                  <div className="p-3 bg-secondary/30 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="w-4 h-4 text-primary" />
                      <p className="text-sm font-medium">أدخل رقم العملية أو ارفع صورة الإشعار (أحدهما كافٍ)</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Reference Number */}
                      <div>
                        <Label className="text-sm mb-2 flex items-center gap-1">
                          رقم العملية المرجعي
                          {!receiptImage && <span className="text-destructive">*</span>}
                          {receiptImage && <span className="text-xs text-muted-foreground">(اختياري)</span>}
                        </Label>
                        <Input 
                          placeholder="أدخل رقم العملية بعد التحويل" 
                          value={referenceNumber} 
                          onChange={e => setReferenceNumber(e.target.value)}
                          className={!hasValidProof ? 'border-amber-400' : ''}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          ستجد رقم العملية في رسالة التأكيد
                        </p>
                      </div>

                      {/* Receipt Image Upload */}
                      <div>
                        <Label className="text-sm mb-2 flex items-center gap-1">
                          صورة إشعار التحويل
                          {!referenceNumber.trim() && <span className="text-destructive">*</span>}
                          {referenceNumber.trim() && <span className="text-xs text-muted-foreground">(اختياري)</span>}
                        </Label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          id="receipt-upload"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setReceiptImage(file);
                              setReceiptPreview(URL.createObjectURL(file));
                            }
                          }}
                        />
                        {receiptPreview ? (
                          <div className="relative border-2 border-primary rounded-xl overflow-hidden">
                            <img src={receiptPreview} alt="إشعار التحويل" className="w-full h-24 object-cover" />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-1 left-1 h-6 w-6"
                              onClick={() => {
                                setReceiptImage(null);
                                setReceiptPreview(null);
                              }}
                            >
                              ×
                            </Button>
                          </div>
                        ) : (
                          <label
                            htmlFor="receipt-upload"
                            className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-border/50 rounded-xl cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition-all"
                          >
                            <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                            <span className="text-xs text-muted-foreground">ارفع الصورة</span>
                          </label>
                        )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Verification Notice */}
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        سيتم التحقق خلال 24 ساعة من الطلب
                      </p>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs text-primary font-medium mt-1 hover:underline"
                        onClick={() => {
                          // Open support chat or WhatsApp
                          window.open("https://wa.me/9647700000000", "_blank");
                        }}
                      >
                        <MessageCircle className="w-3 h-3" />
                        إن كان عاجلاً، راسل الدعم الآن
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar & Submit Button */}
                  {submitting ? (
                    <div className="space-y-4">
                      {/* Progress Section */}
                      <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {showSuccess ? (
                              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center animate-scale-in">
                                <CheckCircle className="w-5 h-5 text-white" />
                              </div>
                            ) : (
                              <Loader2 className="w-5 h-5 text-primary animate-spin" />
                            )}
                            <span className={`font-medium ${showSuccess ? 'text-green-600' : 'text-primary'}`}>
                              {submitStep}
                            </span>
                          </div>
                          <span className="text-sm font-bold text-primary">{submitProgress}%</span>
                        </div>
                        <Progress value={submitProgress} className="h-2" />
                        
                        {/* Step Indicators */}
                        <div className="flex justify-between text-xs text-muted-foreground mt-2">
                          <div className={`flex items-center gap-1 ${submitProgress >= 25 ? 'text-primary' : ''}`}>
                            <Shield className="w-3 h-3" />
                            <span>التحقق</span>
                          </div>
                          <div className={`flex items-center gap-1 ${submitProgress >= 50 ? 'text-primary' : ''}`}>
                            <Zap className="w-3 h-3" />
                            <span>التحضير</span>
                          </div>
                          <div className={`flex items-center gap-1 ${submitProgress >= 75 ? 'text-primary' : ''}`}>
                            <Send className="w-3 h-3" />
                            <span>الإرسال</span>
                          </div>
                          <div className={`flex items-center gap-1 ${submitProgress >= 100 ? 'text-green-600' : ''}`}>
                            <CheckCircle className="w-3 h-3" />
                            <span>تم</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Success Message */}
                      {showSuccess && (
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 animate-fade-in">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
                              <Sparkles className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-green-700 dark:text-green-400">
                                تم إرسال طلبك بنجاح! 🎉
                              </h4>
                              <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                                سيتم مراجعة طلبك وإضافة <span className="font-bold">{topupAmount.toLocaleString()} د.ع</span> خلال دقائق
                              </p>
                              <div className="flex items-center gap-4 mt-3 text-xs text-green-600 dark:text-green-500">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>وقت المراجعة: 5-30 دقيقة</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button 
                      className="w-full gap-2 h-12 text-base font-bold shadow-lg hover:shadow-xl transition-all" 
                      size="lg" 
                      onClick={handleSubmitTopup} 
                      disabled={!hasValidProof || topupAmount < 5000 || !!amountError}
                    >
                      <Send className="w-5 h-5" />
                      إرسال طلب إضافة {topupAmount.toLocaleString()} د.ع
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Pending Requests */}
              {topupRequests.filter(r => r.status === "pending").length > 0 && <Card className="border-amber-500/30 bg-amber-500/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
                      <AlertCircle className="w-4 h-4" />
                      طلبات قيد المراجعة
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {topupRequests.filter(r => r.status === "pending").map(request => <div key={request.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-border/50">
                        <div>
                          <p className="font-medium text-foreground">{request.amount.toLocaleString()} د.ع</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(request.created_at), "d MMM yyyy HH:mm", {
                        locale: ar
                      })}
                          </p>
                        </div>
                        {getStatusBadge(request.status)}
                      </div>)}
                  </CardContent>
                </Card>}
            </TabsContent>

            {/* Payment Methods Tab */}
            <TabsContent value="methods" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">اختر طريقة الدفع المفضلة</CardTitle>
                  <CardDescription>سيتم استخدامها افتراضياً في رحلاتك القادمة</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {paymentMethods.map(method => <button key={method.id} onClick={() => setSelectedMethod(method.id)} className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-300 ${selectedMethod === method.id ? 'border-primary bg-primary/5 shadow-md' : 'border-border/50 hover:border-primary/50 hover:bg-secondary/50'}`}>
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${method.color} text-white shadow-lg`}>
                        {method.icon}
                      </div>
                      <div className="flex-1 text-right">
                        <p className="font-semibold text-foreground">{method.name}</p>
                        <p className="text-sm text-muted-foreground">{method.description}</p>
                      </div>
                      {selectedMethod === method.id && <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-primary-foreground" />
                        </div>}
                    </button>)}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Wallet Transactions Tab */}
            <TabsContent value="transactions" className="space-y-4">
              {walletTransactions.length === 0 ? <Card className="border-dashed border-2 border-border/50">
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-secondary flex items-center justify-center mb-4">
                      <History className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">لا توجد معاملات</h3>
                    <p className="text-sm text-muted-foreground">
                      ستظهر هنا جميع معاملات محفظتك
                    </p>
                  </CardContent>
                </Card> : <div className="space-y-2">
                  {walletTransactions.map(txn => <Card key={txn.id} className="overflow-hidden">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${txn.amount > 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                              {txn.amount > 0 ? <Plus className="w-5 h-5 text-green-600" /> : <ArrowRight className="w-5 h-5 text-red-600 rotate-180" />}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{getTransactionTypeLabel(txn.type)}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(txn.created_at), "d MMM yyyy HH:mm", {
                            locale: ar
                          })}
                              </p>
                            </div>
                          </div>
                          <p className={`font-bold ${txn.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {txn.amount > 0 ? '+' : ''}{txn.amount.toLocaleString()} د.ع
                          </p>
                        </div>
                      </CardContent>
                    </Card>)}
                </div>}
            </TabsContent>

            {/* Ride Payment History Tab */}
            <TabsContent value="history" className="space-y-4">
              {historyLoading ? <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div> : paymentHistory.length === 0 ? <Card className="border-dashed border-2 border-border/50">
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-secondary flex items-center justify-center mb-4">
                      <Receipt className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">لا توجد رحلات بعد</h3>
                    <p className="text-sm text-muted-foreground">
                      ستظهر هنا جميع مدفوعات رحلاتك المكتملة
                    </p>
                    <Button className="mt-4" onClick={() => navigate("/rider")}>
                      احجز رحلتك الأولى
                    </Button>
                  </CardContent>
                </Card> : <div className="space-y-3">
                  {paymentHistory.map(payment => <Card key={payment.id} className="overflow-hidden hover:shadow-md transition-shadow">
                      <CardContent className="p-0">
                        <div className="flex items-stretch">
                          <div className="w-24 bg-gradient-to-br from-primary/10 to-primary/5 flex flex-col items-center justify-center p-3 border-l border-border/30">
                            <p className="text-lg font-bold text-primary">
                              {(payment.final_fare || payment.estimated_fare || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">د.ع</p>
                          </div>

                          <div className="flex-1 p-3">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <MapPin className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                                  <p className="text-sm text-foreground truncate">
                                    {payment.pickup_address || "موقع الانطلاق"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-3 h-3 text-red-500 flex-shrink-0" />
                                  <p className="text-sm text-muted-foreground truncate">
                                    {payment.dropoff_address || "الوجهة"}
                                  </p>
                                </div>
                              </div>
                              <ChevronLeft className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            </div>

                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>
                                  {payment.completed_at ? format(new Date(payment.completed_at), "d MMM yyyy", {
                              locale: ar
                            }) : format(new Date(payment.created_at), "d MMM yyyy", {
                              locale: ar
                            })}
                                </span>
                              </div>
                              {payment.distance_km && <div className="flex items-center gap-1">
                                  <Car className="w-3 h-3" />
                                  <span>{Number(payment.distance_km).toFixed(1)} كم</span>
                                </div>}
                              <Badge variant="secondary" className="text-xs h-5 gap-1">
                                {getPaymentMethodIcon(payment.payment_method)}
                                {getPaymentMethodName(payment.payment_method)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>)}
                </div>}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>;
};
export default RiderPayments;