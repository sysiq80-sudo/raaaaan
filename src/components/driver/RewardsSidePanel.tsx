import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, Trophy, Target, Clock, CheckCircle2, Star, X, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

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

interface RewardsSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  driverId: string | null;
}

const getPeriodIcon = (period: string) => {
  switch (period) {
    case 'daily': return <Clock className="h-4 w-4 text-blue-500" />;
    case 'weekly': return <Target className="h-4 w-4 text-purple-500" />;
    case 'monthly': return <Trophy className="h-4 w-4 text-amber-500" />;
    default: return <Gift className="h-4 w-4" />;
  }
};

const getPeriodLabel = (period: string) => {
  switch (period) {
    case 'daily': return 'يومي';
    case 'weekly': return 'أسبوعي';
    case 'monthly': return 'شهري';
    default: return period;
  }
};

const getPeriodBgColor = (period: string) => {
  switch (period) {
    case 'daily': return 'from-blue-500/10 to-blue-600/5 border-blue-500/20';
    case 'weekly': return 'from-purple-500/10 to-purple-600/5 border-purple-500/20';
    case 'monthly': return 'from-amber-500/10 to-amber-600/5 border-amber-500/20';
    default: return 'from-primary/10 to-primary/5 border-primary/20';
  }
};

export function RewardsSidePanel({ isOpen, onClose, driverId }: RewardsSidePanelProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [incentives, setIncentives] = useState<IncentiveProgress[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);

  useEffect(() => {
    if (!isOpen || !driverId) return;

    const fetchIncentives = async () => {
      setLoading(true);
      try {
        // جلب تقدم الحوافز
        const { data: progressData, error: progressError } = await supabase
          .rpc('get_driver_incentive_progress', { p_driver_id: driverId });

        if (progressError) throw progressError;
        setIncentives(progressData || []);

        // جلب إجمالي المكافآت المكتسبة
        const { data: claimsData } = await supabase
          .from('driver_incentive_claims')
          .select('bonus_earned')
          .eq('driver_id', driverId);

        const total = (claimsData || []).reduce((sum: number, c: { bonus_earned: number }) => sum + c.bonus_earned, 0);
        setTotalEarned(total);
      } catch (error) {
        console.error('Error fetching incentives:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchIncentives();
  }, [isOpen, driverId]);

  if (!isOpen) return null;

  const handleGoToFullPage = () => {
    onClose();
    navigate('/driver/incentives');
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute top-0 left-0 h-full w-80 bg-card shadow-xl animate-slide-in-left overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-amber-500" />
            <h4 className="font-bold text-lg">المكافآت والحوافز</h4>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-accent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Total Earned Summary */}
        <div className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-b border-amber-500/20 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">إجمالي المكافآت المكتسبة</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {loading ? '...' : `${totalEarned.toLocaleString('en-US')} د.ع`}
              </p>
            </div>
            <div className="p-3 rounded-full bg-amber-500/20">
              <Trophy className="h-6 w-6 text-amber-500" />
            </div>
          </div>
        </div>

        {/* Incentives List */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          ) : incentives.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground p-4">
              <Gift className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">لا توجد حوافز متاحة حالياً</p>
            </div>
          ) : (
            <div className="p-3 space-y-3">
              {incentives.map((incentive) => {
                const progress = Math.min((incentive.rides_completed / incentive.rides_required) * 100, 100);
                const remaining = Math.max(incentive.rides_required - incentive.rides_completed, 0);

                return (
                  <div
                    key={incentive.incentive_id}
                    className={`p-3 rounded-xl bg-gradient-to-br border ${getPeriodBgColor(incentive.period)} ${
                      incentive.is_claimed ? 'opacity-70' : ''
                    }`}
                  >
                    {/* Name + Period + Amount */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {getPeriodIcon(incentive.period)}
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{incentive.name}</p>
                          <p className="text-[10px] text-muted-foreground">{getPeriodLabel(incentive.period)}</p>
                        </div>
                      </div>
                      <div className="text-left flex-shrink-0">
                        <p className="text-sm font-bold text-green-600 dark:text-green-400">
                          {incentive.bonus_amount.toLocaleString('en-US')}
                        </p>
                        <p className="text-[10px] text-muted-foreground">د.ع</p>
                      </div>
                    </div>

                    {/* Progress */}
                    {incentive.is_claimed ? (
                      <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>تم الحصول عليها</span>
                      </div>
                    ) : (
                      <>
                        <Progress value={progress} className="h-2 mb-1.5" />
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">
                            {incentive.rides_completed} / {incentive.rides_required} رحلة
                          </span>
                          {remaining > 0 ? (
                            <span className="text-primary font-medium">متبقي {remaining}</span>
                          ) : (
                            <span className="text-green-600 font-medium flex items-center gap-0.5">
                              <Star className="h-3 w-3" /> مكتمل!
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer — Go to full page */}
        <div className="p-3 border-t border-border flex-shrink-0">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleGoToFullPage}
          >
            <ArrowLeft className="h-4 w-4" />
            عرض التفاصيل الكاملة
          </Button>
        </div>
      </div>
    </div>
  );
}
