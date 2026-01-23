import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  Wallet,
  CreditCard,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const PRESET_AMOUNTS = [5000, 10000, 25000, 50000, 100000];

const WalletTopupPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [balance, setBalance] = useState(0);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate("/auth?redirect=/rider/wallet-topup");
        return;
      }
      setUserId(data.user.id);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (userId) {
      fetchBalance();
    }
  }, [userId]);

  const fetchBalance = async () => {
    if (!userId) return;
    setLoading(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_balance")
      .eq("user_id", userId)
      .single();

    if (profile) {
      setBalance(profile.wallet_balance || 0);
    }
    setLoading(false);
  };

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount("");
  };

  const handleCustomAmountChange = (value: string) => {
    const numValue = value.replace(/[^0-9]/g, "");
    setCustomAmount(numValue);
    setSelectedAmount(null);
  };

  const getFinalAmount = (): number => {
    if (selectedAmount) return selectedAmount;
    if (customAmount) return parseInt(customAmount, 10) || 0;
    return 0;
  };

  const handleProceedToPayment = async () => {
    const amount = getFinalAmount();
    
    if (amount < 1000) {
      toast({
        title: "خطأ",
        description: "الحد الأدنى للشحن 1,000 دينار",
        variant: "destructive",
      });
      return;
    }

    if (amount > 5000000) {
      toast({
        title: "خطأ",
        description: "الحد الأقصى للشحن 5,000,000 دينار",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast({
          title: "خطأ",
          description: "يرجى تسجيل الدخول أولاً",
          variant: "destructive",
        });
        navigate("/auth?redirect=/rider/wallet-topup");
        return;
      }

      // Call NASS init payment edge function
      const { data, error } = await supabase.functions.invoke('nass-init-payment', {
        body: {
          amount: amount,
          orderDesc: 'شحن محفظة رعان',
          backRef: `${window.location.origin}/payment/result`
        }
      });

      if (error) {
        console.error('Payment init error:', error);
        toast({
          title: "خطأ",
          description: "فشل في بدء عملية الدفع",
          variant: "destructive",
        });
        return;
      }

      if (!data?.success || !data?.data?.paymentUrl) {
        toast({
          title: "خطأ",
          description: data?.error || "فشل في الحصول على رابط الدفع",
          variant: "destructive",
        });
        return;
      }

      // Store order ID for status check
      localStorage.setItem('pending_payment_order', data.data.orderId);

      // Redirect to NASS payment page
      window.location.href = data.data.paymentUrl;

    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء معالجة الدفع",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const formatAmount = (amount: number): string => {
    if (amount >= 1000) {
      return `${(amount / 1000).toLocaleString()}K`;
    }
    return amount.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/rider/payments")}
            className="shrink-0"
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">شحن المحفظة</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Current Balance */}
            <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm opacity-80">رصيدك الحالي</p>
                    <p className="text-3xl font-bold">{balance.toLocaleString()} د.ع</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Amount Selection */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">اختر المبلغ</h2>
              
              <div className="grid grid-cols-3 gap-3">
                {PRESET_AMOUNTS.map((amount) => (
                  <Button
                    key={amount}
                    variant={selectedAmount === amount ? "default" : "outline"}
                    className={cn(
                      "h-16 text-lg font-bold relative",
                      selectedAmount === amount && "ring-2 ring-primary ring-offset-2"
                    )}
                    onClick={() => handleAmountSelect(amount)}
                  >
                    {selectedAmount === amount && (
                      <CheckCircle2 className="absolute top-1 left-1 w-4 h-4" />
                    )}
                    {formatAmount(amount)}
                  </Button>
                ))}
              </div>

              {/* Custom Amount */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  أو أدخل مبلغ مخصص (دينار عراقي)
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="مثال: 15000"
                  value={customAmount}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  className="text-lg h-14 text-center font-bold"
                />
                {customAmount && (
                  <p className="text-sm text-muted-foreground text-center">
                    {parseInt(customAmount, 10).toLocaleString()} دينار عراقي
                  </p>
                )}
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">طريقة الدفع</h2>
              
              <Card className="border-2 border-primary bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                      <CreditCard className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold">بطاقة ائتمان / ماستر كارد</p>
                      <p className="text-sm text-muted-foreground">
                        الدفع الآمن عبر NASS Gateway
                      </p>
                    </div>
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Summary & Action */}
            <div className="space-y-4 pt-4">
              {getFinalAmount() > 0 && (
                <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
                  <span className="text-muted-foreground">المبلغ المطلوب</span>
                  <span className="text-2xl font-bold text-primary">
                    {getFinalAmount().toLocaleString()} د.ع
                  </span>
                </div>
              )}

              <Button
                size="lg"
                className="w-full h-14 text-lg gap-2"
                disabled={getFinalAmount() < 1000 || processing}
                onClick={handleProceedToPayment}
              >
                {processing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    جاري التحويل...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    متابعة للدفع
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                عند الضغط على "متابعة للدفع" سيتم تحويلك لصفحة الدفع الآمنة
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WalletTopupPage;
