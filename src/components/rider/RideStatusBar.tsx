import { Clock, Car, CheckCircle, Navigation, Loader2, Bell, MapPin, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  sendQuickMessage
}: RideStatusBarProps) => {
  const formatTime = (seconds: number | null) => {
    if (seconds === null || seconds <= 0) return '0 دقيقة';
    const mins = Math.floor(seconds / 60);
    if (mins < 1) return 'أقل من دقيقة';
    return `${mins} دقيقة`;
  };

  const formatDistance = (km: number | null | undefined) => {
    if (!km) return '--';
    if (km < 1) return `${Math.round(km * 1000)} م`;
    return `${km.toFixed(1)} كم`;
  };

  if (status === 'arrived') {
    return (
      <div className={`px-4 py-5 flex flex-col items-center justify-center gap-4 border-b-4 border-green-400 ${showArrivedAlert ? 'animate-pulse' : ''}`}
        style={{
          background: 'linear-gradient(135deg, #10b981, #059669)',
          boxShadow: showArrivedAlert ? '0 0 30px rgba(16, 185, 129, 0.6)' : undefined
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center animate-bounce">
            <Bell className="w-8 h-8 text-white" />
          </div>
          <div className="text-center">
            <span className="font-bold text-2xl text-white block">🔔 السائق وصل!</span>
            <span className="text-white/90 text-sm">اخرج الآن - السائق في انتظارك</span>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 justify-center w-full">
          <Button 
            className="bg-white text-green-600 hover:bg-white/90 font-bold px-6 h-12 text-base"
            onClick={onMyWay}
          >
            <MapPin className="w-4 h-4 ml-2" />
            🚶 أنا قادم
          </Button>
          <Button 
            variant="outline"
            className="bg-white/10 border-white/30 text-white hover:bg-white/20 font-medium px-4 h-12"
            onClick={() => sendQuickMessage('rider_wait_moment', '✅ تم إبلاغ السائق', 'السائق سينتظرك دقيقة')}
          >
            ⏱️ انتظرني دقيقة
          </Button>
          <Button 
            variant="outline"
            className="bg-white/10 border-white/30 text-white hover:bg-white/20 font-medium px-4 h-12"
            onClick={() => sendQuickMessage('rider_where_are_you', '✅ تم إرسال السؤال', 'السائق سيوضح موقعه')}
          >
            📍 أين موقعك؟
          </Button>
        </div>
      </div>
    );
  }

  // Compact status bar for in_progress (top position)
  if (status === 'in_progress') {
    return (
      <div className="px-4 py-2 border-b border-primary/50"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.03))',
        }}
      >
        {/* Text on top */}
        <p className="font-bold text-sm text-foreground text-center mb-2">🚗 بالطريق لوجهتك • استمتع برحلتك</p>
        
        {/* Time and distance below */}
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-1.5 bg-background rounded-full px-3 py-1 shadow-sm">
            <Timer className="w-3.5 h-3.5 text-primary" />
            <span className="font-bold text-sm text-foreground">{formatTime(countdownSeconds)}</span>
          </div>
          {remainingDistance && (
            <div className="flex items-center gap-1.5 bg-background rounded-full px-3 py-1 shadow-sm">
              <MapPin className="w-3.5 h-3.5 text-blue-500" />
              <span className="font-semibold text-sm text-foreground">{formatDistance(remainingDistance)}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default RideStatusBar;
