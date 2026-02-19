import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  CheckCircle, 
  Star, 
  MessageSquare, 
  Loader2,
  Wallet,
  Route,
  Clock,
  Sparkles,
  Send
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DriverRideCompletedProps {
  ride: {
    id: string;
    final_fare: number;
    distance_km: number | null;
    duration_minutes: number | null;
    rider_id: string;
  };
  riderName: string;
  onClose: () => void;
}

export const DriverRideCompleted = ({
  ride,
  riderName,
  onClose
}: DriverRideCompletedProps) => {
  const { toast } = useToast();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Celebration animation
  useEffect(() => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQEcR6zg5N95ER9TsuHf1XQLAFe34NzWcxAAXLvg2tRwDwBgu+DZ1HAQAFu74NnUbxAAXLvg2dRwEABbu+Da1HAP');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    
    try {
      const { data: riderProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", ride.rider_id)
        .maybeSingle();

      if (riderProfile) {
        await supabase
          .from("rides")
          .update({ rider_rating: rating })
          .eq("id", ride.id);

        const { data: driver } = await supabase
          .from("drivers")
          .select("id")
          .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
          .maybeSingle();

        if (driver) {
          await supabase.from("ride_ratings").insert({
            ride_id: ride.id,
            rating: rating,
            comment: comment.trim() || null,
            driver_id: driver.id,
            rider_id: riderProfile.id
          });
        }
      }

      setSubmitted(true);
      
      toast({
        title: "شكراً لتقييمك! ⭐",
        description: "تم حفظ التقييم بنجاح"
      });

      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (error: any) {
      console.error("Rating error:", error);
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const ratingMessages: Record<number, { text: string; emoji: string; color: string }> = {
    5: { text: 'راكب ممتاز!', emoji: '🌟', color: 'text-green-500' },
    4: { text: 'جيد جداً', emoji: '👍', color: 'text-green-400' },
    3: { text: 'متوسط', emoji: '😐', color: 'text-amber-500' },
    2: { text: 'يحتاج تحسين', emoji: '😕', color: 'text-orange-500' },
    1: { text: 'سيء', emoji: '😞', color: 'text-red-500' }
  };

  const currentMessage = ratingMessages[rating];

  // استخدام Portal لإخراج الشاشة من stacking context الأب
  const content = submitted ? (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-6" dir="rtl">
      <div className="text-center space-y-4 animate-in zoom-in-50 duration-500">
        <div className="w-24 h-24 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
          <Sparkles className="w-12 h-12 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">أحسنت!</h2>
        <p className="text-muted-foreground">أرباحك تتراكم، استمر بالعمل الرائع</p>
      </div>
    </div>
  ) : (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col overflow-hidden" dir="rtl">
      {/* Success Header */}
      <div className="bg-gradient-to-b from-green-500/30 via-green-500/10 to-transparent pt-8 pb-5 px-6">
        <div className="text-center space-y-2">
          <div className="text-5xl animate-in zoom-in-50 duration-700">🎉</div>
          <h1 className="text-2xl font-bold text-green-400">الحمد لله على السلامة! 🤲</h1>
          <p className="text-sm text-muted-foreground">أوصلت الراكب بسلام - أحسنت! رحلة مكتملة بنجاح</p>
        </div>
      </div>

      {/* Content - scrollable */}
      <div className="flex-1 px-4 py-3 space-y-4 overflow-y-auto pb-32">
        {/* Earnings Card */}
        <div className="bg-gradient-to-br from-green-500/20 via-green-500/10 to-transparent rounded-2xl p-4 border border-green-500/30 text-center">
          <p className="text-xs text-muted-foreground mb-1">أرباح هذه الرحلة</p>
          <div className="flex items-center justify-center gap-2">
            <Wallet className="w-6 h-6 text-green-500" />
            <span className="text-3xl font-bold text-green-500">
              +{ride.final_fare.toLocaleString()}
            </span>
            <span className="text-lg text-green-500">د.ع</span>
          </div>
        </div>

        {/* Trip Stats */}
        <div className="bg-card rounded-2xl p-3 border border-border">
          <div className="flex items-center justify-around">
            <div className="text-center">
              <div className="w-9 h-9 mx-auto mb-1 rounded-full bg-primary/10 flex items-center justify-center">
                <Route className="w-4 h-4 text-primary" />
              </div>
              <p className="text-lg font-bold text-foreground">{(ride.distance_km || 0).toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">كيلومتر</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="text-center">
              <div className="w-9 h-9 mx-auto mb-1 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <p className="text-lg font-bold text-foreground">{ride.duration_minutes || 0}</p>
              <p className="text-xs text-muted-foreground">دقيقة</p>
            </div>
          </div>
        </div>

        {/* Rating Section */}
        <div className="bg-card rounded-2xl p-4 border border-border space-y-3">
          <h3 className="font-bold text-center text-sm">كيف كان الراكب {riderName}؟</h3>
          
          {/* Stars */}
          <div className="flex justify-center items-center gap-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="transition-transform duration-200 active:scale-90"
              >
                <Star
                  className={`w-11 h-11 transition-all duration-200 ${
                    star <= rating
                      ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]'
                      : 'text-muted-foreground/20'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Rating Message */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">{currentMessage.emoji}</span>
            <p className={`font-bold text-base ${currentMessage.color}`}>{currentMessage.text}</p>
          </div>

          {/* Comment Section */}
          {!showComment ? (
            <button
              type="button"
              onClick={() => setShowComment(true)}
              className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm">أضف ملاحظة (اختياري)</span>
            </button>
          ) : (
            <div className="space-y-1.5">
              <Textarea
                placeholder="أي ملاحظات عن الراكب؟"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[70px] resize-none rounded-xl text-sm"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-left">
                {comment.length}/500
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions — ثابت في الأسفل */}
      <div className="sticky bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <div className="flex gap-3 max-w-lg mx-auto">
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground px-6"
            onClick={onClose}
            disabled={loading}
          >
            تخطي
          </Button>
          <Button
            className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white h-12 text-base font-bold rounded-xl shadow-lg shadow-green-600/20"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5" />
                إرسال التقييم
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default DriverRideCompleted;
