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
    return <div className="fixed inset-0 z-50 bg-gradient-to-b from-background via-green-500/5 to-background overflow-auto">
        <div className="min-h-screen flex flex-col">
          {/* Header with progress stepper */}
          <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-xl border-b shadow-sm">
            <RideProgressStepper status="accepted" />
          </div>

          {/* Main content - Responsive & Centered */}
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 md:space-y-8 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl mx-auto w-full">
            
            {/* Success animation - Modern */}
            <div className="relative w-full flex justify-center mb-2 sm:mb-3 md:mb-4">
              <div className="relative">
                {/* Animated success rings */}
                <div className="absolute inset-0 w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 -translate-x-0.5 -translate-y-0.5 sm:-translate-x-1 sm:-translate-y-1 rounded-full bg-green-500/20 animate-ping" />
                <div className="absolute inset-0 w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 -translate-x-0.5 -translate-y-0.5 sm:-translate-x-1 sm:-translate-y-1 rounded-full bg-green-500/30 animate-ping" style={{ animationDelay: '0.3s' }} />
                
                {/* Center icon with glassmorphic style */}
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-full bg-gradient-to-br from-green-500/30 via-emerald-500/20 to-green-500/30 backdrop-blur-md flex items-center justify-center shadow-2xl border border-green-500/20">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent" />
                  <Car className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 text-green-500 drop-shadow-lg animate-bounce" />
                </div>
              </div>
            </div>

            {/* Success message */}
            <div className="text-center space-y-1 sm:space-y-2">
              <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 bg-clip-text text-transparent">
                🎉 تم قبول طلبك!
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base md:text-lg">
                السائق في الطريق إليك الآن
              </p>
            </div>

            {/* Driver Info Card - Modern glassmorphic design */}
            <Card className="w-full bg-gradient-to-br from-card via-green-500/5 to-card border-green-500/20 shadow-2xl hover:shadow-green-500/10 transition-all">
              <CardContent className="p-3 sm:p-4 md:p-5 lg:p-6">
                {/* Driver header with avatar */}
                <div className="flex items-center gap-2.5 sm:gap-3 md:gap-4 mb-3 sm:mb-4 md:mb-5 lg:mb-6 pb-3 sm:pb-4 md:pb-5 lg:pb-6 border-b border-border">
                  <div className="relative">
                    <Avatar className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 border-2 sm:border-3 md:border-3 lg:border-4 border-green-500/30 shadow-lg">
                      <AvatarImage src={acceptedDriver.profile_image_url || ''} alt={acceptedDriver.full_name} />
                      <AvatarFallback className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 text-green-600">
                        <User className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-10 lg:h-10" />
                      </AvatarFallback>
                    </Avatar>
                    {/* Online indicator */}
                    <div className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 bg-green-500 rounded-full border-2 sm:border-3 md:border-3 lg:border-4 border-card flex items-center justify-center">
                      <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 md:w-2 md:h-2 bg-white rounded-full animate-pulse" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-foreground mb-0.5 sm:mb-1 truncate">{acceptedDriver.full_name}</h3>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <div className="flex items-center gap-1 text-amber-500">
                        <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 fill-current" />
                        <span className="font-bold text-[10px] sm:text-xs md:text-sm">{acceptedDriver.rating?.toFixed(1) || '5.0'}</span>
                      </div>
                      <Badge variant="secondary" className="text-[9px] sm:text-[10px] md:text-xs px-1 sm:px-1.5 md:px-2 py-0.5">
                        سائق معتمد
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Vehicle details - Modern grid layout */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 md:gap-4">
                  {/* Vehicle type */}
                  <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 p-2.5 sm:p-3 md:p-4 rounded-lg sm:rounded-xl bg-gradient-to-br from-primary/10 to-blue-500/10 border border-primary/20">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Car className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-4.5 md:h-4.5 lg:w-5 lg:h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] sm:text-[10px] md:text-xs font-medium text-muted-foreground mb-0.5">نوع السيارة</p>
                      <p className="text-[10px] sm:text-xs md:text-sm font-bold text-foreground truncate">
                        {getVehicleTypeName(acceptedDriver.vehicle_type)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Vehicle model */}
                  {acceptedDriver.vehicle_model && (
                    <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 p-2.5 sm:p-3 md:p-4 rounded-lg sm:rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                        <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-4.5 md:h-4.5 lg:w-5 lg:h-5 text-green-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] sm:text-[10px] md:text-xs font-medium text-muted-foreground mb-0.5">الموديل</p>
                        <p className="text-[10px] sm:text-xs md:text-sm font-bold text-foreground truncate">
                          {acceptedDriver.vehicle_model}
                          {acceptedDriver.vehicle_color && <span className="text-muted-foreground text-[9px] sm:text-[10px] md:text-xs"> • {acceptedDriver.vehicle_color}</span>}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* License plate - Prominent display */}
                {acceptedDriver.vehicle_plate && (
                  <div className="mt-3 sm:mt-4 p-3 sm:p-4 rounded-xl bg-gradient-to-r from-primary via-blue-500 to-primary text-center">
                    <p className="text-[10px] sm:text-xs text-primary-foreground/70 mb-0.5 sm:mb-1">رقم اللوحة</p>
                    <p className="text-xl sm:text-2xl font-black text-primary-foreground tracking-wider">
                      {acceptedDriver.vehicle_plate}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Continue to tracking button - Modern & prominent */}
            <Button 
              size="lg" 
              className="w-full bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 hover:from-green-600 hover:via-emerald-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl transition-all text-sm sm:text-base md:text-lg py-3 sm:py-4 md:py-5 px-4 sm:px-6 md:px-8"
              onClick={handleContinueToTracking}
            >
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 ml-2" />
              <span className="text-sm sm:text-base md:text-lg">تتبع الرحلة على الخريطة</span>
            </Button>

            {/* Help text */}
            <p className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground text-center max-w-xs sm:max-w-sm md:max-w-md px-2 leading-tight">
              💡 اضغط للانتقال إلى خريطة تتبع موقع السائق المباشر
            </p>
          </div>
        </div>
      </div>;
  }
  return <div className="fixed inset-0 z-50 bg-gradient-to-b from-background via-primary/5 to-background overflow-auto">
      <div className="min-h-screen flex flex-col">
        {/* Header with progress stepper */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-xl border-b shadow-sm">
          <RideProgressStepper status="pending" />
        </div>

        {/* Main content - Responsive & Centered */}
        <div className="flex-1 flex flex-col items-center justify-center px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8 space-y-3 sm:space-y-4 md:space-y-6 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl mx-auto w-full">
          
          {/* Status message with modern card design */}
          <Card className="w-full bg-gradient-to-br from-card via-card to-primary/5 border-primary/20 shadow-lg">
            <CardContent className="p-3 sm:p-4 md:p-5">
              {/* Main status title */}
              <div className="text-center mb-2 sm:mb-3 md:mb-4">
                <h1 className="text-base sm:text-lg md:text-xl font-bold text-foreground flex items-center justify-center gap-1.5 sm:gap-2">
                  <span className="text-lg sm:text-xl md:text-2xl">⏳</span>
                  <span className="text-sm sm:text-base md:text-lg leading-tight">بانتظار قبول السائق لطلبك</span>
                </h1>
              </div>

              <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3" key={encouragingMessageIndex}>
                <div className="text-lg sm:text-xl md:text-2xl animate-bounce">{ENCOURAGING_MESSAGES[encouragingMessageIndex].icon}</div>
                <div className="flex-1">
                  <h2 className="text-xs sm:text-sm md:text-base font-bold text-foreground mb-1 leading-tight">
                    {ENCOURAGING_MESSAGES[encouragingMessageIndex].text}
                  </h2>
                </div>
              </div>

              {/* Timer & info badges - Responsive */}
              <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 md:gap-2 mt-2 sm:mt-3">
                <Badge variant="secondary" className="px-1.5 py-0.5 sm:px-2 sm:py-1 md:px-3 md:py-1.5 text-[10px] sm:text-xs md:text-xs font-semibold">
                  <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 ml-1 text-primary" />
                  <span className="font-mono text-[10px] sm:text-xs md:text-xs">{formatTime(elapsedTime)}</span>
                  <span className="text-muted-foreground mx-0.5 text-[10px] sm:text-xs">/</span>
                  <span className="text-muted-foreground text-[10px] sm:text-xs">{maxWaitTimeout}:00</span>
                </Badge>
                
                <Badge variant="outline" className="px-1.5 py-0.5 sm:px-2 sm:py-1 md:px-3 md:py-1.5 text-[10px] sm:text-xs border-primary/30 bg-primary/10">
                  <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 ml-1 text-primary animate-pulse" />
                  <span className="text-[10px] sm:text-xs">حد أقصى {maxWaitTimeout} د</span>
                </Badge>
              </div>

              {/* Progress bar */}
              <div className="mt-2 sm:mt-3 space-y-1">
                <div className="w-full h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${
                      elapsedTime / 60 >= maxWaitTimeout * 0.8 
                        ? 'bg-gradient-to-r from-destructive to-red-600' 
                        : 'bg-gradient-to-r from-primary via-blue-500 to-primary'
                    }`}
                    style={{ width: `${Math.min((elapsedTime / 60 / maxWaitTimeout) * 100, 100)}%` }}
                  />
                </div>
                {elapsedTime / 60 >= maxWaitTimeout * 0.8 && (
                  <p className="text-[10px] sm:text-xs text-destructive text-center animate-pulse font-medium">
                    ⚠️ سيتم الإلغاء التلقائي قريباً
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Ride summary - Modern glassmorphic card */}
          <Card className="w-full bg-gradient-to-br from-card to-card border-primary/10 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-3 sm:p-4 md:p-5 space-y-2 sm:space-y-3">
              <h3 className="text-[10px] sm:text-xs md:text-sm font-bold text-primary flex items-center gap-1.5">
                <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
                تفاصيل الرحلة
              </h3>
              
              {/* From location */}
              <div className="flex items-start gap-2 p-2 sm:p-2.5 md:p-3 rounded-lg bg-primary/5 border border-primary/10">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 mt-1 rounded-full bg-primary shrink-0 shadow-lg shadow-primary/50" />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] sm:text-[10px] md:text-xs font-medium text-primary mb-0.5">من</p>
                  <p className="text-[10px] sm:text-xs md:text-sm text-foreground font-medium truncate leading-tight">{pickupAddress}</p>
                </div>
              </div>
              
              {/* Connecting line */}
              <div className="flex justify-center">
                <div className="w-0.5 h-2 sm:h-3 md:h-4 bg-gradient-to-b from-primary to-blue-500 rounded-full" />
              </div>
              
              {/* To location */}
              <div className="flex items-start gap-2 p-2 sm:p-2.5 md:p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 mt-1 rounded-full bg-blue-500 shrink-0 shadow-lg shadow-blue-500/50" />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] sm:text-[10px] md:text-xs font-medium text-blue-500 mb-0.5">إلى</p>
                  <p className="text-[10px] sm:text-xs md:text-sm text-foreground font-medium truncate leading-tight">{dropoffAddress}</p>
                </div>
              </div>
              
              {/* Fare estimate */}
              <div className="pt-2 sm:pt-3 border-t border-border">
                <div className="flex items-center justify-between p-2 sm:p-2.5 md:p-3 rounded-lg bg-gradient-to-r from-primary/10 to-blue-500/10">
                  <span className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-1 sm:gap-1.5">
                    <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-primary" />
                    الأجرة المتوقعة
                  </span>
                  <span className="text-sm sm:text-base md:text-lg font-bold text-primary">{estimatedFare.toLocaleString()} د.ع</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cancel button - Modern design */}
          <Button 
            variant="outline" 
            className="w-full border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all shadow-md hover:shadow-lg px-3 py-2 sm:px-4 sm:py-2.5 md:px-6 md:py-3 text-sm sm:text-base" 
            onClick={handleCancelClick} 
            disabled={cancelling}
          >
            {cancelling ? (
              <>
                <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin ml-2" />
                <span className="text-sm sm:text-base">جاري الإلغاء...</span>
              </>
            ) : (
              <>
                <X className="w-3 h-3 sm:w-4 sm:h-4 ml-2" />
                <span className="text-sm sm:text-base">إلغاء الطلب</span>
              </>
            )}
          </Button>

          {/* Help text */}
          <p className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground text-center max-w-xs sm:max-w-sm md:max-w-md leading-tight px-2">
            💡 ستتلقى إشعاراً فور قبول سائق • يمكنك الإلغاء مجاناً قبل القبول
          </p>
        </div>
      </div>

      {/* Cancellation Reason Dialog */}
      <CancellationReasonDialog 
        open={showCancelDialog} 
        onOpenChange={setShowCancelDialog} 
        onConfirm={handleConfirmCancel} 
        isLoading={cancelling} 
        rideStatus={rideStatus} 
        estimatedFare={estimatedFare} 
      />
    </div>;
};
export default RideWaitingScreen;