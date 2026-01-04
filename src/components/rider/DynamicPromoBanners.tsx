/**
 * ران - مكون عرض البانرات الترويجية
 * يجلب البانرات من قاعدة البيانات ويعرضها
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Crown, Gift, Percent } from "lucide-react";

interface PromoBanner {
    id: string;
    title: string;
    subtitle: string;
    button_text: string;
    discount_value: string;
    discount_label: string;
    gradient_from: string;
    gradient_via: string;
    gradient_to: string;
    icon_type: string;
    link_url: string;
}

// Gradient color mappings
const gradientMap: Record<string, string> = {
    'green-600': 'from-green-600',
    'emerald-500': 'via-emerald-500',
    'teal-600': 'to-teal-600',
    'blue-600': 'from-blue-600',
    'purple-600': 'from-purple-600',
    'violet-500': 'via-violet-500',
    'indigo-600': 'to-indigo-600',
    'pink-500': 'from-pink-500',
    'rose-600': 'from-rose-600',
    'amber-500': 'from-amber-500',
    'orange-500': 'from-orange-500',
    'red-600': 'from-red-600',
};

const DynamicPromoBanners = () => {
    const [banners, setBanners] = useState<PromoBanner[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBanners = async () => {
            try {
                const { data, error } = await supabase
                    .from('promo_banners')
                    .select('*')
                    .eq('is_active', true)
                    .order('display_order', { ascending: true });

                if (error) throw error;
                setBanners(data || []);
            } catch (error) {
                console.error('Error fetching banners:', error);
                // Fallback to default banners if table doesn't exist
                setBanners([
                    {
                        id: '1',
                        title: 'عروض مذهلة!',
                        subtitle: 'تسوق الآن واحصل على خصم',
                        button_text: 'اجعل الرياض',
                        discount_value: '40%',
                        discount_label: 'خصم على',
                        gradient_from: 'green-600',
                        gradient_via: 'emerald-500',
                        gradient_to: 'teal-600',
                        icon_type: 'sparkles',
                        link_url: ''
                    }
                ]);
            } finally {
                setLoading(false);
            }
        };

        fetchBanners();
    }, []);

    const getIcon = (iconType: string) => {
        switch (iconType) {
            case 'crown': return <Crown className="w-5 h-5 text-yellow-300" />;
            case 'gift': return <Gift className="w-5 h-5 text-yellow-300" />;
            case 'percent': return <Percent className="w-5 h-5 text-yellow-300" />;
            default: return <Sparkles className="w-5 h-5 text-yellow-300" />;
        }
    };

    const getGradientClass = (from: string, via: string, to: string) => {
        // Build dynamic gradient
        return `from-${from} via-${via} to-${to}`;
    };

    if (loading || banners.length === 0) {
        return null;
    }

    return (
        <>
            {banners.map((banner, index) => (
                <motion.div
                    key={banner.id}
                    className="relative overflow-hidden rounded-3xl"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                >
                    {/* Dynamic Gradient Background */}
                    <div
                        className={`absolute inset-0 bg-gradient-to-br ${getGradientClass(banner.gradient_from, banner.gradient_via, banner.gradient_to)}`}
                        style={{
                            background: `linear-gradient(135deg, 
                var(--tw-gradient-from, hsl(142, 76%, 36%)) 0%, 
                var(--tw-gradient-via, hsl(160, 84%, 39%)) 50%, 
                var(--tw-gradient-to, hsl(173, 80%, 40%)) 100%)`
                        }}
                    />

                    {/* Decorative Blurs */}
                    <div className="absolute inset-0 opacity-20">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-2xl" />
                        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/20 rounded-full blur-2xl" />
                    </div>

                    {/* Content */}
                    <div className="relative p-5 flex items-center justify-between">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                {getIcon(banner.icon_type)}
                                <span className="text-yellow-300 font-bold text-lg">{banner.title}</span>
                            </div>
                            <p className="text-white/90 text-sm mb-3">{banner.subtitle}</p>
                            {banner.button_text && (
                                <button
                                    onClick={() => banner.link_url && window.open(banner.link_url, '_blank')}
                                    className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl text-white text-sm font-medium transition-colors"
                                >
                                    {banner.button_text}
                                </button>
                            )}
                        </div>

                        {/* Discount Circle */}
                        {banner.discount_value && (
                            <div className="relative">
                                <div className="w-20 h-20 rounded-full bg-yellow-400 flex items-center justify-center shadow-xl">
                                    <span className="text-green-800 font-black text-2xl">{banner.discount_value}</span>
                                </div>
                                {banner.discount_label && (
                                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-white/80 text-xs whitespace-nowrap">
                                        {banner.discount_label}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>
            ))}
        </>
    );
};

export default DynamicPromoBanners;
