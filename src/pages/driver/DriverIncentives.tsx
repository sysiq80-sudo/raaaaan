import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Gift, Trophy, Target, Clock, CheckCircle2, Star } from "lucide-react";

interface IncentiveProgress {
  incentive_id: string;
  name: string;
  description: string | null;
  period: string;
  rides_required: number;
  bonus_amount: number;
  rides_completed: number;
  is_claimed: boolean;
  period_start: string;
  period_end: string;
}

const DriverIncentives = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [incentives, setIncentives] = useState<IncentiveProgress[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);

  useEffect(() => {
    fetchDriverId();
  }, []);

  useEffect(() => {
    if (driverId) {
      fetchIncentives();
    }
  }, [driverId]);

  const fetchDriverId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/driver/auth");
      return;
    }

    const { data: driver } = await supabase
      .from("drivers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (driver) {
      setDriverId(driver.id);
    }
  };

  const fetchIncentives = async () => {
    if (!driverId) return;

    try {
      // جلب تقدم الحوافز
      const { data: progressData, error: progressError } = await supabase
        .rpc("get_driver_incentive_progress", { p_driver_id: driverId });

      if (progressError) throw progressError;
      setIncentives(progressData || []);

      // جلب إجمالي المكافآت المكتسبة
      const { data: claimsData } = await supabase
        .from("driver_incentive_claims")
        .select("bonus_earned")
        .eq("driver_id", driverId);

      const total = (claimsData || []).reduce((sum, c) => sum + c.bonus_earned, 0);
      setTotalEarned(total);
    } catch (error) {
      console.error("Error fetching incentives:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case "daily": return "يومي";
      case "weekly": return "أسبوعي";
      case "monthly": return "شهري";
      default: return period;
    }
  };

  const getPeriodIcon = (period: string) => {
    switch (period) {
      case "daily": return <Clock className="h-4 w-4" />;
      case "weekly": return <Target className="h-4 w-4" />;
      case "monthly": return <Trophy className="h-4 w-4" />;
      default: return <Gift className="h-4 w-4" />;
    }
  };

  const getPeriodColor = (period: string) => {
    switch (period) {
      case "daily": return "bg-blue-500";
      case "weekly": return "bg-purple-500";
      case "monthly": return "bg-amber-500";
      default: return "bg-primary";
    }
  };

  const getProgressPercent = (completed: number, required: number) => {
    return Math.min((completed / required) * 100, 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-primary text-primary-foreground p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full bg-primary-foreground/20" />
            <Skeleton className="h-6 w-32 bg-primary-foreground/20" />
          </div>
        </div>
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const dailyIncentives = incentives.filter(i => i.period === "daily");
  const weeklyIncentives = incentives.filter(i => i.period === "weekly");
  const monthlyIncentives = incentives.filter(i => i.period === "monthly");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/driver")}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowRight className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">المكافآت والحوافز</h1>
        </div>

        <Card className="bg-primary-foreground/10 border-0 text-primary-foreground">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">إجمالي المكافآت المكتسبة</p>
                <p className="text-3xl font-bold">{totalEarned.toLocaleString()} د.ع</p>
              </div>
              <div className="p-3 rounded-full bg-primary-foreground/20">
                <Trophy className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-4 space-y-6">
        {/* الحوافز اليومية */}
        {dailyIncentives.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-5 w-5 text-blue-500" />
              <h2 className="font-bold text-lg">الحوافز اليومية</h2>
            </div>
            <div className="space-y-3">
              {dailyIncentives.map((incentive) => (
                <IncentiveCard key={incentive.incentive_id} incentive={incentive} />
              ))}
            </div>
          </div>
        )}

        {/* الحوافز الأسبوعية */}
        {weeklyIncentives.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-5 w-5 text-purple-500" />
              <h2 className="font-bold text-lg">الحوافز الأسبوعية</h2>
            </div>
            <div className="space-y-3">
              {weeklyIncentives.map((incentive) => (
                <IncentiveCard key={incentive.incentive_id} incentive={incentive} />
              ))}
            </div>
          </div>
        )}

        {/* الحوافز الشهرية */}
        {monthlyIncentives.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-5 w-5 text-amber-500" />
              <h2 className="font-bold text-lg">الحوافز الشهرية</h2>
            </div>
            <div className="space-y-3">
              {monthlyIncentives.map((incentive) => (
                <IncentiveCard key={incentive.incentive_id} incentive={incentive} />
              ))}
            </div>
          </div>
        )}

        {incentives.length === 0 && (
          <div className="text-center py-12">
            <Gift className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">لا توجد حوافز متاحة حالياً</p>
          </div>
        )}
      </div>
    </div>
  );
};

const IncentiveCard = ({ incentive }: { incentive: IncentiveProgress }) => {
  const progress = Math.min((incentive.rides_completed / incentive.rides_required) * 100, 100);
  const remaining = Math.max(incentive.rides_required - incentive.rides_completed, 0);

  const getPeriodColor = (period: string) => {
    switch (period) {
      case "daily": return "bg-blue-500";
      case "weekly": return "bg-purple-500";
      case "monthly": return "bg-amber-500";
      default: return "bg-primary";
    }
  };

  return (
    <Card className={`overflow-hidden ${incentive.is_claimed ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold">{incentive.name}</h3>
              {incentive.is_claimed && (
                <Badge className="bg-green-500 text-white">
                  <CheckCircle2 className="h-3 w-3 ml-1" />
                  تم الحصول عليها
                </Badge>
              )}
            </div>
            {incentive.description && (
              <p className="text-sm text-muted-foreground">{incentive.description}</p>
            )}
          </div>
          <div className="text-left">
            <p className="text-lg font-bold text-green-600">{incentive.bonus_amount.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">د.ع</p>
          </div>
        </div>

        {!incentive.is_claimed && (
          <>
            <div className="mb-2">
              <Progress 
                value={progress} 
                className="h-3"
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {incentive.rides_completed} / {incentive.rides_required} رحلة
              </span>
              {remaining > 0 ? (
                <span className="text-primary font-medium">
                  متبقي {remaining} رحلات
                </span>
              ) : (
                <span className="text-green-600 font-medium flex items-center gap-1">
                  <Star className="h-4 w-4" />
                  مكتمل!
                </span>
              )}
            </div>
          </>
        )}

        {incentive.is_claimed && (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            <span>تمت إضافة المكافأة لمحفظتك</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DriverIncentives;
