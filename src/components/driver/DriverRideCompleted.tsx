import { useState, useEffect } from "react";
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
  PartyPopper
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
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Celebration animation
  useEffect(() => {
    // Play success sound
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQEcR6zg5N95ER9TsuHf1XQLAFe34NzWcxAAXLvg2tRwDwBgu+DZ1HAQAFu74NnUbxAAXLvg2dRwEABbu+Da1HAP');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    
    try {
      // Get rider's profile id
      const { data: riderProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", ride.rider_id)
        .maybeSingle();

      if (riderProfile) {
        // Update ride with rider rating
        await supabase
          .from("rides")
          .update({ rider_rating: rating })
          .eq("id", ride.id);

        // Get driver id
        const { data: driver } = await supabase
          .from("drivers")
          .select("id")
          .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
          .maybeSingle();

        if (driver) {
          // Insert rating
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

  const displayRating = hoveredRating || rating;

  const ratingMessages = {
    5: { text: 'راكب ممتاز!', emoji: '🌟', color: 'text-green-500' },
    4: { text: 'جيد جداً', emoji: '👍', color: 'text-green-400' },
    3: { text: 'متوسط', emoji: '😐', color: 'text-amber-500' },
    2: { text: 'يحتاج تحسين', emoji: '😕', color: 'text-orange-500' },
    1: { text: 'سيء', emoji: '😞', color: 'text-red-500' }
  };

  const currentMessage = ratingMessages[displayRating as keyof typeof ratingMessages];

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-4 animate-in zoom-in-50 duration-500">
          <div className="w-24 h-24 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
            <Sparkles className="w-12 h-12 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">أحسنت!</h2>
          <p className="text-muted-foreground">أرباحك تتراكم، استمر بالعمل الرائع</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden" dir="rtl">
      {/* Success Header */}
      <div className="bg-gradient-to-b from-green-500/30 via-green-500/10 to-transparent pt-12 pb-8 px-6">
        <div className="text-center space-y-4">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
            <div className="relative w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center animate-in zoom-in-50 duration-700">
              <PartyPopper className="w-12 h-12 text-green-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">الحمد لله على السلامة! 🤲</h1>
          <p className="text-lg text-foreground">أوصلت الراكب بسلام</p>
          <p className="text-muted-foreground">أحسنت! رحلة مكتملة بنجاح</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-4 space-y-6 overflow-y-auto">
        {/* Earnings Card */}
        <div className="bg-gradient-to-br from-green-500/20 via-green-500/10 to-transparent rounded-3xl p-6 border border-green-500/30 text-center">
          <p className="text-sm text-muted-foreground mb-2">أرباح هذه الرحلة</p>
          <div className="flex items-center justify-center gap-2">
            <Wallet className="w-8 h-8 text-green-500" />
            <span className="text-4xl font-bold text-green-500">
              +{ride.final_fare.toLocaleString()}
            </span>
            <span className="text-xl text-green-500">د.ع</span>
          </div>
        </div>

        {/* Trip Stats */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center justify-around">
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
                <Route className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xl font-bold text-foreground">{(ride.distance_km || 0).toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">كيلومتر</p>
            </div>
            <div className="w-px h-12 bg-border" />
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xl font-bold text-foreground">{ride.duration_minutes || 0}</p>
              <p className="text-xs text-muted-foreground">دقيقة</p>
            </div>
          </div>
        </div>

        {/* Rating Section */}
        <div className="bg-card rounded-2xl p-5 border border-border space-y-4">
          <h3 className="font-bold text-center">كيف كان الراكب {riderName}؟</h3>
          
          {/* Stars */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="p-1 transition-all duration-200 hover:scale-125 active:scale-95"
              >
                <Star
                  className={`w-10 h-10 transition-colors ${
                    star <= displayRating
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-muted-foreground/30'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Rating Message */}
          <div className="text-center">
            <span className="text-3xl">{currentMessage.emoji}</span>
            <p className={`font-bold mt-1 ${currentMessage.color}`}>{currentMessage.text}</p>
          </div>

          {/* Comment Section */}
          {!showComment ? (
            <button
              type="button"
              onClick={() => setShowComment(true)}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm">أضف ملاحظة (اختياري)</span>
            </button>
          ) : (
            <div className="space-y-2">
              <Textarea
                placeholder="أي ملاحظات عن الراكب؟"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[80px] resize-none rounded-xl"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-left">
                {comment.length}/500
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="p-6 border-t border-border bg-card/50 backdrop-blur-sm">
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
            className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                تأكيد
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DriverRideCompleted;
