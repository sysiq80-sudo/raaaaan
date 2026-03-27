/**
 * ران - مكون نظام الإحالات
 * يعرض كود الإحالة الخاص بالمستخدم وإحصائياته
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Gift,
    Copy,
    Share2,
    Users,
    Wallet,
    CheckCircle,
    Clock,
    QrCode,
    Sparkles
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ReferralData {
    code: string;
    totalReferrals: number;
    totalEarned: number;
    pendingReferrals: number;
    completedReferrals: number;
}

interface ReferralCardProps {
    userId: string;
    variant?: 'full' | 'compact';
}

export const ReferralCard: React.FC<ReferralCardProps> = ({
    userId,
    variant = 'full'
}) => {
    const { toast } = useToast();
    const [referralData, setReferralData] = useState<ReferralData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        fetchReferralData();
    }, [userId]);

    const fetchReferralData = async () => {
        try {
            setIsLoading(true);

            // جلب أو إنشاء كود الإحالة
            let { data: codeData, error: codeError } = await supabase
                .from('referral_codes')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (codeError && codeError.code === 'PGRST116') {
                // لا يوجد كود، أنشئ واحد
                const { data: newCode, error: createError } = await supabase
                    .rpc('generate_referral_code', { p_user_id: userId });

                if (!createError && newCode) {
                    // جلب البيانات مرة أخرى
                    const { data } = await supabase
                        .from('referral_codes')
                        .select('*')
                        .eq('user_id', userId)
                        .single();
                    codeData = data;
                }
            }

        if (codeData) {
            // جلب إحصائيات الإحالات
            const { data: referralsData } = await supabase
                .from('referrals')
                .select('status, referrer_reward')
                .eq('referrer_id', userId);

            const pending = referralsData?.filter(r => r.status === 'pending').length || 0;
            const completed = referralsData?.filter(r => r.status === 'completed').length || 0;
            const totalEarned = referralsData?.filter(r => r.status === 'completed')
                .reduce((sum, r) => sum + (r.referrer_reward || 0), 0) || 0;

            setReferralData({
                code: codeData.code,
                totalReferrals: codeData.usage_count || 0,
                totalEarned: totalEarned,
                pendingReferrals: pending,
                completedReferrals: completed,
            });
            }
        } catch (error) {
            console.error('Error fetching referral data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const copyCode = async () => {
        if (!referralData?.code) return;

        try {
            await navigator.clipboard.writeText(referralData.code);
            setIsCopied(true);
            toast({
                title: "✅ تم النسخ",
                description: "تم نسخ كود الإحالة",
            });
            setTimeout(() => setIsCopied(false), 2000);
        } catch {
            toast({
                title: "فشل النسخ",
                description: "حاول مرة أخرى",
                variant: "destructive",
            });
        }
    };

    const shareCode = async () => {
        if (!referralData?.code) return;

        const shareText = `انضم لتطبيق ران واحصل على 5,000 د.ع مجاناً! استخدم كود الإحالة: ${referralData.code}\n\nحمّل التطبيق الآن: https://raan.app`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'دعوة لتطبيق ران',
                    text: shareText,
                });
            } catch {
                // المستخدم ألغى المشاركة
            }
        } else {
            // نسخ للحافظة إذا لم يكن المشاركة متاحة
            await navigator.clipboard.writeText(shareText);
            toast({
                title: "✅ تم النسخ",
                description: "تم نسخ رسالة الدعوة",
            });
        }
    };

    if (isLoading) {
        return (
            <Card className="border-primary/20">
                <CardHeader className="pb-3">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-12 w-full mb-4" />
                    <div className="grid grid-cols-3 gap-3">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!referralData) {
        return null;
    }

    if (variant === 'compact') {
        return (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Gift className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">كود الإحالة</p>
                                <p className="text-lg font-bold text-primary">{referralData.code}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={copyCode}>
                                {isCopied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </Button>
                            <Button size="sm" onClick={shareCode} className="bg-gradient-primary">
                                <Share2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <Card className="border-primary/20 overflow-hidden">
                {/* رأس البطاقة مع تدرج */}
                <div className="bg-gradient-primary p-4 text-white relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full opacity-20">
                        <div className="absolute top-2 right-2">
                            <Sparkles className="w-24 h-24 opacity-30" />
                        </div>
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <Gift className="w-5 h-5" />
                            <h3 className="font-bold">أدعُ أصدقاءك واربح!</h3>
                        </div>
                        <p className="text-sm text-white/80">
                            احصل على 5,000 د.ع لكل صديق يسجل ويكمل أول رحلة
                        </p>
                    </div>
                </div>

                <CardContent className="p-4">
                    {/* كود الإحالة */}
                    <div className="mb-4">
                        <label className="text-xs text-muted-foreground mb-2 block">كود الإحالة الخاص بك</label>
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <Input
                                    value={referralData.code}
                                    readOnly
                                    className="text-center text-lg font-bold tracking-widest bg-muted/50"
                                />
                            </div>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={copyCode}
                                className={isCopied ? 'bg-success text-success-foreground' : ''}
                            >
                                {isCopied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </Button>
                            <Button
                                size="icon"
                                onClick={shareCode}
                                className="bg-gradient-primary shadow-glow"
                            >
                                <Share2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* الإحصائيات */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="text-center p-3 bg-muted/30 rounded-xl">
                            <div className="flex justify-center mb-1">
                                <Users className="w-5 h-5 text-primary" />
                            </div>
                            <p className="text-lg font-bold text-foreground">{referralData.totalReferrals}</p>
                            <p className="text-xs text-muted-foreground">إحالة ناجحة</p>
                        </div>
                        <div className="text-center p-3 bg-muted/30 rounded-xl">
                            <div className="flex justify-center mb-1">
                                <Clock className="w-5 h-5 text-warning" />
                            </div>
                            <p className="text-lg font-bold text-foreground">{referralData.pendingReferrals}</p>
                            <p className="text-xs text-muted-foreground">في الانتظار</p>
                        </div>
                        <div className="text-center p-3 bg-muted/30 rounded-xl">
                            <div className="flex justify-center mb-1">
                                <Wallet className="w-5 h-5 text-success" />
                            </div>
                            <p className="text-lg font-bold text-foreground">{referralData.totalEarned.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">د.ع مكتسب</p>
                        </div>
                    </div>

                    {/* كيفية العمل */}
                    <div className="border-t border-border/30 pt-4">
                        <p className="text-xs font-medium text-muted-foreground mb-3">كيف يعمل نظام الإحالة؟</p>
                        <div className="space-y-2">
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">1</div>
                                <span>شارك كودك مع أصدقائك</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">2</div>
                                <span>يسجل صديقك ويدخل الكود</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">3</div>
                                <span>عند إكمال أول رحلة، تحصلان على المكافأة!</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
};

/**
 * مكون إدخال كود الإحالة (للمستخدمين الجدد)
 */
interface ReferralInputProps {
    userId: string;
    onSuccess?: () => void;
}

export const ReferralInput: React.FC<ReferralInputProps> = ({ userId, onSuccess }) => {
    const { toast } = useToast();
    const [code, setCode] = useState('');
    const [isApplying, setIsApplying] = useState(false);
    const [isApplied, setIsApplied] = useState(false);

    useEffect(() => {
        checkIfAlreadyReferred();
    }, [userId]);

    const checkIfAlreadyReferred = async () => {
        const { data } = await supabase
            .from('referrals')
            .select('id')
            .eq('referred_id', userId)
            .single();

        if (data) {
            setIsApplied(true);
        }
    };

    const applyCode = async () => {
        if (!code.trim()) {
            toast({
                title: "أدخل كود الإحالة",
                variant: "destructive",
            });
            return;
        }

        setIsApplying(true);
        try {
            const { data, error } = await supabase
                .rpc('apply_referral', {
                    p_code: code.toUpperCase(),
                    p_referred_user_id: userId
                });

            if (error) throw error;

            const result = data as { success?: boolean; reward?: number; error?: string } | null;

            if (result?.success) {
                toast({
                    title: "🎉 تم تطبيق الكود بنجاح!",
                    description: `ستحصل على ${result.reward?.toLocaleString()} د.ع بعد أول رحلة`,
                });
                setIsApplied(true);
                onSuccess?.();
            } else {
                toast({
                    title: "فشل تطبيق الكود",
                    description: result?.error || "الكود غير صالح",
                    variant: "destructive",
                });
            }
        } catch (error) {
            toast({
                title: "حدث خطأ",
                description: "حاول مرة أخرى",
                variant: "destructive",
            });
        } finally {
            setIsApplying(false);
        }
    };

    if (isApplied) {
        return (
            <div className="flex items-center gap-2 p-3 bg-success/10 rounded-xl text-success text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>تم تطبيق كود الإحالة بنجاح!</span>
            </div>
        );
    }

    return (
        <Card className="border-primary/20">
            <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Gift className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="font-medium">هل لديك كود إحالة؟</p>
                        <p className="text-xs text-muted-foreground">احصل على 5,000 د.ع مجاناً</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Input
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="RAANXXXX"
                        className="font-mono tracking-widest"
                        maxLength={8}
                    />
                    <Button
                        onClick={applyCode}
                        disabled={isApplying || !code.trim()}
                        className="bg-gradient-primary"
                    >
                        {isApplying ? (
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            'تطبيق'
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default ReferralCard;
