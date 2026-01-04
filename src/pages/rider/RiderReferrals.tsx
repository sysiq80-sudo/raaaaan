/**
 * ران - صفحة الإحالات
 * تعرض كود الإحالة وإحصائيات المستخدم
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
    ArrowLeft,
    Gift,
    Users,
    Wallet,
    Clock,
    CheckCircle,
    Share2,
    Copy,
    TrendingUp,
    Trophy,
    Sparkles
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ReferralCard } from '@/components/rider/ReferralCard';
import logo from '@/assets/logo.png';

interface ReferralHistory {
    id: string;
    referredName: string;
    status: 'pending' | 'completed' | 'cancelled';
    reward: number;
    createdAt: string;
    completedAt: string | null;
}

const RiderReferrals: React.FC = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [userId, setUserId] = useState<string | null>(null);
    const [referralHistory, setReferralHistory] = useState<ReferralHistory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({
        totalReferrals: 0,
        totalEarned: 0,
        thisMonth: 0,
        pendingRewards: 0,
    });

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate('/rider/auth');
            return;
        }
        setUserId(user.id);
        fetchReferralData(user.id);
    };

    const fetchReferralData = async (uid: string) => {
        try {
            setIsLoading(true);

            // جلب الإحالات
            const { data: referrals, error } = await supabase
                .from('referrals')
                .select(`
          id,
          status,
          referrer_reward,
          created_at,
          completed_at,
          referred_id
        `)
                .eq('referrer_id', uid)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // تحويل البيانات
            const history: ReferralHistory[] = (referrals || []).map(r => ({
                id: r.id,
                referredName: 'مستخدم جديد', // يمكن جلب الاسم لاحقاً
                status: r.status as 'pending' | 'completed' | 'cancelled',
                reward: r.referrer_reward || 5000,
                createdAt: r.created_at,
                completedAt: r.completed_at,
            }));

            setReferralHistory(history);

            // حساب الإحصائيات
            const completed = history.filter(r => r.status === 'completed');
            const pending = history.filter(r => r.status === 'pending');
            const thisMonth = completed.filter(r => {
                const date = new Date(r.completedAt || r.createdAt);
                const now = new Date();
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            });

            setStats({
                totalReferrals: completed.length,
                totalEarned: completed.reduce((sum, r) => sum + r.reward, 0),
                thisMonth: thisMonth.length,
                pendingRewards: pending.reduce((sum, r) => sum + r.reward, 0),
            });

        } catch (error) {
            console.error('Error fetching referrals:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusBadge = (status: ReferralHistory['status']) => {
        switch (status) {
            case 'completed':
                return <Badge className="bg-success/10 text-success border-success/30">مكتمل</Badge>;
            case 'pending':
                return <Badge className="bg-warning/10 text-warning border-warning/30">في الانتظار</Badge>;
            case 'cancelled':
                return <Badge className="bg-destructive/10 text-destructive border-destructive/30">ملغي</Badge>;
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ar-IQ', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Header */}
            <div className="bg-gradient-primary p-4 pt-8 pb-20 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-20">
                    <div className="absolute top-4 right-4">
                        <Sparkles className="w-32 h-32 opacity-30" />
                    </div>
                    <div className="absolute bottom-4 left-4">
                        <Gift className="w-24 h-24 opacity-20" />
                    </div>
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate('/rider')}
                            className="h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <Gift className="w-6 h-6 text-white" />
                            <h1 className="text-xl font-bold text-white">أدعُ واربح</h1>
                        </div>
                    </div>
                    <p className="text-white/80 text-sm mr-12">
                        احصل على 5,000 د.ع لكل صديق يسجل ويكمل أول رحلة
                    </p>
                </div>
            </div>

            {/* المحتوى */}
            <div className="px-4 -mt-14 relative z-20">
                {/* بطاقة الإحالة */}
                {userId && <ReferralCard userId={userId} />}

                {/* الإحصائيات */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="grid grid-cols-2 gap-3 mt-4"
                >
                    <Card className="border-border/30">
                        <CardContent className="p-4 text-center">
                            <div className="w-10 h-10 mx-auto rounded-xl bg-success/10 flex items-center justify-center mb-2">
                                <Trophy className="w-5 h-5 text-success" />
                            </div>
                            <p className="text-2xl font-bold text-foreground">{stats.totalReferrals}</p>
                            <p className="text-xs text-muted-foreground">إحالة ناجحة</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/30">
                        <CardContent className="p-4 text-center">
                            <div className="w-10 h-10 mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                                <Wallet className="w-5 h-5 text-primary" />
                            </div>
                            <p className="text-2xl font-bold text-foreground">{stats.totalEarned.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">د.ع مكتسب</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/30">
                        <CardContent className="p-4 text-center">
                            <div className="w-10 h-10 mx-auto rounded-xl bg-info/10 flex items-center justify-center mb-2">
                                <TrendingUp className="w-5 h-5 text-info" />
                            </div>
                            <p className="text-2xl font-bold text-foreground">{stats.thisMonth}</p>
                            <p className="text-xs text-muted-foreground">هذا الشهر</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/30">
                        <CardContent className="p-4 text-center">
                            <div className="w-10 h-10 mx-auto rounded-xl bg-warning/10 flex items-center justify-center mb-2">
                                <Clock className="w-5 h-5 text-warning" />
                            </div>
                            <p className="text-2xl font-bold text-foreground">{stats.pendingRewards.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">د.ع في الانتظار</p>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* سجل الإحالات */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-6"
                >
                    <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        سجل الإحالات
                    </h2>

                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <Skeleton key={i} className="h-20 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : referralHistory.length > 0 ? (
                        <div className="space-y-3">
                            {referralHistory.map((referral, index) => (
                                <motion.div
                                    key={referral.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                >
                                    <Card className="border-border/30">
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
                                                        <Users className="w-5 h-5 text-muted-foreground" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-foreground">{referral.referredName}</p>
                                                        <p className="text-xs text-muted-foreground">{formatDate(referral.createdAt)}</p>
                                                    </div>
                                                </div>
                                                <div className="text-left">
                                                    {getStatusBadge(referral.status)}
                                                    <p className="text-sm font-bold text-primary mt-1">
                                                        +{referral.reward.toLocaleString()} د.ع
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <Card className="border-border/30">
                            <CardContent className="p-8 text-center">
                                <div className="w-16 h-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center mb-4">
                                    <Users className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <h3 className="font-bold text-foreground mb-2">لا توجد إحالات بعد</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    شارك كود الإحالة الخاص بك وابدأ بربح المكافآت
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </motion.div>

                {/* نصائح */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mt-6 mb-6"
                >
                    <Card className="border-primary/20 bg-primary/5">
                        <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <Sparkles className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-foreground mb-1">نصيحة للمزيد من الأرباح</h3>
                                    <p className="text-sm text-muted-foreground">
                                        شارك كودك في مجموعات الواتساب والفيسبوك المحلية للوصول لأكبر عدد من الأصدقاء!
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
};

export default RiderReferrals;
