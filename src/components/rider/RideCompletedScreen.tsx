import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  MapPin,
  Route,
  Wallet,
  Clock,
  Bookmark,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SaveDestinationPrompt from "./SaveDestinationPrompt";
import SmartRatingFlow from "./SmartRatingFlow";
import confetti from "canvas-confetti";

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
  onClose,
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
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#00d9a5", "#00b389", "#fbbf24", "#f59e0b"],
    });
  }, []);

  const fare = ride.final_fare || ride.estimated_fare || 0;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" dir="rtl">
      {/* Header with success animation */}
      <div className="bg-gradient-to-b from-green-500/20 to-transparent pt-10 pb-6 px-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center animate-in zoom-in-50 duration-500">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-xl font-bold text-foreground">
            الحمد لله على السلامة! 🤲
          </h1>
          <p className="text-muted-foreground text-sm">شكراً لاستخدامك ران</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-4 space-y-5 overflow-y-auto">
        {/* Fare Summary */}
        <div className="bg-card rounded-md p-4 shadow-lg border border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">المبلغ الإجمالي</span>
            <span className="text-2xl font-bold text-primary">
              {fare.toLocaleString()} د.ع
            </span>
          </div>

          <div className="border-t border-border pt-3 grid grid-cols-3 gap-2 text-center">
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Route className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">المسافة</span>
              <span className="text-sm font-medium">
                {(ride.distance_km || 0).toFixed(1)} كم
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">المدة</span>
              <span className="text-sm font-medium">
                {ride.duration_minutes || 0} دقيقة
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-green-500" />
              </div>
              <span className="text-xs text-muted-foreground">الدفع</span>
              <span className="text-sm font-medium">نقداً</span>
            </div>
          </div>
        </div>

        {/* Trip Summary - Compact */}
        <div className="bg-card rounded-md p-3 border border-border">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-primary" />
              <div className="w-0.5 h-6 bg-border" />
              <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-sm text-foreground truncate">
                {ride.pickup_address}
              </p>
              <p className="text-sm text-foreground truncate">
                {ride.dropoff_address}
              </p>
            </div>
          </div>

          {/* Save destination button */}
          {ride.dropoff_address && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSavePrompt(true)}
              className="w-full gap-2 text-primary mt-2 h-8"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span className="text-xs">حفظ الوجهة</span>
            </Button>
          )}
        </div>

        {/* Smart Rating Flow */}
        <div className="bg-card rounded-md p-5 border border-border">
          <SmartRatingFlow
            rideId={ride.id}
            driverId={ride.driver_id}
            driverName={driverName}
            onComplete={onClose}
            onSkip={onClose}
          />
        </div>
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
            lng: 0,
          }}
        />
      )}
    </div>
  );
};

export default RideCompletedScreen;
