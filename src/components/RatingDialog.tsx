import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Star, Loader2, MessageSquare } from "lucide-react";

interface RatingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  rideId: string;
  ratingType: 'driver' | 'rider';
  targetId: string; // driver_id or rider_id
  targetName?: string;
}

export const RatingDialog = ({
  isOpen,
  onClose,
  rideId,
  ratingType,
  targetId,
  targetName
}: RatingDialogProps) => {
  const { toast } = useToast();
  const [rating, setRating] = useState(5);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    
    try {
      // Update ride with rating
      const updateData = ratingType === 'driver' 
        ? { driver_rating: rating }
        : { rider_rating: rating };

      const { error: rideError } = await supabase
        .from("rides")
        .update(updateData)
        .eq("id", rideId);

      if (rideError) throw rideError;

      // Insert into ride_ratings table with comment
      const { error: ratingError } = await supabase
        .from("ride_ratings")
        .insert({
          ride_id: rideId,
          rating: rating,
          comment: comment.trim() || null,
          driver_id: ratingType === 'driver' ? targetId : null,
          rider_id: ratingType === 'rider' ? targetId : null
        });

      if (ratingError) {
        console.error("Rating insert error:", ratingError);
        // Don't throw - ride was updated successfully
      }

      // Update driver's average rating if rating driver
      if (ratingType === 'driver') {
        await updateDriverAverageRating(targetId);
      }

      toast({
        title: "شكراً لتقييمك! ⭐",
        description: "تم حفظ تقييمك بنجاح"
      });

      onClose();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateDriverAverageRating = async (driverId: string) => {
    // Get all completed rides for this driver with ratings
    const { data: rides } = await supabase
      .from("rides")
      .select("driver_rating")
      .eq("driver_id", driverId)
      .eq("status", "completed")
      .not("driver_rating", "is", null);

    if (rides && rides.length > 0) {
      const totalRating = rides.reduce((sum, r) => sum + (r.driver_rating || 0), 0);
      const avgRating = Math.round((totalRating / rides.length) * 10) / 10;

      await supabase
        .from("drivers")
        .update({ rating: avgRating })
        .eq("id", driverId);
    }
  };

  const displayRating = hoveredRating || rating;

  const ratingMessages = {
    5: { text: 'ممتاز!', emoji: '🌟', placeholder: 'ما الذي أعجبك بشكل خاص؟' },
    4: { text: 'جيد جداً', emoji: '👍', placeholder: 'كيف يمكن تحسين التجربة؟' },
    3: { text: 'متوسط', emoji: '😐', placeholder: 'ما الذي يمكن تحسينه؟' },
    2: { text: 'يحتاج تحسين', emoji: '😕', placeholder: 'ما المشكلة التي واجهتها؟' },
    1: { text: 'سيء', emoji: '😞', placeholder: 'ما الذي حدث؟ نعتذر عن ذلك.' }
  };

  const currentMessage = ratingMessages[displayRating as keyof typeof ratingMessages];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            {ratingType === 'driver' ? 'قيّم السائق' : 'قيّم الراكب'}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-center text-muted-foreground mb-4">
            كيف كانت تجربتك مع {targetName || (ratingType === 'driver' ? 'السائق' : 'الراكب')}؟
          </p>

          {/* Stars */}
          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={`w-10 h-10 transition-colors ${
                    star <= displayRating
                      ? 'text-warning fill-warning'
                      : 'text-muted-foreground/30'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Rating Text */}
          <div className="text-center mb-4">
            <span className="text-3xl">{currentMessage.emoji}</span>
            <p className="text-lg font-bold text-foreground mt-1">{currentMessage.text}</p>
          </div>

          {/* Comment Section */}
          {!showComment ? (
            <button
              type="button"
              onClick={() => setShowComment(true)}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm">أضف تعليقاً (اختياري)</span>
            </button>
          ) : (
            <div className="space-y-2">
              <Textarea
                placeholder={currentMessage.placeholder}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[80px] resize-none"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-left">
                {comment.length}/500
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={loading}
          >
            تخطي
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'إرسال التقييم'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RatingDialog;
