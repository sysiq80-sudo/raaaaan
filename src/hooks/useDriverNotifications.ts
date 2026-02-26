import { useEffect, useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { startRideAlert, stopRideAlert } from "@/lib/loudAlerts";
import { playNotificationSound } from "@/lib/audioContext";
import { isNativePlatform, onAppStateChange, showNativeNotification, nativeHaptic } from "@/lib/capacitorBridge";
import { useDriverStore } from "@/stores/driverStore";
import { 
  isNotificationMutedNow, 
  acceptRideFromNotification,
  registerFCMToken,
  syncNotificationPreferences 
} from "@/services/driverNotificationService";

interface NewRide {
  id: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  estimated_fare: number | null;
  vehicle_type: string;
  status: string;
  distance_km: number | null;
}

// Create audio context for notification sounds
const createNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playTone = (frequency: number, duration: number, startTime: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.5, startTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    // Play an attention-grabbing notification melody
    const now = audioContext.currentTime;
    playTone(880, 0.12, now);        // A5
    playTone(1108.73, 0.12, now + 0.12); // C#6
    playTone(1318.51, 0.25, now + 0.24);  // E6
    
    // Repeat pattern
    setTimeout(() => {
      const now2 = audioContext.currentTime;
      playTone(880, 0.12, now2);
      playTone(1108.73, 0.12, now2 + 0.12);
      playTone(1318.51, 0.25, now2 + 0.24);
    }, 600);

  } catch (e) {
    console.log('Audio notification not supported');
  }
};

// Vibration pattern for mobile — guarded by user-interaction policy
const vibrateDevice = () => {
  // Only vibrate after user has interacted with the page (browser policy)
  import('../lib/userGestureTracker').then(({ safeVibrate }) => {
    safeVibrate([300, 100, 300, 100, 400]);
  }).catch(() => { /* ignore */ });
};

export const useDriverNotifications = (driverId: string | null, vehicleType: string | null) => {
  const { toast } = useToast();
  const notifiedRides = useRef<Set<string>>(new Set());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');

  // Request notification permission with user feedback
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }

    if (Notification.permission === 'granted') {
      setNotificationPermission('granted');
      return;
    }

    if (Notification.permission === 'denied') {
      setNotificationPermission('denied');
      toast({
        title: "الإشعارات محظورة",
        description: "يرجى تفعيل الإشعارات من إعدادات المتصفح لاستقبال تنبيهات الطلبات الجديدة",
        variant: "destructive",
        duration: 8000,
      });
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === 'granted') {
        toast({
          title: "تم تفعيل الإشعارات ✅",
          description: "ستصلك إشعارات عند وصول طلبات جديدة",
        });
        
        // Send test notification
        new Notification('ران كابتن 🚗', {
          body: 'تم تفعيل الإشعارات بنجاح! ستصلك تنبيهات الطلبات الجديدة هنا.',
          icon: '/favicon.ico',
          tag: 'test-notification'
        });
      } else {
        toast({
          title: "لم يتم تفعيل الإشعارات",
          description: "يمكنك تفعيلها لاحقاً من الإعدادات",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  }, [toast]);

  const showPushNotification = useCallback((ride: Record<string, unknown>) => {
    const estimatedFare = (ride.estimated_fare as number) || 0;
    const pickupAddress = (ride.pickup_address as string) || 'موقع غير محدد';
    const dropoffAddress = (ride.dropoff_address as string) || '';
    const distance = (ride.distance_km as number) || 0;

    // ═══ التحقق من إعدادات الصوت والاهتزاز من المخزن المركزي ═══
    const storeState = useDriverStore.getState();
    const shouldPlaySound = storeState.soundsEnabled;
    const shouldVibrate = storeState.vibrationEnabled;

    // 🔊 تشغيل تنبيه صوتي قوي ومتكرر (Loud Alert System)
    if (shouldPlaySound) {
      startRideAlert();
      
      // تشغيل الصوت المركزي كإضافة
      playNotificationSound();
    }
    
    // Vibrate device — استخدام اهتزاز أصلي في Capacitor
    if (shouldVibrate) {
      if (isNativePlatform) {
        nativeHaptic('heavy');
      } else {
        vibrateDevice();
      }
    }

    // Show enhanced toast notification
    toast({
      title: "🚗 طلب رحلة جديد!",
      description: `${estimatedFare.toLocaleString()} د.ع - ${pickupAddress}`,
      duration: 20000,
    });

    // إشعار أصلي عبر Capacitor (يعمل حتى لو التطبيق في الخلفية)
    if (isNativePlatform) {
      const notifBody = [
        `💰 الأجرة: ${estimatedFare.toLocaleString()} د.ع`,
        `📍 من: ${pickupAddress}`,
        dropoffAddress ? `🎯 إلى: ${dropoffAddress}` : '',
        distance > 0 ? `📏 المسافة: ${distance.toFixed(1)} كم` : ''
      ].filter(Boolean).join('\n');
      
      showNativeNotification(
        '🚗 طلب رحلة جديد!',
        notifBody,
        Math.floor(Date.now() / 1000)
      );
    }

    // Browser Push Notification (للويب فقط)
    if (!isNativePlatform && 'Notification' in window && Notification.permission === 'granted') {
      const notificationBody = [
        `💰 الأجرة: ${estimatedFare.toLocaleString()} د.ع`,
        `📍 من: ${pickupAddress}`,
        dropoffAddress ? `🎯 إلى: ${dropoffAddress}` : '',
        distance > 0 ? `📏 المسافة: ${distance.toFixed(1)} كم` : ''
      ].filter(Boolean).join('\n');

      const notification = new Notification('🚗 طلب رحلة جديد!', {
        body: notificationBody,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `new-ride-${ride.id}`,
        requireInteraction: true,
        silent: false,
        vibrate: [300, 100, 300, 100, 400]
      } as NotificationOptions);

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto close after 20 seconds
      setTimeout(() => notification.close(), 20000);
    }
  }, [toast]);

  // دالة للتحقق من مطابقة نوع السيارة
  // السائق يمكنه خدمة رحلات من نفس نوعه أو أقل
  const canDriverServeRide = useCallback((driverType: string | null, rideType: string): boolean => {
    if (!driverType) return true; // لا فلتر إذا لم يكن هناك نوع محدد
    
    // حالة خاصة: التكسي النسائي
    if (driverType === 'women_only') return rideType === 'women_only';
    if (rideType === 'women_only') return driverType === 'women_only';
    
    // ترتيب الأنواع من الأدنى للأعلى
    const typeHierarchy: Record<string, number> = {
      'economy': 1,
      'comfort': 2,
      'premium': 3
    };
    
    const driverLevel = typeHierarchy[driverType] || 1;
    const rideLevel = typeHierarchy[rideType] || 1;
    
    // السائق يمكنه خدمة رحلات من نفس مستواه أو أقل
    return rideLevel <= driverLevel;
  }, []);

  const handleNewRide = useCallback((payload: { new: Record<string, unknown> }) => {
    const ride = payload.new;
    const rideId = ride.id as string;
    const rideStatus = ride.status as string;
    const rideVehicleType = ride.vehicle_type as string;
    const preferWomenDriver = Boolean(ride.prefer_women_driver);

    // Only notify for pending rides
    if (rideStatus !== 'pending') return;

    // ═══ فحص جدول الكتم — لا تُظهر إشعار إذا كان الكتم نشطاً ═══
    if (isNotificationMutedNow()) {
      console.log(`🔇 تم تخطي إشعار الرحلة ${rideId} — وضع الكتم نشط`);
      return;
    }

    // احترام تفضيل السائقة
    if (preferWomenDriver && vehicleType !== 'women_only') {
      console.log(`Skipping ride ${rideId}: prefers women driver`);
      return;
    }
    
    // Check vehicle type match using improved logic
    if (!canDriverServeRide(vehicleType, rideVehicleType)) {
      console.log(`Skipping ride ${rideId}: driver type ${vehicleType} cannot serve ${rideVehicleType}`);
      return;
    }
    
    // Prevent duplicate notifications
    if (notifiedRides.current.has(rideId)) return;
    notifiedRides.current.add(rideId);

    console.log('New ride notification:', ride);
    showPushNotification(ride);
  }, [vehicleType, showPushNotification, canDriverServeRide]);

  // Subscribe to new rides with INSTANT realtime + Capacitor reconnection
  useEffect(() => {
    if (!driverId) return;

    console.log('🔴 Setting up INSTANT ride notifications for driver:', driverId);
    let cleanupAppState: (() => void) | null = null;
    let swMessageHandler: ((event: MessageEvent) => void) | null = null;

    const channelName = `driver-new-rides-${driverId}`;
    
    // ═══ مزامنة تفضيلات الإشعارات + تسجيل FCM ═══
    syncNotificationPreferences(driverId).catch(() => {});
    if (isNativePlatform) {
      registerFCMToken(driverId).catch(() => {});
    }
    
    // ═══ مستمع رسائل SW — قبول الرحلة من الإشعار ═══
    if ('serviceWorker' in navigator) {
      swMessageHandler = (event: MessageEvent) => {
        if (event.data?.type === 'ACCEPT_RIDE_FROM_NOTIFICATION' && event.data?.rideId) {
          console.log('✅ قبول الرحلة من إشعار SW:', event.data.rideId);
          acceptRideFromNotification(event.data.rideId, driverId)
            .then((success) => {
              if (success) {
                toast({
                  title: "✅ تم قبول الرحلة",
                  description: "جارٍ توجيهك إلى موقع الراكب",
                });
                // إيقاف التنبيه
                stopRideAlert();
              } else {
                toast({
                  title: "⚠️ الرحلة لم تعد متاحة",
                  description: "ربما تم قبولها من سائق آخر",
                  variant: "destructive",
                });
              }
            })
            .catch(() => {});
        }
      };
      navigator.serviceWorker.addEventListener('message', swMessageHandler);
    }
    
    // ═══ التحقق من قبول رحلة معلقة (من FCM أو URL param) ═══
    try {
      const pendingAcceptRide = localStorage.getItem('raan_pending_accept_ride');
      if (pendingAcceptRide) {
        localStorage.removeItem('raan_pending_accept_ride');
        acceptRideFromNotification(pendingAcceptRide, driverId).catch(() => {});
      }
    } catch {
      // صامت
    }
    
    const createChannel = () => {
      // إزالة أي قناة قديمة بنفس الاسم قبل إعادة الإنشاء
      const existingChannel = supabase.getChannels().find(ch => ch.topic === `realtime:${channelName}`);
      if (existingChannel) {
        supabase.removeChannel(existingChannel);
      }
      
      const ch = supabase
        .channel(channelName)
        // ═══ INSERT: رحلات تُنشأ مباشرة بحالة pending (من التطبيق/الويب) ═══
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'rides',
            filter: 'status=eq.pending'
          },
          (payload) => {
            console.log('⚡ INSTANT INSERT: New ride detected:', payload.new?.id);
            handleNewRide(payload as { new: Record<string, unknown> });
          }
        )
        // ═══ UPDATE: رحلات تتحول من draft → pending (من واتساب/حجز مجدول) ═══
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rides',
            filter: 'status=eq.pending'
          },
          (payload) => {
            // فقط عندما تتحول الحالة إلى pending (مثل تأكيد حجز واتساب)
            const oldStatus = (payload.old as Record<string, unknown>)?.status;
            const newStatus = (payload.new as Record<string, unknown>)?.status;
            if (newStatus === 'pending' && oldStatus !== 'pending') {
              console.log('⚡ INSTANT UPDATE: Ride became pending:', payload.new?.id, `(${oldStatus} → ${newStatus})`);
              handleNewRide(payload as { new: Record<string, unknown> });
            }
          }
        )
        .subscribe((status) => {
          console.log('🔴 Notification subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ INSTANT notifications ready — listening for INSERT + UPDATE to pending');
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('⚠️ Realtime channel error — will retry in 3s');
            setTimeout(() => {
              supabase.removeChannel(ch);
              createChannel();
            }, 3000);
          }
        });
      
      return ch;
    };
    
    let channel = createChannel();

    // 📱 Capacitor: إعادة اتصال Realtime عند عودة التطبيق من الخلفية
    const setupAppStateListener = async () => {
      cleanupAppState = await onAppStateChange((isActive) => {
        if (isActive) {
          console.log('📱 التطبيق عاد للمقدمة — إعادة اتصال Realtime...');
          
          // إعادة إنشاء القناة لضمان اتصال جديد
          try {
            supabase.removeChannel(channel);
          } catch (e) {
            // تجاهل خطأ إزالة القناة القديمة
          }
          channel = createChannel();
          
          // استئناف AudioContext المعلق (مطلوب في الأجهزة المحمولة)
          try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) {
              const tempCtx = new AudioCtx();
              if (tempCtx.state === 'suspended') {
                tempCtx.resume();
              }
              tempCtx.close();
            }
          } catch {
            // تجاهل
          }
        } else {
          console.log('📱 التطبيق ذهب للخلفية');
        }
      });
    };
    
    setupAppStateListener();

    return () => {
      console.log('Cleaning up ride notification subscription');
      supabase.removeChannel(channel);
      if (cleanupAppState) cleanupAppState();
      if (swMessageHandler && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', swMessageHandler);
      }
    };
  }, [driverId, handleNewRide]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
      
      // Auto-request if permission is default
      if (Notification.permission === 'default') {
        // Delay to not be too aggressive
        const timer = setTimeout(() => {
          requestNotificationPermission();
        }, 3000);
        return () => clearTimeout(timer);
      }
    } else {
      setNotificationPermission('unsupported');
    }
  }, [requestNotificationPermission]);

  return {
    notificationPermission,
    requestNotificationPermission
  };
};
