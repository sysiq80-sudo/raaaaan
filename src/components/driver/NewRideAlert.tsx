import { useState, useEffect } from "react";
import { X, MapPin, DollarSign, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface NewRideAlertProps {
  isVisible: boolean;
  onClose: () => void;
  onAccept: () => void;
  rideData?: {
    id: string;
    pickupLocation: string;
    dropoffLocation: string;
    fare: number;
    estimatedTime: string;
    distance: string;
  };
}

export const NewRideAlert = ({
  isVisible,
  onClose,
  onAccept,
  rideData,
}: NewRideAlertProps) => {
  const [timeLeft, setTimeLeft] = useState(30);
  const [isExpanding, setIsExpanding] = useState(false);

  // Play notification sound
  useEffect(() => {
    if (isVisible) {
      playNotificationSound();
      setTimeLeft(30);
      setIsExpanding(true);

      const timer = setTimeout(() => {
        setIsExpanding(false);
        setTimeout(() => {
          onClose();
        }, 300);
      }, 30000);

      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  // Countdown timer
  useEffect(() => {
    if (!isVisible || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible, timeLeft]);

  const playNotificationSound = () => {
    // Create a simple beep sound using Web Audio API
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Triple beep pattern
      const now = audioContext.currentTime;
      oscillator.frequency.value = 800;
      gainNode.gain.setValueAtTime(0.3, now);

      oscillator.start(now);
      oscillator.stop(now + 0.1);

      oscillator.start(now + 0.15);
      oscillator.stop(now + 0.25);

      oscillator.start(now + 0.3);
      oscillator.stop(now + 0.4);

      gainNode.gain.setValueAtTime(0, now + 0.4);
    } catch (error) {
      console.warn("Could not play notification sound:", error);
    }
  };

  if (!isVisible) return null;

  const handleAccept = () => {
    setIsExpanding(false);
    setTimeout(() => {
      onAccept();
      onClose();
    }, 300);
  };

  const handleReject = () => {
    setIsExpanding(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const progressPercentage = (timeLeft / 30) * 100;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        isVisible ? "bg-black/40 backdrop-blur-sm" : "bg-black/0 backdrop-blur-0"
      }`}
    >
      <Card
        className={`w-full max-w-sm border-2 border-green-500 shadow-2xl transition-all duration-300 transform ${
          isExpanding
            ? "scale-100 opacity-100"
            : "scale-95 opacity-0 pointer-events-none"
        }`}
      >
        <CardContent className="p-0">
          {/* Header with Timer */}
          <div className="relative bg-gradient-to-r from-green-600 to-green-500 px-6 py-4 text-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                <h3 className="font-bold text-lg">طلب رحلة جديد! 🎉</h3>
              </div>
              <button
                onClick={handleReject}
                className="hover:bg-white/20 p-1.5 rounded-lg transition-colors"
                aria-label="إغلاق تنبيه الطلب الجديد"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Timer Bar */}
            <div className="w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-100"
                style={{ width: `${progressPercentage}%` } as React.CSSProperties}
              />
            </div>

            {/* Timer Text */}
            <p className="text-sm text-white/80 mt-2 text-center font-semibold">
              {timeLeft} ثانية
            </p>
          </div>

          {/* Ride Details */}
          {rideData && (
            <div className="p-6 space-y-4">
              {/* Locations */}
              <div className="space-y-3">
                {/* Pickup */}
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground font-semibold">
                      نقطة الانطلاق
                    </p>
                    <p className="text-sm font-semibold truncate">
                      {rideData.pickupLocation}
                    </p>
                  </div>
                </div>

                {/* Vertical Line */}
                <div className="flex">
                  <div className="w-8 flex justify-center">
                    <div className="w-0.5 h-4 bg-border" />
                  </div>
                </div>

                {/* Dropoff */}
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground font-semibold">
                      وجهة الوصول
                    </p>
                    <p className="text-sm font-semibold truncate">
                      {rideData.dropoffLocation}
                    </p>
                  </div>
                </div>
              </div>

              {/* Ride Info Grid */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
                {/* Fare */}
                <div className="text-center">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-2">
                    <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-xs text-muted-foreground">الأجرة</p>
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                    {rideData.fare.toLocaleString()} د.ع
                  </p>
                </div>

                {/* Distance */}
                <div className="text-center">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-2">
                    <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-xs text-muted-foreground">المسافة</p>
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {rideData.distance}
                  </p>
                </div>

                {/* Time */}
                <div className="text-center">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-2">
                    <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="text-xs text-muted-foreground">الوقت</p>
                  <p className="text-sm font-bold text-purple-600 dark:text-purple-400">
                    {rideData.estimatedTime}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-border">
                <Button
                  onClick={handleReject}
                  variant="outline"
                  className="flex-1"
                >
                  رفض
                </Button>
                <Button
                  onClick={handleAccept}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                >
                  قبول الطلب
                </Button>
              </div>
            </div>
          )}

          {/* No Ride Data Fallback */}
          {!rideData && (
            <div className="p-6 flex flex-col items-center justify-center gap-3 text-center">
              <AlertCircle className="w-8 h-8 text-amber-500" />
              <p className="text-sm text-muted-foreground">
                طلب رحلة جديد متاح!
              </p>
              <div className="flex gap-3 w-full pt-2">
                <Button
                  onClick={handleReject}
                  variant="outline"
                  className="flex-1"
                >
                  رفض
                </Button>
                <Button
                  onClick={handleAccept}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                >
                  قبول
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
