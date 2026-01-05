import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import RideProgressStepper from "@/components/rider/RideProgressStepper";
import CancellationReasonDialog from "@/components/rider/CancellationReasonDialog";
import { Loader2, Car, MapPin, Clock, X, Users, Search, Star, User, ArrowLeft, Sparkles, Heart } from "lucide-react";
import { playSound, vibrate, VibrationPatterns, showNotification } from "@/utils/rideNotificationSounds";
interface Driver {
  id: string;
  full_name: string;
  profile_image_url: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  vehicle_color: string | null;
  vehicle_type: string | null;
  rating: number | null;
}
interface RideWaitingScreenProps {
  rideId: string;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedFare: number;
  onCancel: () => void;
  onDriverFound: () => void;
}

// Encouraging messages that rotate
const ENCOURAGING_MESSAGES = [{
  text: "جاري البحث عن أفضل سائق لك...",
  icon: "🔍"
}, {
  text: "سائقونا في الطريق إليك...",
  icon: "🚗"
}, {
  text: "لحظات قليلة وسيتم إيجاد سائق...",
  icon: "⏳"
}, {
  text: "نبحث في منطقتك عن سائق متاح...",
  icon: "📍"
}, {
  text: "شكراً لصبرك، نحن نعمل على ذلك...",
  icon: "💚"
}, {
  text: "سيتم إعلامك فور قبول السائق...",
  icon: "🔔"
}];
export const RideWaitingScreen = ({
  rideId,
  pickupAddress,
  dropoffAddress,
  estimatedFare,
  onCancel,
  onDriverFound
}: RideWaitingScreenProps) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [nearbyDrivers, setNearbyDrivers] = useState(0);
  const [searchPhase, setSearchPhase] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [acceptedDriver, setAcceptedDriver] = useState<Driver | null>(null);
  const [showDriverCard, setShowDriverCard] = useState(false);
  const [rideStatus, setRideStatus] = useState<string>('pending');
  const [encouragingMessageIndex, setEncouragingMessageIndex] = useState(0);
  const [maxWaitTimeout, setMaxWaitTimeout] = useState(10); // Default 10 minutes
  const [dhikrCounts, setDhikrCounts] = useState({
    istighfar: 0,
    tasbih: 0,
    tahmid: 0
  });
  const [lastTappedDhikr, setLastTappedDhikr] = useState<string | null>(null);
  const {
    toast
  } = useToast();

  // Handle dhikr tap with haptic feedback
  const handleDhikrTap = (type: 'istighfar' | 'tasbih' | 'tahmid') => {
    setDhikrCounts(prev => ({
      ...prev,
      [type]: prev[type] + 1
    }));
    setLastTappedDhikr(type);
    setTimeout(() => setLastTappedDhikr(null), 300);

    // Light haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
  };
  const totalDhikr = dhikrCounts.istighfar + dhikrCounts.tasbih + dhikrCounts.tahmid;

  // Calculate estimated wait time based on nearby drivers
  const getEstimatedWaitTime = () => {
    if (nearbyDrivers === 0) return "5-10";
    if (nearbyDrivers === 1) return "3-6";
    if (nearbyDrivers <= 3) return "2-5";
    if (nearbyDrivers <= 5) return "1-3";
    return "1-2";
  };
  const getVehicleTypeName = (type: string | null) => {
    switch (type) {
      case 'economy':
        return 'اقتصادي';
      case 'comfort':
        return 'مريح';
      case 'premium':
        return 'فاخر';
      case 'women_only':
        return 'نسائي';
      default:
        return 'عادي';
    }
  };

  // State to prevent duplicate auto-cancellation
  const [hasAutoCancelled, setHasAutoCancelled] = useState(false);

  // Timer for elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-cancel ride when timeout is reached
  useEffect(() => {
    const elapsedMinutes = elapsedTime / 60;
    const timeoutWithGrace = maxWaitTimeout + 0.1; // 6 seconds grace period

    // Only auto-cancel if:
    // 1. Time exceeded timeout
    // 2. Ride is still pending
    // 3. No driver accepted yet
    // 4. Haven't already auto-cancelled
    if (elapsedMinutes >= timeoutWithGrace && rideStatus === 'pending' && !acceptedDriver && !hasAutoCancelled) {
      console.log('[RideWaiting] Timeout reached, auto-cancelling ride');
      setHasAutoCancelled(true);
      const autoCancelRide = async () => {
        const {
          error
        } = await supabase.from('rides').update({
          status: 'cancelled',
          cancelled_by: 'system',
          cancellation_reason: 'لم يتم العثور على سائق متاح خلال الوقت المحدد'
        }).eq('id', rideId).eq('status', 'pending');
        if (!error) {
          toast({
            title: "تم إلغاء الطلب تلقائياً",
            description: "لم نتمكن من إيجاد سائق متاح. يرجى المحاولة لاحقاً.",
            variant: "destructive"
          });
          onCancel();
        } else {
          console.error('[RideWaiting] Auto-cancel failed:', error);
          setHasAutoCancelled(false); // Allow retry
        }
      };
      autoCancelRide();
    }
  }, [elapsedTime, maxWaitTimeout, rideId, rideStatus, acceptedDriver, hasAutoCancelled, toast, onCancel]);

  // Animate search phases
  useEffect(() => {
    const phaseTimer = setInterval(() => {
      setSearchPhase(prev => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(phaseTimer);
  }, []);

  // Rotate encouraging messages
  useEffect(() => {
    const messageTimer = setInterval(() => {
      setEncouragingMessageIndex(prev => (prev + 1) % ENCOURAGING_MESSAGES.length);
    }, 4000);
    return () => clearInterval(messageTimer);
  }, []);

  // Fetch ride timeout and nearby drivers count
  useEffect(() => {
    const fetchRideData = async () => {
      // Get ride's region to determine timeout
      const {
        data: rideData
      } = await supabase.from('rides').select('region_id').eq('id', rideId).single();
      if (rideData?.region_id) {
        const {
          data: regionData
        } = await supabase.from('regions').select('wait_timeout_minutes, weekend_wait_timeout_minutes').eq('id', rideData.region_id).single();
        if (regionData) {
          const today = new Date();
          const dayOfWeek = today.getDay();
          const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
          const timeout = isWeekend ? regionData.weekend_wait_timeout_minutes || 15 : regionData.wait_timeout_minutes || 10;
          setMaxWaitTimeout(timeout);
        }
      }
    };
    const fetchNearbyDrivers = async () => {
      const {
        data,
        error
      } = await supabase.from('drivers').select('id').eq('is_online', true).eq('is_available', true).eq('status', 'approved');
      if (!error && data) {
        setNearbyDrivers(data.length);
      }
    };
    fetchRideData();
    fetchNearbyDrivers();
    const interval = setInterval(fetchNearbyDrivers, 10000);
    return () => clearInterval(interval);
  }, [rideId]);

  // Fetch driver info when accepted
  const fetchDriverInfo = async (driverId: string) => {
    const {
      data,
      error
    } = await supabase.from('drivers').select('id, full_name, profile_image_url, vehicle_model, vehicle_plate, vehicle_color, vehicle_type, rating').eq('id', driverId).single();
    if (!error && data) {
      setAcceptedDriver(data as Driver);
      setShowDriverCard(true);
    }
  };

  // Handle driver found - trigger notifications
  const handleDriverFound = async (driverId: string) => {
    console.log('[RideWaiting] Driver found! Playing celebration');

    // Fetch driver info first
    await fetchDriverInfo(driverId);

    // Play sound + vibrate
    playSound('driverFound');
    vibrate(VibrationPatterns.driverFound);

    // Show toast
    toast({
      title: "🎉 تم العثور على سائق!",
      description: "سائق قبل طلبك وفي الطريق إليك الآن",
      duration: 5000
    });

    // Browser notification
    showNotification('🎉 تم قبول طلبك!', 'سائق قبل طلبك وفي الطريق إليك الآن', {
      tag: 'driver-found',
      duration: 8000
    });
  };

  // Continue to tracking after seeing driver info
  const handleContinueToTracking = () => {
    onDriverFound();
  };

  // Listen for ride updates via realtime + broadcast + polling
  useEffect(() => {
    console.log('[RideWaiting] Setting up realtime subscriptions for ride:', rideId);

    // Database realtime subscription
    const dbChannel = supabase.channel(`ride-waiting-db-${rideId}`).on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'rides',
      filter: `id=eq.${rideId}`
    }, payload => {
      console.log('[RideWaiting] 📡 DB update received:', payload.new);
      const updatedRide = payload.new as any;
      if (updatedRide.status === 'accepted' && updatedRide.driver_id && !showDriverCard) {
        console.log('[RideWaiting] ✅ Driver found via DB subscription!');
        setRideStatus('accepted');
        handleDriverFound(updatedRide.driver_id);
      }
      if (updatedRide.status === 'cancelled') {
        console.log('[RideWaiting] ❌ Ride cancelled');
        toast({
          title: "تم إلغاء الرحلة",
          description: updatedRide.cancellation_reason || "تم إلغاء الطلب",
          variant: "destructive"
        });
        onCancel();
      }
    }).subscribe(status => {
      console.log('[RideWaiting] DB subscription status:', status);
    });

    // Broadcast channel for instant updates
    const broadcastChannel = supabase.channel(`ride-comm-${rideId}`, {
      config: {
        broadcast: {
          self: false
        }
      }
    });
    broadcastChannel.on('broadcast', {
      event: 'ride_accepted'
    }, (payload: any) => {
      console.log('[RideWaiting] ⚡ Broadcast: ride_accepted received');
      if (!showDriverCard && payload.payload?.driverId) {
        setRideStatus('accepted');
        handleDriverFound(payload.payload.driverId);
      }
    }).subscribe(status => {
      console.log('[RideWaiting] Broadcast subscription status:', status);
    });

    // Faster polling every 2 seconds as fallback
    const pollInterval = setInterval(async () => {
      if (showDriverCard) return; // Skip if already found

      try {
        const {
          data
        } = await supabase.from('rides').select('status, driver_id').eq('id', rideId).single();
        if (data?.status === 'accepted' && data?.driver_id && !showDriverCard) {
          console.log('[RideWaiting] ✅ Poll detected driver acceptance');
          handleDriverFound(data.driver_id);
        }
        if (data?.status === 'cancelled') {
          onCancel();
        }
      } catch (err) {
        console.error('[RideWaiting] Poll error:', err);
      }
    }, 2000);
    return () => {
      supabase.removeChannel(dbChannel);
      supabase.removeChannel(broadcastChannel);
      clearInterval(pollInterval);
    };
  }, [rideId, showDriverCard, toast, onCancel]);

  // Handle cancel button click - show dialog
  const handleCancelClick = () => {
    setShowCancelDialog(true);
  };

  // Handle actual cancellation with reason
  const handleConfirmCancel = async (reason: string, category: string) => {
    setCancelling(true);

    // Check if driver already accepted - apply cancellation fee
    let cancellationFee = 0;
    if (rideStatus === 'accepted' || rideStatus === 'arrived') {
      const {
        data: settings
      } = await supabase.from('app_settings').select('value').eq('key', 'cancellation_fee').single();
      if (settings?.value) {
        const feeSettings = settings.value as {
          amount: number;
          enabled: boolean;
          applies_after_acceptance: boolean;
        };
        if (feeSettings.enabled && feeSettings.applies_after_acceptance) {
          cancellationFee = feeSettings.amount;
        }
      }
    }
    const {
      error
    } = await supabase.from('rides').update({
      status: 'cancelled',
      cancelled_by: 'rider',
      cancellation_reason: reason,
      cancellation_fee: cancellationFee,
      cancellation_fee_paid: cancellationFee > 0
    }).eq('id', rideId);
    if (!error) {
      setShowCancelDialog(false);
      if (cancellationFee > 0) {
        toast({
          title: "تم إلغاء الرحلة",
          description: `تم خصم غرامة إلغاء: ${cancellationFee.toLocaleString()} د.ع`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "تم إلغاء الرحلة",
          description: "نأمل أن نراك مرة أخرى قريباً"
        });
      }
      onCancel();
    } else {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إلغاء الرحلة",
        variant: "destructive"
      });
    }
    setCancelling(false);
  };
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  const getSearchMessage = () => {
    const messages = ['جاري البحث عن سائق قريب...', 'نبحث عن أفضل سائق لك...', 'سيتم إعلامك فور قبول السائق...', 'يرجى الانتظار لحظات...'];
    return messages[searchPhase];
  };

  // Show driver card if driver accepted
  if (showDriverCard && acceptedDriver) {
    return <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-4">
        {/* Progress Stepper at top */}
        <div className="absolute top-0 left-0 right-0 bg-card/90 backdrop-blur-sm border-b shadow-sm">
          <RideProgressStepper status="accepted" />
        </div>

        {/* Success animation */}
        <div className="relative mb-6 mt-16">
          <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
              <Car className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
          🎉 تم قبول طلبك!
        </h2>
        <p className="text-muted-foreground mb-6 text-center">
          السائق في الطريق إليك الآن
        </p>

        {/* Driver Info Card */}
        <Card className="w-full max-w-sm mb-6 border-primary/30 shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <Avatar className="w-16 h-16 border-2 border-primary">
                <AvatarImage src={acceptedDriver.profile_image_url || ''} alt={acceptedDriver.full_name} />
                <AvatarFallback className="bg-primary/10">
                  <User className="w-8 h-8 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground">{acceptedDriver.full_name}</h3>
                <div className="flex items-center gap-1 text-sm text-yellow-500">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="font-medium">{acceptedDriver.rating?.toFixed(1) || '5.0'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  نوع السيارة
                </span>
                <span className="text-sm font-medium text-foreground">
                  {getVehicleTypeName(acceptedDriver.vehicle_type)}
                </span>
              </div>
              
              {acceptedDriver.vehicle_model && <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">الموديل</span>
                  <span className="text-sm font-medium text-foreground">
                    {acceptedDriver.vehicle_model}
                    {acceptedDriver.vehicle_color && ` - ${acceptedDriver.vehicle_color}`}
                  </span>
                </div>}
              
              {acceptedDriver.vehicle_plate && <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">رقم اللوحة</span>
                  <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                    {acceptedDriver.vehicle_plate}
                  </span>
                </div>}
            </div>
          </CardContent>
        </Card>

        {/* Continue Button */}
        <Button size="lg" className="w-full max-w-sm" onClick={handleContinueToTracking}>
          <MapPin className="w-5 h-5 ml-2" />
          تتبع الرحلة
        </Button>

        <p className="text-xs text-muted-foreground mt-4 text-center">
          اضغط لمتابعة موقع السائق على الخريطة
        </p>
      </div>;
  }
  return <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      {/* Progress Stepper at top */}
      <div className="absolute top-4 left-0 right-0 bg-card/90 backdrop-blur-sm border-b shadow-sm">
        <RideProgressStepper status="pending" />
      </div>

      {/* Animated search indicator - Enhanced */}
      <div className="relative mb-6 mt-16">
        {/* Outer rings with staggered animation */}
        <div className="absolute inset-0 w-36 h-36 -translate-x-2 -translate-y-2 rounded-full border-2 border-primary/15 animate-ping" />
        <div className="absolute inset-0 w-36 h-36 -translate-x-2 -translate-y-2 rounded-full border-2 border-primary/25 animate-ping" style={{
        animationDelay: '0.4s'
      }} />
        <div className="absolute inset-0 w-36 h-36 -translate-x-2 -translate-y-2 rounded-full border-2 border-primary/35 animate-ping" style={{
        animationDelay: '0.8s'
      }} />
        
        {/* Center icon with glow */}
        <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shadow-glow animate-search-pulse">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/30 to-primary/20 flex items-center justify-center">
            <Search className="w-10 h-10 text-primary icon-glow" />
          </div>
        </div>
      </div>

      {/* Encouraging Message - Animated */}
      <div className="h-16 flex flex-col items-center justify-center mb-2">
        <div className="flex items-center gap-2 animate-fade-in" key={encouragingMessageIndex}>
          <span className="text-2xl">{ENCOURAGING_MESSAGES[encouragingMessageIndex].icon}</span>
          <h2 className="text-lg font-semibold text-foreground text-center">
            {ENCOURAGING_MESSAGES[encouragingMessageIndex].text}
          </h2>
        </div>
      </div>
      
      {/* Timer with countdown */}
      <div className="flex flex-col items-center gap-1 mb-4">
        <div className="flex items-center gap-2 text-muted-foreground bg-secondary/30 px-4 py-2 rounded-full">
          <Clock className="w-4 h-4 text-primary" />
          <span className="font-mono text-lg font-semibold">{formatTime(elapsedTime)}</span>
          <span className="text-sm text-muted-foreground">/ {maxWaitTimeout}:00</span>
        </div>
        
        {/* Progress bar for timeout */}
        <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-1000 ${elapsedTime / 60 >= maxWaitTimeout * 0.8 ? 'bg-destructive' : 'bg-primary'}`} style={{
          width: `${Math.min(elapsedTime / 60 / maxWaitTimeout * 100, 100)}%`
        }} />
        </div>
        
        {elapsedTime / 60 >= maxWaitTimeout * 0.8 && <p className="text-xs text-destructive animate-pulse mt-1">
            سيتم الإلغاء التلقائي قريباً
          </p>}
      </div>

      {/* Estimated Wait Time - Enhanced */}
      <div className="flex items-center gap-2 px-5 py-2.5 bg-primary/15 border border-primary/30 rounded-full mb-4 shadow-sm">
        <Sparkles className="w-4 h-4 text-primary animate-pulse" />
        <span className="text-sm font-medium text-primary">
          الحد الأقصى للانتظار: {maxWaitTimeout} دقائق
        </span>
      </div>

      {/* Nearby drivers info - Enhanced */}
      

      {/* Dhikr Card - appears when wait time > 5 min (nearbyDrivers <= 1) */}
      {nearbyDrivers <= 1 && <Card className="w-full max-w-sm mb-4 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 shadow-[0_0_15px_rgba(var(--primary)/0.15)]">
          <CardContent className="p-4">
            <p className="text-center text-sm text-primary mb-3 font-medium">
              ✨ استثمر وقت الانتظار بالذكر
            </p>
            
            <div className="flex justify-center gap-2">
              {/* استغفار */}
              <button onClick={() => handleDhikrTap('istighfar')} className={`flex flex-col items-center p-3 rounded-xl bg-card border border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 min-w-[85px] ${lastTappedDhikr === 'istighfar' ? 'scale-95 shadow-[0_0_20px_rgba(var(--primary)/0.4)]' : ''}`}>
                <span className="text-xl mb-1">🤲</span>
                <span className="text-xs text-muted-foreground mb-1">استغفر الله</span>
                <span className={`text-lg font-bold text-primary transition-all duration-200 ${lastTappedDhikr === 'istighfar' ? 'scale-125' : ''}`}>
                  {dhikrCounts.istighfar}
                </span>
              </button>

              {/* تسبيح */}
              <button onClick={() => handleDhikrTap('tasbih')} className={`flex flex-col items-center p-3 rounded-xl bg-card border border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 min-w-[85px] ${lastTappedDhikr === 'tasbih' ? 'scale-95 shadow-[0_0_20px_rgba(var(--primary)/0.4)]' : ''}`}>
                <span className="text-xl mb-1">📿</span>
                <span className="text-xs text-muted-foreground mb-1">سبحان الله</span>
                <span className={`text-lg font-bold text-primary transition-all duration-200 ${lastTappedDhikr === 'tasbih' ? 'scale-125' : ''}`}>
                  {dhikrCounts.tasbih}
                </span>
              </button>

              {/* تحميد */}
              <button onClick={() => handleDhikrTap('tahmid')} className={`flex flex-col items-center p-3 rounded-xl bg-card border border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 min-w-[85px] ${lastTappedDhikr === 'tahmid' ? 'scale-95 shadow-[0_0_20px_rgba(var(--primary)/0.4)]' : ''}`}>
                <span className="text-xl mb-1">✨</span>
                <span className="text-xs text-muted-foreground mb-1">الحمد لله</span>
                <span className={`text-lg font-bold text-primary transition-all duration-200 ${lastTappedDhikr === 'tahmid' ? 'scale-125' : ''}`}>
                  {dhikrCounts.tahmid}
                </span>
              </button>
            </div>

            {totalDhikr > 0 && <p className="text-center text-xs text-muted-foreground mt-3 animate-fade-in">
                المجموع: <span className="text-primary font-bold">{totalDhikr}</span> ذكر
              </p>}
          </CardContent>
        </Card>}

      {/* Ride summary card */}
      <Card className="w-full max-w-sm mb-6">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 mt-1.5 rounded-full bg-primary shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">من</p>
              <p className="text-sm text-foreground line-clamp-1">{pickupAddress}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 mt-1.5 rounded-full bg-blue-500 shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">إلى</p>
              <p className="text-sm text-foreground line-clamp-1">{dropoffAddress}</p>
            </div>
          </div>
          <div className="pt-3 border-t border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">الأجرة المتوقعة</span>
            <span className="font-bold text-primary">{estimatedFare.toLocaleString()} د.ع</span>
          </div>
        </CardContent>
      </Card>

      {/* Cancel button */}
      <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={handleCancelClick} disabled={cancelling}>
        {cancelling ? <>
            <Loader2 className="w-4 h-4 animate-spin ml-2" />
            جاري الإلغاء...
          </> : <>
            <X className="w-4 h-4 ml-2" />
            إلغاء الطلب
          </>}
      </Button>

      {/* Tip */}
      <p className="text-xs text-muted-foreground mt-6 text-center max-w-xs">
        ستتلقى إشعاراً فور قبول سائق لطلبك. يمكنك إلغاء الطلب مجاناً قبل القبول.
      </p>

      {/* Cancellation Reason Dialog */}
      <CancellationReasonDialog open={showCancelDialog} onOpenChange={setShowCancelDialog} onConfirm={handleConfirmCancel} isLoading={cancelling} rideStatus={rideStatus} estimatedFare={estimatedFare} />
    </div>;
};
export default RideWaitingScreen;