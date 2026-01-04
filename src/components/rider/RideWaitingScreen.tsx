import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import RideProgressStepper from "@/components/rider/RideProgressStepper";
import CancellationReasonDialog from "@/components/rider/CancellationReasonDialog";
import NearbyDriversMiniMap from "@/components/rider/NearbyDriversMiniMap";
import ShareRideLocation from "@/components/rider/ShareRideLocation";
import { 
  Loader2, 
  Car, 
  MapPin, 
  Clock, 
  X,
  Users,
  Search,
  Star,
  User,
  ArrowLeft,
  Sparkles,
  Heart,
  Navigation,
  Flag,
  Phone,
  MessageCircle,
  Shield,
  CheckCircle2
} from "lucide-react";
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
const ENCOURAGING_MESSAGES = [
  { text: "جاري البحث عن أفضل سائق لك...", icon: "🔍" },
  { text: "سائقونا في الطريق إليك...", icon: "🚗" },
  { text: "لحظات قليلة وسيتم إيجاد سائق...", icon: "⏳" },
  { text: "نبحث في منطقتك عن سائق متاح...", icon: "📍" },
  { text: "شكراً لصبرك، نحن نعمل على ذلك...", icon: "💚" },
  { text: "سيتم إعلامك فور قبول السائق...", icon: "🔔" },
];

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
  const { toast } = useToast();

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
      case 'economy': return 'اقتصادي';
      case 'comfort': return 'مريح';
      case 'premium': return 'فاخر';
      case 'women_only': return 'نسائي';
      default: return 'عادي';
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
    if (
      elapsedMinutes >= timeoutWithGrace && 
      rideStatus === 'pending' && 
      !acceptedDriver && 
      !hasAutoCancelled
    ) {
      console.log('[RideWaiting] Timeout reached, auto-cancelling ride');
      setHasAutoCancelled(true);
      
      const autoCancelRide = async () => {
        const { error } = await supabase
          .from('rides')
          .update({
            status: 'cancelled',
            cancelled_by: 'system',
            cancellation_reason: 'لم يتم العثور على سائق متاح خلال الوقت المحدد'
          })
          .eq('id', rideId)
          .eq('status', 'pending');
        
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
      const { data: rideData } = await supabase
        .from('rides')
        .select('region_id')
        .eq('id', rideId)
        .single();

      if (rideData?.region_id) {
        const { data: regionData } = await supabase
          .from('regions')
          .select('wait_timeout_minutes, weekend_wait_timeout_minutes')
          .eq('id', rideData.region_id)
          .single();

        if (regionData) {
          const today = new Date();
          const dayOfWeek = today.getDay();
          const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
          const timeout = isWeekend 
            ? (regionData.weekend_wait_timeout_minutes || 15)
            : (regionData.wait_timeout_minutes || 10);
          setMaxWaitTimeout(timeout);
        }
      }
    };

    const fetchNearbyDrivers = async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('id')
        .eq('is_online', true)
        .eq('is_available', true)
        .eq('status', 'approved');
      
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
    const { data, error } = await supabase
      .from('drivers')
      .select('id, full_name, profile_image_url, vehicle_model, vehicle_plate, vehicle_color, vehicle_type, rating')
      .eq('id', driverId)
      .single();
    
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
      duration: 5000,
    });
    
    // Browser notification
    showNotification(
      '🎉 تم قبول طلبك!',
      'سائق قبل طلبك وفي الطريق إليك الآن',
      { tag: 'driver-found', duration: 8000 }
    );
  };

  // Continue to tracking after seeing driver info
  const handleContinueToTracking = () => {
    onDriverFound();
  };

  // Listen for ride updates via realtime + broadcast + polling
  useEffect(() => {
    console.log('[RideWaiting] Setting up realtime subscriptions for ride:', rideId);
    
    // Database realtime subscription
    const dbChannel = supabase
      .channel(`ride-waiting-db-${rideId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rides',
          filter: `id=eq.${rideId}`
        },
        (payload) => {
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
        }
      )
      .subscribe((status) => {
        console.log('[RideWaiting] DB subscription status:', status);
      });

    // Broadcast channel for instant updates
    const broadcastChannel = supabase.channel(`ride-comm-${rideId}`, {
      config: { broadcast: { self: false } }
    });
    
    broadcastChannel
      .on('broadcast', { event: 'ride_accepted' }, (payload: any) => {
        console.log('[RideWaiting] ⚡ Broadcast: ride_accepted received');
        if (!showDriverCard && payload.payload?.driverId) {
          setRideStatus('accepted');
          handleDriverFound(payload.payload.driverId);
        }
      })
      .subscribe((status) => {
        console.log('[RideWaiting] Broadcast subscription status:', status);
      });

    // Faster polling every 2 seconds as fallback
    const pollInterval = setInterval(async () => {
      if (showDriverCard) return; // Skip if already found
      
      try {
        const { data } = await supabase
          .from('rides')
          .select('status, driver_id')
          .eq('id', rideId)
          .single();
        
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
      const { data: settings } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'cancellation_fee')
        .single();
      
      if (settings?.value) {
        const feeSettings = settings.value as { amount: number; enabled: boolean; applies_after_acceptance: boolean };
        if (feeSettings.enabled && feeSettings.applies_after_acceptance) {
          cancellationFee = feeSettings.amount;
        }
      }
    }
    
    const { error } = await supabase
      .from('rides')
      .update({ 
        status: 'cancelled',
        cancelled_by: 'rider',
        cancellation_reason: reason,
        cancellation_fee: cancellationFee,
        cancellation_fee_paid: cancellationFee > 0
      })
      .eq('id', rideId);

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
          description: "نأمل أن نراك مرة أخرى قريباً",
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
    const messages = [
      'جاري البحث عن سائق قريب...',
      'نبحث عن أفضل سائق لك...',
      'سيتم إعلامك فور قبول السائق...',
      'يرجى الانتظار لحظات...'
    ];
    return messages[searchPhase];
  };


  // Show driver card if driver accepted
  if (showDriverCard && acceptedDriver) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-gradient-to-b from-background via-background to-primary/5 flex flex-col items-center justify-center p-4"
      >
        {/* Progress Stepper at top */}
        <div className="absolute top-0 left-0 right-0 bg-card/90 backdrop-blur-lg border-b border-primary/20 shadow-lg">
          <RideProgressStepper status="accepted" />
        </div>

        {/* Success animation */}
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="relative mb-6 mt-20"
        >
          <div className="absolute inset-0 w-28 h-28 -translate-x-2 -translate-y-2 rounded-full bg-gradient-to-br from-emerald-400/30 to-green-600/30 animate-ping" />
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/40">
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>
        </motion.div>

        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold text-foreground mb-2 text-center"
        >
          🎉 تم قبول طلبك!
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-muted-foreground mb-6 text-center"
        >
          السائق في الطريق إليك الآن
        </motion.p>

        {/* Driver Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-sm"
        >
          <Card className="mb-6 border-2 border-primary/30 shadow-xl bg-gradient-to-br from-card to-card/80 overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <Avatar className="w-20 h-20 border-3 border-primary shadow-lg">
                    <AvatarImage src={acceptedDriver.profile_image_url || ''} alt={acceptedDriver.full_name} />
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-2xl">
                      {acceptedDriver.full_name?.charAt(0) || <User className="w-10 h-10" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-foreground mb-1">{acceptedDriver.full_name}</h3>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span className="text-sm font-bold text-amber-600">{acceptedDriver.rating?.toFixed(1) || '5.0'}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {getVehicleTypeName(acceptedDriver.vehicle_type)}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Vehicle Info */}
              <div className="p-3 rounded-xl bg-secondary/50 space-y-2 mb-4">
                {acceptedDriver.vehicle_model && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Car className="w-4 h-4" />
                      السيارة
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {acceptedDriver.vehicle_model}
                      {acceptedDriver.vehicle_color && ` - ${acceptedDriver.vehicle_color}`}
                    </span>
                  </div>
                )}
                
                {acceptedDriver.vehicle_plate && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">رقم اللوحة</span>
                    <span className="text-lg font-bold text-primary bg-primary/15 px-4 py-1 rounded-lg border border-primary/30">
                      {acceptedDriver.vehicle_plate}
                    </span>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-2 rounded-xl">
                  <Phone className="w-4 h-4" />
                  اتصال
                </Button>
                <Button variant="outline" size="sm" className="flex-1 gap-2 rounded-xl">
                  <MessageCircle className="w-4 h-4" />
                  رسالة
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Continue Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="w-full max-w-sm"
        >
          <Button 
            size="lg"
            className="w-full h-14 rounded-2xl text-lg font-bold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/30"
            onClick={handleContinueToTracking}
          >
            <Navigation className="w-5 h-5 ml-2" />
            تتبع الرحلة على الخريطة
          </Button>
        </motion.div>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-xs text-muted-foreground mt-4 text-center"
        >
          اضغط لمتابعة موقع السائق على الخريطة مباشرة
        </motion.p>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-gradient-to-b from-background via-background to-primary/5 flex flex-col items-center justify-center p-4 overflow-y-auto"
    >
      {/* Progress Stepper at top */}
      <div className="absolute top-0 left-0 right-0 bg-card/90 backdrop-blur-lg border-b border-border/50 shadow-lg z-10">
        <RideProgressStepper status="pending" />
      </div>

      {/* Animated search indicator - Premium Design */}
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="relative mb-6 mt-20"
      >
        {/* Outer rings with staggered animation */}
        <div className="absolute inset-0 w-36 h-36 -translate-x-2 -translate-y-2 rounded-full border-2 border-primary/20 animate-ping" />
        <div className="absolute inset-0 w-36 h-36 -translate-x-2 -translate-y-2 rounded-full border-2 border-primary/30 animate-ping" style={{ animationDelay: '0.5s' }} />
        <div className="absolute inset-0 w-36 h-36 -translate-x-2 -translate-y-2 rounded-full border-2 border-primary/40 animate-ping" style={{ animationDelay: '1s' }} />
        
        {/* Center icon with gradient glow */}
        <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-primary/30 via-primary/20 to-primary/10 flex items-center justify-center shadow-xl">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, transparent, hsl(var(--primary)), transparent)',
              opacity: 0.3
            }}
          />
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/30">
            <Search className="w-10 h-10 text-primary-foreground" />
          </div>
        </div>
      </motion.div>

      {/* Encouraging Message - Animated */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={encouragingMessageIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="h-16 flex flex-col items-center justify-center mb-3"
        >
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
            <span className="text-2xl">{ENCOURAGING_MESSAGES[encouragingMessageIndex].icon}</span>
            <h2 className="text-lg font-semibold text-foreground text-center">
              {ENCOURAGING_MESSAGES[encouragingMessageIndex].text}
            </h2>
          </div>
        </motion.div>
      </AnimatePresence>
      
      {/* Timer with countdown - Premium Design */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col items-center gap-2 mb-4"
      >
        <div className="flex items-center gap-3 bg-card px-5 py-3 rounded-2xl border border-border/50 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div className="text-center">
            <span className="font-mono text-2xl font-bold text-foreground">{formatTime(elapsedTime)}</span>
            <span className="text-sm text-muted-foreground mx-2">/</span>
            <span className="text-sm text-muted-foreground">{maxWaitTimeout}:00</span>
          </div>
        </div>
        
        {/* Progress bar for timeout */}
        <div className="w-56 h-2 bg-muted rounded-full overflow-hidden shadow-inner">
          <motion.div 
            className={`h-full rounded-full ${
              (elapsedTime / 60) >= maxWaitTimeout * 0.8 
                ? 'bg-gradient-to-r from-destructive to-red-400' 
                : 'bg-gradient-to-r from-primary to-primary/70'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((elapsedTime / 60 / maxWaitTimeout) * 100, 100)}%` }}
            transition={{ duration: 1 }}
          />
        </div>
        
        {(elapsedTime / 60) >= maxWaitTimeout * 0.8 && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-destructive font-medium animate-pulse mt-1"
          >
            ⚠️ سيتم الإلغاء التلقائي قريباً
          </motion.p>
        )}
      </motion.div>

      {/* Estimated Wait Time - Enhanced */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/30 rounded-full mb-4 shadow-lg"
      >
        <Sparkles className="w-4 h-4 text-primary animate-pulse" />
        <span className="text-sm font-medium text-primary">
          الحد الأقصى للانتظار: {maxWaitTimeout} دقائق
        </span>
      </motion.div>

      {/* Nearby drivers info - Enhanced */}
      <div className={`flex items-center gap-2 px-5 py-2.5 rounded-full mb-4 transition-all duration-300 ${
        nearbyDrivers > 0 
          ? 'bg-success/15 border border-success/30' 
          : 'bg-secondary/50 border border-border'
      }`}>
        <Users className={`w-4 h-4 ${nearbyDrivers > 0 ? 'text-success' : 'text-muted-foreground'}`} />
        <span className={`text-sm font-medium ${nearbyDrivers > 0 ? 'text-success' : 'text-muted-foreground'}`}>
          {nearbyDrivers > 0 
            ? `${nearbyDrivers} سائق متاح في منطقتك`
            : 'جاري البحث عن سائقين...'
          }
        </span>
        {nearbyDrivers > 0 && (
          <Heart className="w-3.5 h-3.5 text-success fill-success animate-pulse" />
        )}
      </div>

      {/* Dhikr Card - appears when wait time > 5 min (nearbyDrivers <= 1) */}
      {nearbyDrivers <= 1 && (
        <Card className="w-full max-w-sm mb-4 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 shadow-[0_0_15px_rgba(var(--primary)/0.15)]">
          <CardContent className="p-4">
            <p className="text-center text-sm text-primary mb-3 font-medium">
              ✨ استثمر وقت الانتظار بالذكر
            </p>
            
            <div className="flex justify-center gap-2">
              {/* استغفار */}
              <button
                onClick={() => handleDhikrTap('istighfar')}
                className={`flex flex-col items-center p-3 rounded-xl bg-card border border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 min-w-[85px] ${
                  lastTappedDhikr === 'istighfar' ? 'scale-95 shadow-[0_0_20px_rgba(var(--primary)/0.4)]' : ''
                }`}
              >
                <span className="text-xl mb-1">🤲</span>
                <span className="text-xs text-muted-foreground mb-1">استغفر الله</span>
                <span className={`text-lg font-bold text-primary transition-all duration-200 ${
                  lastTappedDhikr === 'istighfar' ? 'scale-125' : ''
                }`}>
                  {dhikrCounts.istighfar}
                </span>
              </button>

              {/* تسبيح */}
              <button
                onClick={() => handleDhikrTap('tasbih')}
                className={`flex flex-col items-center p-3 rounded-xl bg-card border border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 min-w-[85px] ${
                  lastTappedDhikr === 'tasbih' ? 'scale-95 shadow-[0_0_20px_rgba(var(--primary)/0.4)]' : ''
                }`}
              >
                <span className="text-xl mb-1">📿</span>
                <span className="text-xs text-muted-foreground mb-1">سبحان الله</span>
                <span className={`text-lg font-bold text-primary transition-all duration-200 ${
                  lastTappedDhikr === 'tasbih' ? 'scale-125' : ''
                }`}>
                  {dhikrCounts.tasbih}
                </span>
              </button>

              {/* تحميد */}
              <button
                onClick={() => handleDhikrTap('tahmid')}
                className={`flex flex-col items-center p-3 rounded-xl bg-card border border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 min-w-[85px] ${
                  lastTappedDhikr === 'tahmid' ? 'scale-95 shadow-[0_0_20px_rgba(var(--primary)/0.4)]' : ''
                }`}
              >
                <span className="text-xl mb-1">✨</span>
                <span className="text-xs text-muted-foreground mb-1">الحمد لله</span>
                <span className={`text-lg font-bold text-primary transition-all duration-200 ${
                  lastTappedDhikr === 'tahmid' ? 'scale-125' : ''
                }`}>
                  {dhikrCounts.tahmid}
                </span>
              </button>
            </div>

            {totalDhikr > 0 && (
              <p className="text-center text-xs text-muted-foreground mt-3 animate-fade-in">
                المجموع: <span className="text-primary font-bold">{totalDhikr}</span> ذكر
              </p>
            )}
          </CardContent>
        </Card>
      )}

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

      {/* Nearby Drivers Map - NEW */}
      <div className="w-full max-w-sm mb-4">
        <NearbyDriversMiniMap
          drivers={[]} // سيتم تحديثها من البيانات الحقيقية
          userLocation={{ lat: 33.3157, lng: 44.3615 }} // تحتاج للحصول من الحالة الفعلية
          height="h-32"
        />
      </div>

      {/* Share Ride Location - NEW */}
      <div className="w-full max-w-sm mb-4 px-4">
        <ShareRideLocation
          rideId={rideId}
          pickupLocation={{ lat: 33.3157, lng: 44.3615, address: pickupAddress }}
          dropoffLocation={{ lat: 33.3157, lng: 44.3615, address: dropoffAddress }}
          estimatedFare={estimatedFare}
        />
      </div>

      {/* Cancel button */}
      <Button 
        variant="outline"
        className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
        onClick={handleCancelClick}
        disabled={cancelling}
      >
        {cancelling ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin ml-2" />
            جاري الإلغاء...
          </>
        ) : (
          <>
            <X className="w-4 h-4 ml-2" />
            إلغاء الطلب
          </>
        )}
      </Button>

      {/* Tip */}
      <p className="text-xs text-muted-foreground mt-6 text-center max-w-xs">
        ستتلقى إشعاراً فور قبول سائق لطلبك. يمكنك إلغاء الطلب مجاناً قبل القبول.
      </p>

      {/* Cancellation Reason Dialog */}
      <CancellationReasonDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onConfirm={handleConfirmCancel}
        isLoading={cancelling}
        rideStatus={rideStatus}
        estimatedFare={estimatedFare}
      />
    </motion.div>
  );
};

export default RideWaitingScreen;
