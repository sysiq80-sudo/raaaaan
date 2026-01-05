import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { playSound, vibrate, VibrationPatterns, showNotification } from '@/utils/rideNotificationSounds';

export interface ActiveRide {
  id: string;
  pickup_location: { lat: number; lng: number };
  dropoff_location: { lat: number; lng: number };
  pickup_address: string | null;
  dropoff_address: string | null;
  status: string;
  estimated_fare: number | null;
  final_fare: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  vehicle_type: string;
  driver_id: string | null;
  created_at: string;
  completed_at: string | null;
  driver_rating?: number | null;
}

export const useActiveRide = (userId: string | null) => {
  const { toast } = useToast();
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [pendingRideId, setPendingRideId] = useState<string | null>(null);
  const [showWaitingScreen, setShowWaitingScreen] = useState(false);
  const [showLiveTracker, setShowLiveTracker] = useState(false);
  const previousStatusRef = useRef<string | null>(null);

  // Helper to parse ride data
  const parseRideData = useCallback((rideData: any): ActiveRide => ({
    id: rideData.id,
    pickup_location: rideData.pickup_location,
    dropoff_location: rideData.dropoff_location,
    pickup_address: rideData.pickup_address,
    dropoff_address: rideData.dropoff_address,
    status: rideData.status,
    estimated_fare: rideData.estimated_fare,
    final_fare: rideData.final_fare,
    distance_km: rideData.distance_km,
    duration_minutes: rideData.duration_minutes,
    vehicle_type: rideData.vehicle_type,
    driver_id: rideData.driver_id,
    created_at: rideData.created_at,
    completed_at: rideData.completed_at,
    driver_rating: rideData.driver_rating
  }), []);

  // Handle ride status change with notifications
  const handleStatusChange = useCallback((newStatus: string, previousStatus: string | null, updatedRide: any) => {
    console.log('[useActiveRide] Status changed:', previousStatus, '->', newStatus);
    
    if (newStatus === 'cancelled' || newStatus === 'completed') {
      setActiveRide(null);
      setShowLiveTracker(false);
      setShowWaitingScreen(false);
      setPendingRideId(null);
      
      if (newStatus === 'cancelled') {
        playSound('cancelled');
        vibrate(VibrationPatterns.cancelled);
        toast({
          title: "تم إلغاء الرحلة ❌",
          description: updatedRide.cancellation_reason || "تم إلغاء الرحلة",
          variant: "destructive"
        });
      }
      return;
    }

    // Handle accepted status
    if (newStatus === 'accepted' && previousStatus === 'pending') {
      console.log('[useActiveRide] 🎉 Driver accepted! Switching to live tracker');
      
      playSound('accepted');
      vibrate(VibrationPatterns.accepted);
      
      toast({
        title: "🎉 تم قبول طلبك!",
        description: "السائق في الطريق إليك الآن",
        duration: 8000,
      });
      
      showNotification(
        '🎉 تم قبول طلبك!',
        'السائق في الطريق إليك - انتظره في موقع الانطلاق',
        { tag: 'ride-accepted', requireInteraction: true }
      );
      
      // Switch screens immediately
      setShowWaitingScreen(false);
      setShowLiveTracker(true);
      setPendingRideId(null);
    }

    // Handle arrived status
    if (newStatus === 'arrived' && previousStatus !== 'arrived') {
      playSound('arrived');
      vibrate(VibrationPatterns.arrived);
      
      toast({
        title: "🔔 السائق وصل!",
        description: "اخرج الآن - السائق في انتظارك",
        duration: 10000,
      });
      
      showNotification(
        '🔔 السائق وصل!',
        'اخرج الآن - السائق في انتظارك عند موقع الانطلاق',
        { tag: 'driver-arrived', requireInteraction: true }
      );
    }

    // Handle in_progress status
    if (newStatus === 'in_progress' && previousStatus !== 'in_progress') {
      playSound('inProgress');
      vibrate(VibrationPatterns.inProgress);
      
      toast({
        title: "🛣️ انطلقت الرحلة!",
        description: "أنت في الطريق للوجهة - رحلة موفقة",
        duration: 5000,
      });
    }

    // Update ride state
    const parsedRide = parseRideData(updatedRide);
    setActiveRide(parsedRide);
  }, [toast, parseRideData]);

  // Check for active ride on mount
  const checkActiveRide = useCallback(async () => {
    if (!userId) return;

    const { data: ride, error } = await supabase
      .from('rides')
      .select('*')
      .eq('rider_id', userId)
      .in('status', ['pending', 'accepted', 'arrived', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!error && ride) {
      const rideData = ride as any;
      const parsedRide = parseRideData(rideData);
      
      setActiveRide(parsedRide);
      previousStatusRef.current = rideData.status;
      
      if (rideData.status === 'pending') {
        setPendingRideId(rideData.id);
        setShowWaitingScreen(true);
        setShowLiveTracker(false);
      } else {
        setPendingRideId(null);
        setShowWaitingScreen(false);
        setShowLiveTracker(true);
      }
    } else {
      setActiveRide(null);
      setShowLiveTracker(false);
      setShowWaitingScreen(false);
      setPendingRideId(null);
      previousStatusRef.current = null;
    }
  }, [userId, parseRideData]);

  useEffect(() => {
    if (!userId) return;
    
    // Initial check
    checkActiveRide();

    // Setup realtime subscription with better event handling
    const channel = supabase
      .channel(`rider-ride-updates-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events including INSERT and UPDATE
          schema: 'public',
          table: 'rides',
          filter: `rider_id=eq.${userId}`
        },
        (payload) => {
          console.log('[useActiveRide] 📡 Realtime update received:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newRide = payload.new as any;
            if (newRide.status === 'pending') {
              setActiveRide(parseRideData(newRide));
              setPendingRideId(newRide.id);
              setShowWaitingScreen(true);
              previousStatusRef.current = 'pending';
            }
          }
          
          if (payload.eventType === 'UPDATE') {
            const updatedRide = payload.new as any;
            const newStatus = updatedRide.status;
            const prevStatus = previousStatusRef.current;
            
            // Update previous status ref
            previousStatusRef.current = newStatus;
            
            // Handle the status change
            handleStatusChange(newStatus, prevStatus, updatedRide);
          }
        }
      )
      .subscribe((status) => {
        console.log('[useActiveRide] Subscription status:', status);
      });

    // Fallback polling every 10 seconds for critical updates (reduced from 5s)
    const pollInterval = setInterval(async () => {
      if (!activeRide) return;
      
      const { data } = await supabase
        .from('rides')
        .select('status, driver_id')
        .eq('id', activeRide.id)
        .single();
      
      if (data && data.status !== previousStatusRef.current) {
        console.log('[useActiveRide] Poll detected status change:', previousStatusRef.current, '->', data.status);
        checkActiveRide();
      }
    }, 10000); // Increased from 5000ms to 10000ms - realtime should handle most updates

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [userId, checkActiveRide, handleStatusChange, parseRideData, activeRide?.id]);

  const clearActiveRide = useCallback(() => {
    setActiveRide(null);
    setShowLiveTracker(false);
    setShowWaitingScreen(false);
    setPendingRideId(null);
    previousStatusRef.current = null;
  }, []);

  return {
    activeRide,
    setActiveRide,
    pendingRideId,
    setPendingRideId,
    showWaitingScreen,
    setShowWaitingScreen,
    showLiveTracker,
    setShowLiveTracker,
    clearActiveRide,
    refreshRide: checkActiveRide
  };
};
