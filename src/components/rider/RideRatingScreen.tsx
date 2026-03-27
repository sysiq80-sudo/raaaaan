import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, Send, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RideRatingScreenProps {
  rideId: string;
  driverId: string;
  driverName: string;
  driverImage?: string;
  fare: number;
  onClose: () => void;
}

const quickRatings = [
  { emoji: '😍', text: 'سائق محترف', category: 'professional' },
  { emoji: '🚗', text: 'سيارة نظيفة', category: 'clean_car' },
  { emoji: '⏱️', text: 'التزام بالوقت', category: 'on_time' },
  { emoji: '😊', text: 'تعامل لطيف', category: 'friendly' },
  { emoji: '🎶', text: 'اختيار موسيقى', category: 'music' },
  { emoji: '🌙', text: 'رحلة آمنة', category: 'safe' },
];

export const RideRatingScreen = ({
  rideId,
  driverId,
  driverName,
  driverImage,
  fare,
  onClose,
}: RideRatingScreenProps) => {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const toggleTag = (category: string) => {
    setSelectedTags((prev) =>
      prev.includes(category)
        ? prev.filter((t) => t !== category)
        : [...prev, category]
    );
  };

  const handleSubmitRating = async () => {
    if (rating === 0) {
      toast({
        title: 'تقييم مطلوب',
        description: 'يرجى اختيار عدد النجوم',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Save rating to database
      const { error } = await supabase.from('ride_ratings').insert({
        ride_id: rideId,
        driver_id: driverId,
        rating,
        comment: comment || null,
        tags: selectedTags,
      });

      if (error) throw error;

      // Update driver average rating
      const { data: driverRatings } = await supabase
        .from('ride_ratings')
        .select('rating')
        .eq('driver_id', driverId);

      if (driverRatings && driverRatings.length > 0) {
        const avgRating =
          driverRatings.reduce((sum, r) => sum + r.rating, 0) /
          driverRatings.length;

        await supabase
          .from('drivers')
          .update({ rating: parseFloat(avgRating.toFixed(1)) })
          .eq('id', driverId);
      }

      setIsSubmitted(true);

      toast({
        title: 'شكراً على تقييمك! 🙏',
        description: `تقييمك ${rating}⭐ سيساعد في تحسين الخدمة`,
        duration: 3000,
      });

      setTimeout(onClose, 2000);
    } catch (error) {
      console.error('Error saving rating:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء حفظ التقييم',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="w-full bg-gradient-to-t from-slate-900 via-slate-800 to-slate-700 rounded-t-3xl p-6 space-y-6"
          initial={{ y: 500 }}
          animate={{ y: 0 }}
          exit={{ y: 500 }}
          transition={{ type: 'spring', damping: 30 }}
        >
          {/* Success State */}
          <AnimatePresence>
            {isSubmitted && (
              <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-t-3xl bg-gradient-to-b from-emerald-900 to-emerald-800"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="text-6xl mb-4"
                >
                  ✅
                </motion.div>
                <p className="text-2xl font-bold text-white mb-2">
                  شكراً لك!
                </p>
                <p className="text-emerald-100">تقييمك يساعدنا على التحسّن</p>
              </motion.div>
            )}
          </AnimatePresence>

          {!isSubmitted && (
            <>
              {/* Header with Driver Info */}
              <div className="flex items-center gap-4 pb-4 border-b border-slate-600">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center overflow-hidden">
                  {driverImage ? (
                    <img src={driverImage} alt={driverName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-lg">
                      {driverName.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-white font-bold text-lg">{driverName}</h2>
                  <p className="text-emerald-400 text-sm">
                    أكمل رحلتك بنجاح ✓
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold text-lg">{fare} د.ع</p>
                  <p className="text-slate-400 text-xs">الإجمالي</p>
                </div>
              </div>

              {/* Rating Stars */}
              <div className="space-y-3">
                <p className="text-white font-semibold">كيف كانت الرحلة؟</p>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <motion.button
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.95 }}
                      className="p-1 transition-transform"
                    >
                      <Star
                        size={40}
                        className={`transition-all ${
                          star <= (hoveredRating || rating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-600'
                        }`}
                      />
                    </motion.button>
                  ))}
                </div>
                {rating > 0 && (
                  <p className="text-center text-emerald-400 text-sm">
                    تقييمك: {rating} نجوم ⭐
                  </p>
                )}
              </div>

              {/* Quick Tags */}
              <div className="space-y-2">
                <p className="text-white font-semibold text-sm">
                  (اختياري) أضف ملاحظة سريعة:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {quickRatings.map((item) => (
                    <motion.button
                      key={item.category}
                      onClick={() => toggleTag(item.category)}
                      whileTap={{ scale: 0.95 }}
                      className={`p-2 rounded-lg transition-all border-2 ${
                        selectedTags.includes(item.category)
                          ? 'border-emerald-500 bg-emerald-500/20'
                          : 'border-slate-600 bg-slate-700'
                      } hover:border-emerald-500`}
                    >
                      <div className="text-2xl mb-1">{item.emoji}</div>
                      <p className="text-xs text-white leading-tight">
                        {item.text}
                      </p>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Comment Box */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-slate-400" />
                  <p className="text-white font-semibold text-sm">
                    (اختياري) اكتب ملاحظة:
                  </p>
                </div>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="أخبرنا رأيك... هل تريد أن تضيف شيئاً؟"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500"
                  rows={3}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                  disabled={isSubmitting}
                >
                  تخطي
                </Button>
                <Button
                  onClick={handleSubmitRating}
                  disabled={rating === 0 || isSubmitting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  <Send size={16} />
                  {isSubmitting ? 'جاري الحفظ...' : 'إرسال التقييم'}
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RideRatingScreen;
