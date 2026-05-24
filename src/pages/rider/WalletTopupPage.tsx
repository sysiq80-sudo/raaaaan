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
  Smartphone,
  Gift,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WalletTopupPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState<{ amount: number } | null>(null);

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

  const handleRedeemVoucher = async () => {
    const code = voucherCode.trim().toUpperCase();
    if (!code) {
      toast({ title: "خطأ", description: "أدخل رمز الكارت", variant: "destructive" });
      return;
    }
    if (!userId) {
      toast({ title: "خطأ", description: "يرجى تسجيل الدخول", variant: "destructive" });
      return;
    }

    setRedeeming(true);
    setRedeemSuccess(null);

    try {
      const { data, error } = await supabase.rpc("redeem_voucher" as any, {
        p_code: code,
        p_user_id: userId,
      });

      if (error) {
        toast({ title: "خطأ", description: "فشل في معالجة الكارت", variant: "destructive" });
        return;
      }

      const result = data as any;
      if (result?.success) {
        setRedeemSuccess({ amount: result.amount });
        setBalance(result.new_balance);
        setVoucherCode("");
        toast({
          title: "✅ تم الشحن بنجاح!",
          description: `تم إضافة ${Number(result.amount).toLocaleString()} د.ع إلى محفظتك`,
        });
        // إخفاء رسالة النجاح بعد 5 ثواني
        setTimeout(() => setRedeemSuccess(null), 5000);
      } else {
        toast({ title: "خطأ", description: result?.error || "رمز غير صالح", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "خطأ", description: "حدث خطأ غير متوقع", variant: "destructive" });
    } finally {
      setRedeeming(false);
    }
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
          <h1 className="text-xl font-bold">المحفظة</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-28 space-y-6">
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

            {/* 🎟️ شحن بكارت شحن */}
            <Card className="border-2 border-blue-500/30 bg-blue-500/5">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Gift className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-bold text-blue-700 dark:text-blue-400">شحن بكارت شحن</p>
                    <p className="text-xs text-muted-foreground">أدخل رمز الكارت لإضافة الرصيد</p>
                  </div>
                </div>

                {/* حقل إدخال الكود */}
                <div className="space-y-3">
                  <Input
                    type="text"
                    placeholder="RAAN-XXXX-XXXX"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                    className="text-center text-lg h-14 font-mono font-bold tracking-widest border-2 border-blue-300/50 focus:border-blue-500"
                    dir="ltr"
                    maxLength={20}
                    disabled={redeeming}
                  />
                  <Button
                    className="w-full h-12 text-base gap-2 bg-blue-600 hover:bg-blue-700"
                    disabled={!voucherCode.trim() || redeeming}
                    onClick={handleRedeemVoucher}
                  >
                    {redeeming ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        جاري التحقق...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        شحن المحفظة
                      </>
                    )}
                  </Button>
                </div>

                {/* رسالة النجاح */}
                {redeemSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                    <Sparkles className="w-6 h-6 text-emerald-500 shrink-0" />
                    <div>
                      <p className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                        تم شحن {redeemSuccess.amount.toLocaleString()} د.ع بنجاح! ✨
                      </p>
                      <p className="text-xs text-muted-foreground">
                        رصيدك الجديد: {balance.toLocaleString()} د.ع
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* طرق الدفع الأخرى */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">طرق الدفع المتاحة</h2>
              
              {/* كاش للسائق */}
              <Card className="border border-emerald-500/20">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">الدفع نقداً للسائق</p>
                      <p className="text-xs text-muted-foreground">عند إكمال الرحلة</p>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                </CardContent>
              </Card>

              {/* الدفع الإلكتروني — قريباً */}
              <Card className="border border-muted opacity-50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                      <Smartphone className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-muted-foreground">زين كاش / بطاقات</p>
                      <p className="text-xs text-muted-foreground">قريباً</p>
                    </div>
                    <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">قريباً</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WalletTopupPage;
