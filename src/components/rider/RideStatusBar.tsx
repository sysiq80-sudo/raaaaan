import {
  Clock,
  Car,
  CheckCircle,
  Navigation,
  Loader2,
  Bell,
  MapPin,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface RideStatusBarProps {
  status: string;
  estimatedArrival: number | null;
  countdownSeconds: number | null;
  showArrivedAlert: boolean;
  remainingDistance?: number | null;
  onMyWay: () => void;
  sendQuickMessage: (event: string, title: string, description: string) => void;
}

const RideStatusBar = ({
  status,
  estimatedArrival,
  countdownSeconds,
  showArrivedAlert,
  remainingDistance,
  onMyWay,
  sendQuickMessage,
}: RideStatusBarProps) => {
  const formatTime = (seconds: number | null) => {
    if (seconds === null || seconds <= 0) return "0 دقيقة";
    const mins = Math.floor(seconds / 60);
    if (mins < 1) return "أقل من دقيقة";
    return `${mins} دقيقة`;
  };

  const formatDistance = (km: number | null | undefined) => {
    if (!km) return "--";
    if (km < 1) return `${Math.round(km * 1000)} م`;
    return `${km.toFixed(1)} كم`;
  };

  if (status === "arrived") {
    return (
      <div
        className={`mx-4 mt-3 mb-2 bg-green-500/10 backdrop-blur-2xl border border-green-500/30 rounded-md p-3 shadow-2xl ${
          showArrivedAlert ? "animate-bounce" : ""
        }`}
      >
        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-10 h-10 rounded-full bg-green-500/20 backdrop-blur-sm flex items-center justify-center animate-bounce border-2 border-green-500/40">
              <Bell className="w-5 h-5 text-green-600" />
            </div>
            <span className="font-bold text-sm text-green-600 whitespace-nowrap">
              🔔 السائق وصل! اخرج الآن
            </span>
          </div>

          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              className="bg-green-500 text-white hover:bg-green-600 font-bold h-10 text-xs shadow-lg whitespace-nowrap"
              onClick={onMyWay}
            >
              🚶 أنا قادم
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500/20 font-medium h-10 text-xs whitespace-nowrap"
              onClick={() =>
                sendQuickMessage(
                  "rider_wait_moment",
                  "✅ تم إبلاغ السائق",
                  "السائق سينتظرك دقيقة",
                )
              }
            >
              ⏱️ انتظرني دقيقة
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500/20 font-medium h-10 text-xs whitespace-nowrap"
              onClick={() =>
                sendQuickMessage(
                  "rider_where_are_you",
                  "✅ تم إرسال السؤال",
                  "السائق سيوضح موقعه",
                )
              }
            >
              📍 أين موقعك؟
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Compact status bar for in_progress (top position)
  if (status === "in_progress") {
    return (
      <div className="mx-4 mt-3 mb-2 bg-primary/10 backdrop-blur-2xl border border-primary/30 rounded-md p-4 shadow-xl">
        {/* Text on top */}
        <p className="font-bold text-sm text-primary text-center mb-3">
          🚗 بالطريق لوجهتك • استمتع برحلتك
        </p>

        {/* Time and distance below */}
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-1.5 bg-background rounded-full px-3 py-1 shadow-sm">
            <Timer className="w-3.5 h-3.5 text-primary" />
            <span className="font-bold text-sm text-foreground">
              {formatTime(countdownSeconds)}
            </span>
          </div>
          {remainingDistance && (
            <div className="flex items-center gap-1.5 bg-background rounded-full px-3 py-1 shadow-sm">
              <MapPin className="w-3.5 h-3.5 text-blue-500" />
              <span className="font-semibold text-sm text-foreground">
                {formatDistance(remainingDistance)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default RideStatusBar;
