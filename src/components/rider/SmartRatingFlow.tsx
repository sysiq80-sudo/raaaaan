import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Star, 
  ThumbsUp, 
  ThumbsDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle,
  Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from "framer-motion";

interface SmartRatingFlowProps {
  rideId: string;
  driverId: string | null;
  driverName: string;
  onComplete: () => void;
  onSkip: () => void;
}

interface QuickQuestion {
  id: string;
  text: string;
  icon: string;
  category: string;
}

const SmartRatingFlow = ({
  rideId,
  driverId,
  driverName,
  onComplete,
  onSkip
}: SmartRatingFlowProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState<'rating' | 'questions' | 'comment' | 'done'>('rating');
  const [rating, setRating] = useState(5);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, boolean | null>>({});
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  // Dynamic questions based on season
  const getQuestions = (): QuickQuestion[] => {
    const currentMonth = new Date().getMonth();
    const isSummer = currentMonth >= 4 && currentMonth <= 9; // May-October

    return [
      { id: 'cleanliness', text: 'هل كانت السيارة نظيفة؟', icon: '🧹', category: 'النظافة' },
      { 
        id: 'climate', 
        text: isSummer ? 'هل كان التكييف يعمل بشكل جيد؟' : 'هل كانت التدفئة مناسبة؟', 
        icon: isSummer ? '❄️' : '🔥', 
        category: 'الراحة' 
      },
      { id: 'safe_driving', text: 'هل كانت القيادة آمنة ومريحة؟', icon: '🚗', category: 'القيادة' },
      { id: 'traffic_rules', text: 'هل التزم السائق بقواعد المرور؟', icon: '🚦', category: 'السلامة' },
      { id: 'respectful', text: 'هل كان السائق محترماً في الحديث؟', icon: '💬', category: 'التواصل' },
      { id: 'privacy', text: 'هل احترم السائق خصوصيتك؟', icon: '🤫', category: 'الخصوصية' },
    ];
  };

  const questions = getQuestions();
  const currentQuestion = questions[currentQuestionIndex];
  const displayRating = hoveredRating || rating;

  const ratingMessages = {
    5: { text: 'ممتاز!', emoji: '🌟', color: 'text-green-500' },
    4: { text: 'جيد جداً', emoji: '👍', color: 'text-green-400' },
    3: { text: 'متوسط', emoji: '😐', color: 'text-amber-500' },
    2: { text: 'يحتاج تحسين', emoji: '😕', color: 'text-orange-500' },
    1: { text: 'سيء', emoji: '😞', color: 'text-red-500' }
  };

  const currentMessage = ratingMessages[displayRating as keyof typeof ratingMessages];

  // Trigger confetti on mount
  useEffect(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00d9a5', '#00b389', '#fbbf24', '#f59e0b']
    });
  }, []);

  const handleAnswer = (answer: boolean) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: answer }));
    
    if (currentQuestionIndex < questions.length - 1) {
      setTimeout(() => setCurrentQuestionIndex(prev => prev + 1), 300);
    } else {
      // If rating is 3 or lower, show comment step
      if (rating <= 3) {
        setStep('comment');
      } else {
        handleSubmit();
      }
    }
  };

  const handleSubmit = async () => {
    if (!driverId) {
      onComplete();
      return;
    }
    
    setLoading(true);
    
    try {
      // Update ride with rating
      const { error: rideError } = await supabase
        .from("rides")
        .update({ driver_rating: rating })
        .eq("id", rideId);

      if (rideError) throw rideError;

      // Get rider profile
      const { data: profile } = await supabase.auth.getUser();
      if (profile?.user) {
        const { data: riderProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", profile.user.id)
          .maybeSingle();

        if (riderProfile) {
          // Insert into ride_ratings with feedback
          const { error: ratingError } = await supabase.from("ride_ratings").insert({
            ride_id: rideId,
            rating: rating,
            comment: comment.trim() || JSON.stringify(answers),
            driver_id: driverId,
            rider_id: riderProfile.id
          });
          
          if (ratingError) {
            console.error("Rating insert error:", ratingError);
          }
        }
      }

      // Update driver's average rating
      await updateDriverAverageRating(driverId);

      setStep('done');
      
      toast({
        title: "شكراً لتقييمك! ⭐",
        description: "تقييمك يساعدنا على تحسين الخدمة"
      });

      setTimeout(() => onComplete(), 1500);

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

  const updateDriverAverageRating = async (driverId: string) => {
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

  // Done screen
  if (step === 'done') {
    return (
      <div className="flex flex-col items-center justify-center py-12 animate-in zoom-in-50 duration-500">
        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
          <Sparkles className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-foreground">شكراً لك!</h2>
        <p className="text-muted-foreground mt-2">نتمنى لك رحلة سعيدة قادمة 🚗</p>
      </div>
    );
  }

  // Rating step
  if (step === 'rating') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="font-bold text-lg mb-1">كيف كانت رحلتك؟</h3>
          <p className="text-sm text-muted-foreground">مع {driverName}</p>
        </div>
        
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
                className={`w-11 h-11 transition-colors ${
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
          <span className="text-4xl">{currentMessage.emoji}</span>
          <p className={`font-bold mt-2 text-lg ${currentMessage.color}`}>{currentMessage.text}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onSkip}
          >
            تخطي
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={() => setStep('questions')}
          >
            التالي
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Questions step
  if (step === 'questions') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="font-bold text-lg mb-1">أسئلة سريعة</h3>
          <p className="text-sm text-muted-foreground">اختياري - ساعدنا نحسّن الخدمة</p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5">
          {questions.map((_, idx) => (
            <div
              key={idx}
              className={`w-2 h-2 rounded-full transition-colors ${
                idx === currentQuestionIndex
                  ? 'bg-primary'
                  : idx < currentQuestionIndex
                  ? 'bg-primary/50'
                  : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Question Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.2 }}
            className="bg-card border border-border rounded-2xl p-6 text-center"
          >
            <div className="text-4xl mb-4">{currentQuestion.icon}</div>
            <p className="text-lg font-medium text-foreground mb-1">{currentQuestion.text}</p>
            <p className="text-xs text-muted-foreground">{currentQuestion.category}</p>

            {/* Answer buttons */}
            <div className="flex gap-4 mt-6 justify-center">
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleAnswer(false)}
                className="flex-1 max-w-[140px] gap-2 h-14 text-base border-destructive/30 hover:bg-destructive/10 hover:border-destructive"
              >
                <ThumbsDown className="w-5 h-5 text-destructive" />
                لا
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleAnswer(true)}
                className="flex-1 max-w-[140px] gap-2 h-14 text-base border-green-500/30 hover:bg-green-500/10 hover:border-green-500"
              >
                <ThumbsUp className="w-5 h-5 text-green-500" />
                نعم
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Skip questions */}
        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (rating <= 3) {
                setStep('comment');
              } else {
                handleSubmit();
              }
            }}
            className="text-muted-foreground"
          >
            تخطي الأسئلة
          </Button>
        </div>
      </div>
    );
  }

  // Comment step (for low ratings)
  if (step === 'comment') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="font-bold text-lg mb-1">ما الذي يمكننا تحسينه؟</h3>
          <p className="text-sm text-muted-foreground">ملاحظاتك تساعدنا على التطوير</p>
        </div>

        <Textarea
          placeholder="شاركنا تجربتك... (اختياري)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="min-h-[120px] resize-none rounded-xl text-base"
          maxLength={500}
          dir="rtl"
        />
        <p className="text-xs text-muted-foreground text-left">{comment.length}/500</p>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleSubmit}
            disabled={loading}
          >
            تخطي
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                إرسال التقييم
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

export default SmartRatingFlow;
