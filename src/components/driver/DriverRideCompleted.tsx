import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
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

  // صوت الاحتفال مع data: URI مسموح به الآن في CSP
  useEffect(() => {
    const audio = new Audio(
      'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQEcR6zg5N95ER9TsuHf1XQLAFe34NzWcxAAXLvg2tRwDwBgu+DZ1HAQAFu74NnUbxAAXLvg2dRwEABbu+Da1HAP'
    );
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

        const { data: { user } } = await supabase.auth.getUser();
        const { data: driver } = await supabase
          .from("drivers")
          .select("id")
          .eq("user_id", user?.id)
          .maybeSingle();

        if (driver) {
          await supabase.from("ride_ratings").insert({
            ride_id: ride.id,
            rating,
            comment: comment.trim() || null,
            driver_id: driver.id,
            rider_id: riderProfile.id
          });
        }
      }

      setSubmitted(true);
      toast({ title: "شكراً لتقييمك! ⭐", description: "تم حفظ التقييم بنجاح" });
      setTimeout(() => onClose(), 2000);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "حدث خطأ";
      toast({ title: "خطأ", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const ratingMessages: Record<number, { text: string; emoji: string; color: string }> = {
    5: { text: 'راكب ممتاز!', emoji: '🌟', color: 'text-green-400' },
    4: { text: 'جيد جداً', emoji: '👍', color: 'text-green-400' },
    3: { text: 'متوسط', emoji: '😐', color: 'text-amber-500' },
    2: { text: 'يحتاج تحسين', emoji: '😕', color: 'text-orange-500' },
    1: { text: 'سيء', emoji: '😞', color: 'text-red-500' }
  };

  const currentMessage = ratingMessages[rating];

  // ─── شاشة النجاح بعد الإرسال ───
  if (submitted) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center" dir="rtl">
        <div className="text-center space-y-4 animate-in zoom-in-50 duration-500 px-6">
          <div className="w-24 h-24 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
            <Sparkles className="w-12 h-12 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">أحسنت!</h2>
          <p className="text-muted-foreground">أرباحك تتراكم، استمر بالعمل الرائع 💪</p>
        </div>
      </div>,
      document.body
    );
  }

  // ─── الشاشة الرئيسية ───
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col overflow-hidden" dir="rtl">

      {/* ═══ هيدر الاحتفال ═══ */}
      <div className="bg-gradient-to-b from-green-500/25 via-green-500/8 to-transparent pt-safe-top pt-8 pb-4 px-5 text-center shrink-0">
        <div className="text-4xl mb-2 animate-bounce">🎉</div>
        <h1 className="text-xl font-bold text-green-400">الحمد لله على السلامة! 🤲</h1>
        <p className="text-xs text-muted-foreground mt-1">رحلة ناجحة — أحسنت!</p>
      </div>

      {/* ═══ المحتوى القابل للتمرير ═══ */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

        {/* بطاقة الأرباح */}
        <div className="bg-gradient-to-br from-green-500/20 via-green-500/10 to-transparent rounded-none p-4 border border-green-500/30 text-center">
          <p className="text-xs text-muted-foreground mb-1">أرباح هذه الرحلة</p>
          <div className="flex items-center justify-center gap-2">
            <Wallet className="w-6 h-6 text-green-500" />
            <span className="text-3xl font-bold text-green-400">
              +{ride.final_fare.toLocaleString()}
            </span>
            <span className="text-base text-green-400">د.ع</span>
          </div>
        </div>

        {/* إحصائيات الرحلة */}
        <div className="bg-card rounded-none border border-border">
          <div className="flex items-center divide-x divide-x-reverse divide-border">
            <div className="flex-1 text-center py-3 px-4">
              <div className="w-8 h-8 mx-auto mb-1 rounded-full bg-primary/10 flex items-center justify-center">
                <Route className="w-4 h-4 text-primary" />
              </div>
              <p className="text-base font-bold">{(ride.distance_km || 0).toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">كيلومتر</p>
            </div>
            <div className="flex-1 text-center py-3 px-4">
              <div className="w-8 h-8 mx-auto mb-1 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <p className="text-base font-bold">{ride.duration_minutes || 0}</p>
              <p className="text-xs text-muted-foreground">دقيقة</p>
            </div>
          </div>
        </div>

        {/* قسم التقييم */}
        <div className="bg-card rounded-none p-4 border border-border space-y-3">
          <h3 className="font-bold text-center text-sm">كيف كان الراكب {riderName}؟</h3>

          {/* النجوم */}
          <div className="flex justify-center items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="p-1 transition-transform duration-150 active:scale-90 hover:scale-110"
              >
                <Star
                  className={`w-10 h-10 transition-all duration-200 ${
                    star <= rating
                      ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]'
                      : 'text-muted-foreground/20'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* رسالة التقييم */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">{currentMessage.emoji}</span>
            <p className={`font-bold text-base ${currentMessage.color}`}>{currentMessage.text}</p>
          </div>

          {/* ملاحظة اختيارية */}
          {!showComment ? (
            <button
              type="button"
              onClick={() => setShowComment(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-none border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors text-sm"
            >
              <MessageSquare className="w-4 h-4" />
              أضف ملاحظة (اختياري)
            </button>
          ) : (
            <div className="space-y-1">
              <Textarea
                placeholder="أي ملاحظات عن الراكب؟"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[70px] resize-none rounded-xl text-sm"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-left">{comment.length}/500</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ أزرار الأسفل — حادة ممتدة مثل باقي المراحل ═══ */}
      <div className="shrink-0 flex w-full" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* زر تخطي */}
        <Button
          variant="ghost"
          className="h-16 flex-[0.3] rounded-none border-t border-border text-muted-foreground hover:bg-muted/50 text-base font-medium"
          onClick={onClose}
          disabled={loading}
        >
          تخطي
        </Button>

        {/* زر إرسال التقييم */}
        <Button
          className="h-16 flex-[0.7] rounded-none bg-green-600 hover:bg-green-700 text-white text-base font-bold gap-2 border-t border-green-700"
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
    </div>,
    document.body
  );
};

export default DriverRideCompleted;
