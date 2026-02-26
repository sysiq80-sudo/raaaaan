/**
 * ران - صفحة اشتراكات السائق
 * عرض خطط الاشتراك المتاحة والاشتراك الحالي للسائق
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Crown,
  ChevronLeft,
  Check,
  Clock,
  Percent,
  Zap,
  Star,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

interface SubscriptionPlan {
  id: string;
  name_ar: string;
  name_en: string | null;
  description_ar: string | null;
  duration_days: number;
  price: number;
  commission_discount: number;
  priority_rides: boolean;
  is_active: boolean;
  sort_order: number;
}

interface DriverSubscription {
  id: string;
  plan_id: string;
  starts_at: string;
  expires_at: string;
  status: string;
  amount_paid: number | null;
  plan?: SubscriptionPlan;
}

export default function DriverSubscription() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSub, setCurrentSub] = useState<DriverSubscription | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/driver/auth"); return; }

      const { data: driver } = await supabase
        .from("drivers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!driver) { navigate("/driver/auth"); return; }
      setDriverId(driver.id);
    };
    init();
  }, [navigate]);

  useEffect(() => {
    if (!driverId) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  const fetchData = async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      // Fetch active plans
      const { data: plansData } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      setPlans(plansData || []);

      // Fetch current subscription
      const { data: subData } = await supabase
        .from("driver_subscriptions")
        .select("*, plan:subscription_plans(*)")
        .eq("driver_id", driverId)
        .eq("status", "active")
        .gte("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setCurrentSub(subData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "خطأ غير متوقع";
      toast({ title: "خطأ", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (!driverId) return;
    setSubscribing(plan.id);
    try {
      // 1. التحقق من رصيد المحفظة
      const { data: wallet } = await supabase
        .from("driver_wallets")
        .select("id, balance")
        .eq("driver_id", driverId)
        .maybeSingle();

      if (!wallet || wallet.balance < plan.price) {
        toast({
          title: "رصيد غير كافٍ",
          description: `رصيدك الحالي ${(wallet?.balance || 0).toLocaleString()} د.ع — تحتاج ${plan.price.toLocaleString()} د.ع. أضف رصيداً أولاً.`,
          variant: "destructive",
        });
        setSubscribing(null);
        return;
      }

      // 2. خصم المبلغ من المحفظة
      const newBalance = wallet.balance - plan.price;
      const { error: walletError } = await supabase
        .from("driver_wallets")
        .update({ balance: newBalance })
        .eq("id", wallet.id);

      if (walletError) throw walletError;

      // 3. تسجيل معاملة السحب
      await supabase.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        driver_id: driverId,
        transaction_type: "penalty", // subscription charge
        amount: -plan.price,
        balance_before: wallet.balance,
        balance_after: newBalance,
        description: `اشتراك خطة ${plan.name_ar}`,
        metadata: { plan_id: plan.id, plan_name: plan.name_ar },
        status: "completed",
      });

      // 4. تسجيل الاشتراك
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + plan.duration_days);

      const { error } = await supabase
        .from("driver_subscriptions")
        .insert({
          driver_id: driverId,
          plan_id: plan.id,
          starts_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          status: "active",
          payment_method: "wallet",
          amount_paid: plan.price,
        });

      if (error) throw error;

      toast({
        title: "✅ تم الاشتراك بنجاح!",
        description: `تم تفعيل خطة ${plan.name_ar} حتى ${expiresAt.toLocaleDateString("ar-IQ")} وخصم ${plan.price.toLocaleString()} د.ع من محفظتك`,
      });

      if (driverId) fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "خطأ غير متوقع";
      toast({ title: "خطأ", description: message, variant: "destructive" });
    } finally {
      setSubscribing(null);
    }
  };

  const getDaysRemaining = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const getPlanGradient = (index: number) => {
    const gradients = [
      "from-blue-600 to-blue-800",
      "from-purple-600 to-purple-800",
      "from-amber-500 to-amber-700",
    ];
    return gradients[index % gradients.length];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-primary/80 px-4 pt-12 pb-6 text-white">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/driver/finance")}
              className="text-white hover:bg-white/20"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Crown className="w-6 h-6" />
              الاشتراكات
            </h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchData}
              className="text-white hover:bg-white/20"
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-white/80 text-sm text-center">
            اشترك واحصل على خصم على العمولة وأولوية في الطلبات
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4">
        {/* Current Subscription */}
        {currentSub && currentSub.plan && (
          <Card className="mb-6 border-2 border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="w-5 h-5 text-primary" />
                  اشتراكك الحالي
                </CardTitle>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  فعّال
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-lg">{currentSub.plan?.name_ar}</span>
                <span className="text-sm text-muted-foreground">
                  متبقي {getDaysRemaining(currentSub.expires_at)} يوم
                </span>
              </div>
              <div className="flex gap-3 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <Percent className="w-3.5 h-3.5" />
                  خصم {currentSub.plan?.commission_discount}%
                </span>
                {currentSub.plan?.priority_rides && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <Zap className="w-3.5 h-3.5" />
                    أولوية الطلبات
                  </span>
                )}
              </div>
              <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(100, (getDaysRemaining(currentSub.expires_at) / (currentSub.plan?.duration_days || 30)) * 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plans */}
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-500" />
          الخطط المتاحة
        </h2>

        {plans.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">لا توجد خطط اشتراك متاحة حالياً</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {plans.map((plan, index) => {
              const isCurrentPlan = currentSub?.plan_id === plan.id;
              return (
                <Card
                  key={plan.id}
                  className={`overflow-hidden transition-shadow hover:shadow-lg ${isCurrentPlan ? "ring-2 ring-primary" : ""}`}
                >
                  <div className={`bg-gradient-to-r ${getPlanGradient(index)} p-4 text-white`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold">{plan.name_ar}</h3>
                      <div className="text-left">
                        <span className="text-2xl font-bold">
                          {plan.price.toLocaleString()}
                        </span>
                        <span className="text-xs mr-1">د.ع</span>
                      </div>
                    </div>
                    {plan.description_ar && (
                      <p className="text-white/80 text-sm mt-1">{plan.description_ar}</p>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span>مدة الاشتراك: {plan.duration_days} يوم</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span>خصم {plan.commission_discount}% على العمولة</span>
                      </div>
                      {plan.priority_rides && (
                        <div className="flex items-center gap-2 text-sm">
                          <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          <span>أولوية في استلام الطلبات</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        <span>
                          {Math.round(plan.price / plan.duration_days).toLocaleString()} د.ع / يوم
                        </span>
                      </div>
                    </div>

                    {isCurrentPlan ? (
                      <Button disabled className="w-full" variant="outline">
                        <Check className="w-4 h-4 ml-2" />
                        مشترك حالياً
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => handleSubscribe(plan)}
                        disabled={subscribing === plan.id}
                      >
                        {subscribing === plan.id ? (
                          <Loader2 className="w-4 h-4 animate-spin ml-2" />
                        ) : (
                          <Crown className="w-4 h-4 ml-2" />
                        )}
                        اشترك الآن
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
