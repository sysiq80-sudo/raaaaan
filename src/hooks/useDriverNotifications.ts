import { useEffect, useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { startRideAlert, stopRideAlert } from "@/lib/loudAlerts";
import { playNotificationSound, resumeAudioContext } from "@/lib/audioContext";
import { isNativePlatform, onAppStateChange, showNativeNotification, nativeHaptic } from "@/lib/capacitorBridge";
import { capacitorStorageSync } from "@/lib/capacitorStorage";
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

// تشغيل صوت الإشعار باستخدام AudioContext المشترك (بدون إنشاء سياق جديد)
const createNotificationSound = () => {
  // نستخدم الصوت المركزي من audioContext.ts بدلاً من إنشاء AudioContext منفصل
  playNotificationSound();
};

// Vibration pattern for mobile — guarded by user-interaction policy
const vibrateDevice = () => {
  // Only vibrate after user has interacted with the page (browser policy)
  import('../lib/userGestureTracker').then(({ safeVibrate }) => {
    safeVibrate([300, 100, 300, 100, 400]);
  }).catch(() => { /* ignore */ });
};

// دالة رياضية لحساب المسافة الجغرافية السريعة (Haversine) للفلترة المحلية
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // نصف قطر الأرض بالكيلومتر
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

export const useDriverNotifications = (
  driverId: string | null, 
  vehicleType: string | null,
  driverLocation?: { lat: number; lng: number } | null,
  maxPickupRadius: number = 10
) => {
  const { toast } = useToast();
  const DRIVER_NOTIFICATION_DEDUPE_TTL_MS = 300_000; // 5 دقائق لتفادي إعادة الإشعار عند إعادة الاتصال
  const CHANNEL_STALE_MS = 120_000;
  const dedupeMapRef = useRef<Map<string, number>>(new Map());
  const lastRealtimeEventAtRef = useRef<number>(Date.now());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');

  // ═══ Refs لتثبيت handleNewRide — تمنع إعادة إنشاء الاشتراك عند تغيير الموقع ═══
  const driverLocationRef = useRef(driverLocation);
  driverLocationRef.current = driverLocation;
  const maxPickupRadiusRef = useRef(maxPickupRadius);
  maxPickupRadiusRef.current = maxPickupRadius;
  const showPushNotificationRef = useRef<((ride: Record<string, unknown>) => void) | null>(null);

  const openRideRequestFromNotification = useCallback((rideId: string) => {
    if (!rideId) return;

    try {
      capacitorStorageSync.setItem('raan_pending_open_ride', rideId);
    } catch {
      // ignore localStorage failures
    }

    const targetUrl = `/driver?ride_id=${rideId}&action=open_request`;

    if (window.location.pathname === '/driver') {
      window.history.replaceState({}, '', targetUrl);
      window.dispatchEvent(new PopStateEvent('popstate'));
      return;
    }

    window.location.assign(targetUrl);
  }, []);

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
    const rideId = ride.id as string;

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

    // إشعار أصلي عبر Capacitor مع أزرار (قبول/رفض)
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
        undefined,
        {
          channelId: 'raan-rides',
          priority: 'high',
          data: { rideId, action: 'open_request' },
          actionButtons: [
            { id: 'accept', title: '✅ قبول' },
            { id: 'reject', title: '❌ رفض' },
          ],
        }
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
        tag: `new-ride-${rideId}`,
        requireInteraction: true,
        silent: false,
        vibrate: [300, 100, 300, 100, 400],
        data: {
          rideId,
          url: `/driver?ride_id=${rideId}&action=open_request`
        }
      } as NotificationOptions);

      notification.onclick = () => {
        window.focus();
        openRideRequestFromNotification(rideId);
        notification.close();
      };

      // Auto close after 20 seconds
      setTimeout(() => notification.close(), 20000);
    }
  }, [toast, openRideRequestFromNotification]);

  // تحديث ref لتجنب إعادة إنشاء handleNewRide عند تغير showPushNotification
  showPushNotificationRef.current = showPushNotification;

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
    // \ud83d\udee1\ufe0f \u0644\u0627 \u062a\u0638\u0647\u0631 \u0625\u0634\u0639\u0627\u0631\u0627\u062a \u0631\u062d\u0644\u0627\u062a \u062c\u062f\u064a\u062f\u0629 \u0625\u0630\u0627 \u0627\u0644\u0633\u0627\u0626\u0642 \u0644\u062f\u064a\u0647 \u0631\u062d\u0644\u0629 \u0646\u0634\u0637\u0629
    const storeState = useDriverStore.getState();
    if (storeState.activeRide) {
      console.log('\ud83d\udee1\ufe0f Suppressed new ride notification — driver has active ride');
      return;
    }

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
    
    // 🛡️ فلترة جغرافية (Distance check) محلياً لتجنب الـ Phantom Notifications
    // إذا كان السائق ضمن مسافة maxPickupRadius، نُشعره، وإلا يتم تجاهله
    const loc = driverLocationRef.current;
    const radius = maxPickupRadiusRef.current;
    if (loc && ride.pickup_location) {
      const pLoc = ride.pickup_location as { lat: number; lng: number };
      const distance = calculateDistance(loc.lat, loc.lng, pLoc.lat, pLoc.lng);
      
      // زيادة استثنائية 2 كم تعويضاً للطوارئ أو الحوافز
      if (distance > radius + 2) {
        console.log(`🔇 تم تخطي إشعار الرحلة ${rideId} — خارج النطاق (${distance.toFixed(1)} كم > ${radius} كم)`);
        return;
      }
    }
    
    // Prevent duplicate notifications with TTL window
    const now = Date.now();
    const lastShownAt = dedupeMapRef.current.get(rideId);
    if (typeof lastShownAt === 'number' && now - lastShownAt < DRIVER_NOTIFICATION_DEDUPE_TTL_MS) {
      return;
    }
    dedupeMapRef.current.set(rideId, now);

    // Cleanup expired dedupe entries
    for (const [id, timestamp] of dedupeMapRef.current.entries()) {
      if (now - timestamp > DRIVER_NOTIFICATION_DEDUPE_TTL_MS) {
        dedupeMapRef.current.delete(id);
      }
    }

    console.log('New ride notification:', ride);
    showPushNotificationRef.current?.(ride);
  }, [vehicleType, canDriverServeRide]);

  // Subscribe to new rides with INSTANT realtime + Capacitor reconnection
  useEffect(() => {
    if (!driverId) return;

    console.log('🔴 Setting up INSTANT ride notifications for driver:', driverId);
    let cleanupAppState: (() => void) | null = null;
    let swMessageHandler: ((event: MessageEvent) => void) | null = null;
    let visibilityHandler: (() => void) | null = null;
    let healthCheckTimer: ReturnType<typeof setInterval> | null = null;
    let localNotifListenerHandle: { remove: () => void } | null = null;

    const channelName = `driver-new-rides-${driverId}`;
    
    // ═══ مزامنة تفضيلات الإشعارات + تسجيل FCM ═══
    syncNotificationPreferences(driverId).catch(() => {});
    if (isNativePlatform) {
      registerFCMToken(driverId).catch(() => {});
      
      // ═══ مستمع أزرار الإشعارات المحلية (قبول/رفض) ═══
      import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
        LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
          const rideId = action.notification.extra?.rideId;
          if (!rideId) return;
          
          if (action.actionId === 'accept') {
            acceptRideFromNotification(rideId, driverId)
              .then((success) => {
                if (success) {
                  toast({ title: "✅ تم قبول الرحلة", description: "جارٍ توجيهك إلى موقع الراكب" });
                  stopRideAlert();
                } else {
                  toast({ title: "⚠️ الرحلة لم تعد متاحة", description: "ربما تم قبولها من سائق آخر", variant: "destructive" });
                }
              }).catch(() => {});
          } else if (action.actionId !== 'reject') {
            openRideRequestFromNotification(rideId);
          }
          // reject = مجرد إغلاق الإشعار
        }).then((listener) => {
          localNotifListenerHandle = listener;
        }).catch(() => {});
      }).catch(() => {});
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
        } else if (event.data?.type === 'OPEN_RIDE_REQUEST_FROM_NOTIFICATION' && event.data?.rideId) {
          openRideRequestFromNotification(event.data.rideId);
        }
      };
      navigator.serviceWorker.addEventListener('message', swMessageHandler);
    }
    
    // ═══ التحقق من قبول رحلة معلقة (من FCM أو URL param) ═══
    try {
      const pendingAcceptRide = capacitorStorageSync.getItem('raan_pending_accept_ride');
      if (pendingAcceptRide) {
        capacitorStorageSync.removeItem('raan_pending_accept_ride');
        acceptRideFromNotification(pendingAcceptRide, driverId).catch(() => {});
      }

      const pendingOpenRide = capacitorStorageSync.getItem('raan_pending_open_ride');
      if (pendingOpenRide) {
        capacitorStorageSync.removeItem('raan_pending_open_ride');
        openRideRequestFromNotification(pendingOpenRide);
      }
    } catch {
      // صامت
    }
    
    // ═══ نظام إعادة المحاولة الذكي — Exponential Backoff ═══
    let retryCount = 0;
    const MAX_RETRIES = 5;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let isRetrying = false; // guard لمنع تشغيل retry متعدد

    const createChannel = () => {
      // إزالة أي قناة قديمة بنفس الاسم قبل إعادة الإنشاء
      try {
        const existingChannels = supabase.getChannels().filter(ch => ch.topic === `realtime:${channelName}`);
        existingChannels.forEach(ch => supabase.removeChannel(ch));
      } catch { /* صامت */ }
      
      const ch = supabase
        .channel(channelName)
        // ═══ INSERT: رحلات تُنشأ مباشرة بحالة pending ═══
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
            retryCount = 0; // إعادة تعيين عداد المحاولات عند نجاح الاتصال
            lastRealtimeEventAtRef.current = Date.now();
            handleNewRide(payload as { new: Record<string, unknown> });
          }
        )
        // ═══ UPDATE: فحص يدوي للحالة ═══
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rides',
          },
          (payload) => {
            const newStatus = (payload.new as Record<string, unknown>)?.status;
            const oldStatus = (payload.old as Record<string, unknown>)?.status;
            if (newStatus === 'pending' && oldStatus !== 'pending') {
              console.log('⚡ INSTANT UPDATE: Ride became pending:', payload.new?.id, `(${oldStatus} → ${newStatus})`);
              lastRealtimeEventAtRef.current = Date.now();
              handleNewRide(payload as { new: Record<string, unknown> });
            }
          }
        )
        .subscribe(async (status) => {
          console.log('🔴 Notification subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ INSTANT notifications ready — listening for INSERT + UPDATE to pending');
            retryCount = 0;
            isRetrying = false;
            // جلب فوري للرحلات المعلقة لتغطية أي رحلات أُنشئت أثناء إعادة الاتصال
            try {
              const cutoffTime = new Date(Date.now() - 30_000).toISOString();
              const { data: pendingRides } = await supabase
                .from('rides')
                .select('id, pickup_address, dropoff_address, estimated_fare, vehicle_type, status, distance_km')
                .eq('status', 'pending')
                .gte('created_at', cutoffTime)
                .order('created_at', { ascending: false })
                .limit(5);
              if (pendingRides && pendingRides.length > 0) {
                console.log(`📥 Found ${pendingRides.length} pending rides on channel subscribe`);
                pendingRides.forEach(ride => {
                  handleNewRide({ new: ride as unknown as Record<string, unknown> });
                });
              }
            } catch (err) {
              console.warn('⚠️ Failed to fetch pending rides on subscribe:', err);
            }
          }
          if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !isRetrying) {
            if (retryCount >= MAX_RETRIES) {
              console.warn(`🚫 تجاوز الحد الأقصى للمحاولات (${MAX_RETRIES}) — سيتم إعادة المحاولة عند عودة التطبيق`);
              return;
            }
            const delay = Math.min(3000 * Math.pow(2, retryCount), 60000); // 3s, 6s, 12s, 24s, 48s, max 60s
            retryCount++;
            isRetrying = true;
            console.warn(`⚠️ Realtime error — retry ${retryCount}/${MAX_RETRIES} in ${delay/1000}s`);
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(() => {
              isRetrying = false;
              try { supabase.removeChannel(ch); } catch { /* صامت */ }
              channel = createChannel();
            }, delay);
          }
        });
      
      return ch;
    };

    const recreateChannel = (reason: string) => {
      console.log(`🔄 إعادة إنشاء قناة Realtime: ${reason}`);
      retryCount = 0;
      isRetrying = false;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      try {
        supabase.removeChannel(channel);
      } catch {
        // تجاهل خطأ إزالة القناة القديمة
      }
      lastRealtimeEventAtRef.current = Date.now();
      channel = createChannel();
    };
    
    let channel = createChannel();

    // 📱 Capacitor: إعادة اتصال Realtime عند عودة التطبيق من الخلفية
    const setupAppStateListener = async () => {
      cleanupAppState = await onAppStateChange((isActive) => {
        if (isActive) {
          console.log('📱 التطبيق عاد للمقدمة');
          recreateChannel('app_active');
          
          // استئناف AudioContext المشترك المعلق
          resumeAudioContext();
        } else {
          console.log('📱 التطبيق ذهب للخلفية');
        }
      });
    };
    
    setupAppStateListener();

    // Web/Hybrid visibility recovery — فقط إذا مر وقت كافٍ (تجنب إعادة الإنشاء المتكررة)
    visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        const staleForMs = Date.now() - lastRealtimeEventAtRef.current;
        if (staleForMs > 10000) {
          recreateChannel('visibility_visible');
        }
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    // Realtime health watchdog
    healthCheckTimer = setInterval(() => {
      const staleForMs = Date.now() - lastRealtimeEventAtRef.current;
      if (staleForMs > CHANNEL_STALE_MS) {
        recreateChannel('stale_channel');
      }
    }, 15_000);

    return () => {
      console.log('Cleaning up ride notification subscription');
      stopRideAlert();
      if (retryTimer) clearTimeout(retryTimer);
      if (healthCheckTimer) clearInterval(healthCheckTimer);
      supabase.removeChannel(channel);
      if (cleanupAppState) cleanupAppState();
      if (localNotifListenerHandle) localNotifListenerHandle.remove();
      if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
      }
      if (swMessageHandler && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', swMessageHandler);
      }
    };
    // ⚠️ مهم: toast مُستبعد من الـ deps عمداً — إدراجه يُعيد إنشاء الـ channel
    // عند كل إشعار toast مما يفقد الأحداث الواردة
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, handleNewRide, openRideRequestFromNotification]);

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
