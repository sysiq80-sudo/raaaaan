/**
 * ران - قسم العروض والترويج المحسّن
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Gift, Percent, Zap, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Promotion {
    id: string;
    title: string;
    description: string;
    gradient: string;
    icon: React.ReactNode;
    cta: string;
}

const promotions: Promotion[] = [
    {
        id: "1",
        title: "خصم 20% على رحلتك الأولى",
        description: "جرّب ران الآن واحصل على خصم فوري",
        gradient: "from-primary to-blue-600",
        icon: <Percent className="w-8 h-8" />,
        cta: "احجز الآن"
    },
    {
        id: "2",
        title: "اربح نقاط مع كل رحلة",
        description: "اجمع النقاط واستبدلها برحلات مجانية",
        gradient: "from-amber-500 to-orange-600",
        icon: <Star className="w-8 h-8" />,
        cta: "تعرف أكثر"
    },
    {
        id: "3",
        title: "أدعو أصدقائك واربح",
        description: "احصل على 5000 د.ع لكل صديق يسجل",
        gradient: "from-green-500 to-emerald-600",
        icon: <Gift className="w-8 h-8" />,
        cta: "شارك الآن"
    },
    {
        id: "4",
        title: "توصيل سريع",
        description: "خدمة VIP مع سائقين مميزين",
        gradient: "from-purple-500 to-pink-600",
        icon: <Zap className="w-8 h-8" />,
        cta: "جرّب VIP"
    }
];

const PromotionsCarousel = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [autoPlay, setAutoPlay] = useState(true);

    useEffect(() => {
        if (!autoPlay) return;

        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % promotions.length);
        }, 4000);

        return () => clearInterval(timer);
    }, [autoPlay]);

    const goTo = (index: number) => {
        setCurrentIndex(index);
        setAutoPlay(false);
        setTimeout(() => setAutoPlay(true), 10000);
    };

    const goNext = () => goTo((currentIndex + 1) % promotions.length);
    const goPrev = () => goTo((currentIndex - 1 + promotions.length) % promotions.length);

    return (
        <div className="space-y-3">
            {/* Carousel */}
            <div className="relative overflow-hidden rounded-2xl">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.3 }}
                        className={`bg-gradient-to-r ${promotions[currentIndex].gradient} p-6 text-white`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                                {promotions[currentIndex].icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-lg mb-1">
                                    {promotions[currentIndex].title}
                                </h3>
                                <p className="text-sm text-white/80 mb-3">
                                    {promotions[currentIndex].description}
                                </p>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                                >
                                    {promotions[currentIndex].cta}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>

                {/* Navigation arrows */}
                <button
                    onClick={goPrev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
                <button
                    onClick={goNext}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
            </div>

            {/* Dots indicator */}
            <div className="flex justify-center gap-1.5">
                {promotions.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => goTo(index)}
                        className={`h-1.5 rounded-full transition-all ${index === currentIndex
                                ? 'w-6 bg-primary'
                                : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                            }`}
                    />
                ))}
            </div>
        </div>
    );
};

export default PromotionsCarousel;
