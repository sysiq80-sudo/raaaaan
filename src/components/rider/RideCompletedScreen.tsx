import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle, 
  MapPin,
  Route,
  Wallet,
  Clock,
  Bookmark,
  Sparkles,
  Heart,
  Home,
  Star
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SaveDestinationPrompt from "./SaveDestinationPrompt";
import SmartRatingFlow from "./SmartRatingFlow";
import confetti from 'canvas-confetti';

interface RideCompletedScreenProps {
  ride: {
    id: string;
    pickup_address: string | null;
    dropoff_address: string | null;
    final_fare: number | null;
    estimated_fare: number | null;
    distance_km: number | null;
    duration_minutes: number | null;
    driver_id: string | null;
  };
  driverName: string;
  onClose: () => void;
}

export const RideCompletedScreen = ({
  ride,
  driverName,
  onClose
}: RideCompletedScreenProps) => {
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Get user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id);
    });
  }, []);

  // Trigger confetti on mount
  useEffect(() => {
    // First burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00d9a5', '#00b389', '#fbbf24', '#f59e0b']
    });
    
    // Second burst after delay
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#00d9a5', '#00b389']
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#fbbf24', '#f59e0b']
      });
    }, 250);
  }, []);

  const fare = ride.final_fare || ride.estimated_fare || 0;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-gradient-to-b from-background via-background to-primary/5 flex flex-col overflow-hidden" 
      dir="rtl"
    >
      {/* Header with success animation */}
      <div className="relative bg-gradient-to-b from-emerald-500/20 via-emerald-500/10 to-transparent pt-12 pb-8 px-6">
        {/* Decorative circles */}
        <div className="absolute top-10 right-10 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl" />
        <div className="absolute top-16 left-8 w-16 h-16 bg-amber-500/10 rounded-full blur-2xl" />
        
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="text-center space-y-4"
        >
          <div className="relative mx-auto w-fit">
            <div className="absolute inset-0 bg-emerald-500/30 rounded-full blur-xl animate-pulse" />
            <div className="relative w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
          </div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h1 className="text-2xl font-bold text-foreground mb-1">الحمد لله على السلامة! 🤲</h1>
            <p className="text-muted-foreground">شكراً لاستخدامك ران</p>
          </motion.div>
        </motion.div>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 py-4 space-y-4 overflow-y-auto pb-8">
        {/* Fare Summary Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-card to-card/80 rounded-3xl p-5 shadow-xl border-2 border-primary/20"
        >
          {/* Main Fare */}
          <div className="text-center mb-5">
            <p className="text-sm text-muted-foreground mb-1">المبلغ الإجمالي</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-4xl font-bold bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
                {fare.toLocaleString()}
              </span>
              <span className="text-lg text-muted-foreground">د.ع</span>
            </div>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-secondary/50"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center">
                <Route className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-center">
                <span className="text-lg font-bold text-foreground">{(ride.distance_km || 0).toFixed(1)}</span>
                <p className="text-xs text-muted-foreground">كم</p>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-secondary/50"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div className="text-center">
                <span className="text-lg font-bold text-foreground">{ride.duration_minutes || 0}</span>
                <p className="text-xs text-muted-foreground">دقيقة</p>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-secondary/50"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-center">
                <span className="text-sm font-bold text-foreground">نقداً</span>
                <p className="text-xs text-muted-foreground">الدفع</p>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Trip Summary Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card rounded-2xl p-4 border border-border/50 shadow-lg"
        >
          <div className="flex items-center gap-4">
            {/* Route Indicators */}
            <div className="flex flex-col items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-gradient-to-br from-primary to-emerald-500 shadow-lg shadow-primary/30" />
              <div className="w-0.5 h-10 bg-gradient-to-b from-primary/50 to-rose-500/50" />
              <div className="w-3 h-3 rounded-full bg-gradient-to-br from-rose-500 to-red-600 shadow-lg shadow-rose-500/30" />
            </div>
            
            {/* Addresses */}
            <div className="flex-1 min-w-0 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">من</p>
                <p className="text-sm font-medium text-foreground truncate">{ride.pickup_address}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">إلى</p>
                <p className="text-sm font-medium text-foreground truncate">{ride.dropoff_address}</p>
              </div>
            </div>
          </div>
          
          {/* Save destination button */}
          {ride.dropoff_address && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSavePrompt(true)}
              className="w-full gap-2 text-primary mt-4 h-10 rounded-xl bg-primary/5 hover:bg-primary/10"
            >
              <Bookmark className="w-4 h-4" />
              <span className="text-sm font-medium">حفظ هذه الوجهة</span>
            </Button>
          )}
        </motion.div>

        {/* Smart Rating Flow */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-br from-card to-card/80 rounded-3xl p-5 border-2 border-amber-500/20 shadow-xl"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Star className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">قيّم تجربتك</h3>
              <p className="text-xs text-muted-foreground">ساعدنا في تحسين الخدمة</p>
            </div>
          </div>
          
          <SmartRatingFlow
            rideId={ride.id}
            driverId={ride.driver_id}
            driverName={driverName}
            onComplete={onClose}
            onSkip={onClose}
          />
        </motion.div>
        
        {/* Return Home Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full h-14 rounded-2xl gap-2 border-2 hover:bg-primary/10 hover:border-primary/50"
          >
            <Home className="w-5 h-5" />
            <span className="font-medium">العودة للرئيسية</span>
          </Button>
        </motion.div>
      </div>

      {/* Save Destination Prompt */}
      {userId && ride.dropoff_address && (
        <SaveDestinationPrompt
          isOpen={showSavePrompt}
          onClose={() => setShowSavePrompt(false)}
          userId={userId}
          destination={{
            address: ride.dropoff_address,
            lat: 0,
            lng: 0
          }}
        />
      )}
    </motion.div>
  );
};

export default RideCompletedScreen;
