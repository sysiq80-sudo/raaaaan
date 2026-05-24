/**
 * ران - مكون التقييم المتقدم
 * تقييم متعدد الأبعاد مع tags وتعليقات
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Star, ThumbsUp, ThumbsDown, Sparkles, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ReviewTag {
    id: string;
    tag_ar: string;
    tag_type: 'positive' | 'negative' | 'neutral';
    icon: string;
}

interface AdvancedRatingProps {
    rideId: string;
    driverName?: string;
    driverRating?: number;
    vehicleInfo?: string;
    reviewerType: 'rider' | 'driver';
    onComplete?: () => void;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export const AdvancedRatingDialog: React.FC<AdvancedRatingProps> = ({
    rideId,
    driverName = 'السائق',
    driverRating,
    vehicleInfo,
    reviewerType,
    onComplete,
    isOpen,
    onOpenChange,
}) => {
    const { toast } = useToast();
    const [step, setStep] = useState<'overall' | 'detailed' | 'tags' | 'comment'>('overall');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // التقييمات
    const [overallRating, setOverallRating] = useState(0);
    const [cleanlinessRating, setCleanlinessRating] = useState(0);
    const [drivingRating, setDrivingRating] = useState(0);
    const [communicationRating, setCommunicationRating] = useState(0);
    const [punctualityRating, setPunctualityRating] = useState(0);

    // Tags والتعليق
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [comment, setComment] = useState('');
    const [availableTags, setAvailableTags] = useState<ReviewTag[]>([]);

    useEffect(() => {
        if (isOpen) {
            fetchTags();
        }
    }, [isOpen]);

    const fetchTags = async () => {
        const appliesTo = reviewerType === 'rider' ? 'driver' : 'rider';
        const { data, error } = await supabase
            .from('review_tags')
            .select('id, tag_ar, tag_type, icon')
            .or(`applies_to.eq.${appliesTo},applies_to.eq.both`)
            .eq('is_active', true);

        if (!error && data) {
            setAvailableTags(data as ReviewTag[]);
        }
    };

    const handleSubmit = async () => {
        if (overallRating === 0) {
            toast({
                title: "يرجى اختيار التقييم",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { error } = await supabase
                .from('ride_reviews')
                .insert({
                    ride_id: rideId,
                    reviewer_id: user.id,
                    reviewer_type: reviewerType,
                    overall_rating: overallRating,
                    cleanliness_rating: cleanlinessRating || null,
                    driving_rating: drivingRating || null,
                    communication_rating: communicationRating || null,
                    punctuality_rating: punctualityRating || null,
                    comment: comment.trim() || null,
                    tags: selectedTags,
                });

            if (error) throw error;

            toast({
                title: "✨ شكراً لتقييمك!",
                description: "تقييمك يساعدنا على تحسين الخدمة",
            });

            onOpenChange(false);
            onComplete?.();
        } catch (error) {
            console.error('Error submitting review:', error);
            toast({
                title: "خطأ في إرسال التقييم",
                description: "حاول مرة أخرى",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleTag = (tagId: string) => {
        setSelectedTags(prev =>
            prev.includes(tagId)
                ? prev.filter(t => t !== tagId)
                : [...prev, tagId]
        );
    };

    const StarRating: React.FC<{
        value: number;
        onChange: (value: number) => void;
        size?: 'sm' | 'md' | 'lg';
        showLabel?: boolean;
    }> = ({ value, onChange, size = 'md', showLabel = false }) => {
        const [hoverValue, setHoverValue] = useState(0);

        const sizeClasses = {
            sm: 'w-6 h-6',
            md: 'w-10 h-10',
            lg: 'w-14 h-14',
        };

        const labels = ['', 'سيء', 'مقبول', 'جيد', 'جيد جداً', 'ممتاز'];

        return (
            <div className="flex flex-col items-center gap-2">
                <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <motion.button
                            key={star}
                            type="button"
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                            onMouseEnter={() => setHoverValue(star)}
                            onMouseLeave={() => setHoverValue(0)}
                            onClick={() => onChange(star)}
                            className="focus:outline-none"
                        >
                            <Star
                                className={`${sizeClasses[size]} transition-colors ${star <= (hoverValue || value)
                                        ? 'fill-yellow-400 text-yellow-400'
                                        : 'text-muted-foreground/30'
                                    }`}
                            />
                        </motion.button>
                    ))}
                </div>
                {showLabel && (hoverValue || value) > 0 && (
                    <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm font-medium text-primary"
                    >
                        {labels[hoverValue || value]}
                    </motion.p>
                )}
            </div>
        );
    };

    const renderStep = () => {
        switch (step) {
            case 'overall':
                return (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="text-center py-6"
                    >
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                            <Sparkles className="w-10 h-10 text-primary" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">
                            كيف كانت رحلتك مع {driverName}؟
                        </h3>
                        {vehicleInfo && (
                            <p className="text-sm text-muted-foreground mb-6">{vehicleInfo}</p>
                        )}

                        <StarRating
                            value={overallRating}
                            onChange={setOverallRating}
                            size="lg"
                            showLabel
                        />

                        <div className="flex gap-3 mt-8">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => onOpenChange(false)}
                            >
                                لاحقاً
                            </Button>
                            <Button
                                className="flex-1 bg-gradient-primary"
                                onClick={() => setStep('detailed')}
                                disabled={overallRating === 0}
                            >
                                التالي
                            </Button>
                        </div>
                    </motion.div>
                );

            case 'detailed':
                return (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="py-4"
                    >
                        <h3 className="text-lg font-bold mb-4 text-center">تقييم تفصيلي (اختياري)</h3>

                        <div className="space-y-4">
                            {reviewerType === 'rider' && (
                                <>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">نظافة السيارة</span>
                                        <StarRating
                                            value={cleanlinessRating}
                                            onChange={setCleanlinessRating}
                                            size="sm"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">أسلوب القيادة</span>
                                        <StarRating
                                            value={drivingRating}
                                            onChange={setDrivingRating}
                                            size="sm"
                                        />
                                    </div>
                                </>
                            )}
                            <div className="flex items-center justify-between">
                                <span className="text-sm">التواصل</span>
                                <StarRating
                                    value={communicationRating}
                                    onChange={setCommunicationRating}
                                    size="sm"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm">الالتزام بالموعد</span>
                                <StarRating
                                    value={punctualityRating}
                                    onChange={setPunctualityRating}
                                    size="sm"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setStep('overall')}
                            >
                                رجوع
                            </Button>
                            <Button
                                className="flex-1 bg-gradient-primary"
                                onClick={() => setStep('tags')}
                            >
                                التالي
                            </Button>
                        </div>
                    </motion.div>
                );

            case 'tags':
                return (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="py-4"
                    >
                        <h3 className="text-lg font-bold mb-4 text-center">ما الذي أعجبك؟</h3>

                        {/* Tags إيجابية */}
                        <div className="mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <ThumbsUp className="w-4 h-4 text-success" />
                                <span className="text-sm font-medium">إيجابي</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {availableTags
                                    .filter(t => t.tag_type === 'positive')
                                    .map(tag => (
                                        <Badge
                                            key={tag.id}
                                            variant={selectedTags.includes(tag.id) ? 'default' : 'outline'}
                                            className={`cursor-pointer transition-all ${selectedTags.includes(tag.id)
                                                    ? 'bg-success text-success-foreground'
                                                    : 'hover:bg-success/10'
                                                }`}
                                            onClick={() => toggleTag(tag.id)}
                                        >
                                            {tag.icon} {tag.tag_ar}
                                        </Badge>
                                    ))}
                            </div>
                        </div>

                        {/* Tags سلبية */}
                        <div className="mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <ThumbsDown className="w-4 h-4 text-destructive" />
                                <span className="text-sm font-medium">يحتاج تحسين</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {availableTags
                                    .filter(t => t.tag_type === 'negative')
                                    .map(tag => (
                                        <Badge
                                            key={tag.id}
                                            variant={selectedTags.includes(tag.id) ? 'default' : 'outline'}
                                            className={`cursor-pointer transition-all ${selectedTags.includes(tag.id)
                                                    ? 'bg-destructive text-destructive-foreground'
                                                    : 'hover:bg-destructive/10'
                                                }`}
                                            onClick={() => toggleTag(tag.id)}
                                        >
                                            {tag.icon} {tag.tag_ar}
                                        </Badge>
                                    ))}
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setStep('detailed')}
                            >
                                رجوع
                            </Button>
                            <Button
                                className="flex-1 bg-gradient-primary"
                                onClick={() => setStep('comment')}
                            >
                                التالي
                            </Button>
                        </div>
                    </motion.div>
                );

            case 'comment':
                return (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="py-4"
                    >
                        <h3 className="text-lg font-bold mb-4 text-center">أي ملاحظات إضافية؟</h3>

                        <Textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="شاركنا رأيك... (اختياري)"
                            rows={4}
                            className="resize-none"
                            maxLength={500}
                        />
                        <p className="text-xs text-muted-foreground text-left mt-1">
                            {comment.length}/500
                        </p>

                        <div className="flex gap-3 mt-6">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setStep('tags')}
                            >
                                رجوع
                            </Button>
                            <Button
                                className="flex-1 bg-gradient-primary shadow-glow"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 ml-2" />
                                        إرسال التقييم
                                    </>
                                )}
                            </Button>
                        </div>
                    </motion.div>
                );
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                        تقييم الرحلة
                    </DialogTitle>
                </DialogHeader>

                {/* Progress indicator */}
                <div className="flex gap-1 mb-4">
                    {['overall', 'detailed', 'tags', 'comment'].map((s, i) => (
                        <div
                            key={s}
                            className={`h-1 flex-1 rounded-full transition-colors ${['overall', 'detailed', 'tags', 'comment'].indexOf(step) >= i
                                    ? 'bg-primary'
                                    : 'bg-muted'
                                }`}
                        />
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    {renderStep()}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
};

export default AdvancedRatingDialog;
