/**
 * ران - بطاقة طلب الرحلة (React Native)
 * تعرض طلبات الرحلات الواردة مع عد تنازلي 30 ثانية
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Vibration,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { roundFare } from '@/lib/constants';
import type { Location } from '@/types';

const { width } = Dimensions.get('window');
const COUNTDOWN_SECONDS = 30;

interface RideRequestData {
  id: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  estimated_fare: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  vehicle_type: string;
  surge_multiplier: number | null;
  created_at: string;
}

interface Props {
  driverId: string;
  vehicleType: string | null;
  isOnline: boolean;
  driverLocation?: Location | null;
  onRideAccepted?: () => void;
}

export default function RideRequestCard({
  driverId,
  vehicleType,
  isOnline,
  driverLocation,
  onRideAccepted,
}: Props) {
  const [rides, setRides] = useState<RideRequestData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [accepting, setAccepting] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentRide = rides[currentIndex] ?? null;

  // جلب الرحلات المتاحة
  const fetchRides = useCallback(async () => {
    if (!isOnline || !driverId) return;

    let query = supabase
      .from('rides')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);

    if (vehicleType) {
      query = query.eq('vehicle_type', vehicleType);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      setRides(data);
      setCurrentIndex(0);
      resetCountdown(data[0]);
    } else {
      setRides([]);
    }
  }, [isOnline, driverId, vehicleType]);

  // استماع Realtime
  useEffect(() => {
    if (!isOnline || !driverId) return;

    fetchRides();

    const channel = supabase
      .channel(`rides-pending-${driverId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rides', filter: 'status=eq.pending' },
        () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          Vibration.vibrate([0, 500, 200, 500]);
          fetchRides();
        },
      )
      .subscribe();

    // Polling كاحتياط
    const poll = setInterval(fetchRides, 30000); // كان 15 ثانية — رُفع لتقليل Disk IO

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [isOnline, driverId, fetchRides]);

  // عد تنازلي
  const resetCountdown = (ride: RideRequestData) => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    const createdAt = new Date(ride.created_at).getTime();
    const elapsed = Math.floor((Date.now() - createdAt) / 1000);
    const remaining = Math.max(COUNTDOWN_SECONDS - elapsed, 0);
    setCountdown(remaining);

    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          handleSkip();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // إظهار/إخفاء البطاقة
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: currentRide ? 0 : 300,
      useNativeDriver: true,
      tension: 50,
      friction: 10,
    }).start();
  }, [currentRide]);

  // قبول الرحلة
  const handleAccept = async () => {
    if (!currentRide || accepting) return;
    setAccepting(true);

    try {
      const { error } = await supabase
        .from('rides')
        .update({ driver_id: driverId, status: 'accepted' })
        .eq('id', currentRide.id)
        .eq('status', 'pending');

      if (!error) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onRideAccepted?.();
        setRides([]);
      } else {
        // الرحلة أُخذت من سائق آخر
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        handleSkip();
      }
    } catch {
      handleSkip();
    } finally {
      setAccepting(false);
    }
  };

  // تخطي/رفض
  const handleSkip = () => {
    if (currentIndex < rides.length - 1) {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      resetCountdown(rides[next]);
    } else {
      setRides([]);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  if (!currentRide) return null;

  const fare = currentRide.estimated_fare
    ? roundFare(currentRide.estimated_fare)
    : null;
  const isUrgent = countdown <= 10;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
    >
      {/* العد التنازلي */}
      <View style={[styles.countdownBar, isUrgent && styles.countdownUrgent]}>
        <Text style={styles.countdownText}>{countdown} ث</Text>
        <View
          style={[
            styles.countdownProgress,
            { width: `${(countdown / COUNTDOWN_SECONDS) * 100}%` },
            isUrgent && styles.countdownProgressUrgent,
          ]}
        />
      </View>

      {/* تفاصيل الرحلة */}
      <View style={styles.body}>
        {/* السعر والمسافة */}
        <View style={styles.fareRow}>
          <View style={styles.fareContainer}>
            <Text style={styles.fareValue}>
              {fare ? `${fare.toLocaleString()} د.ع` : 'غير محدد'}
            </Text>
            {currentRide.surge_multiplier && currentRide.surge_multiplier > 1 && (
              <View style={styles.surgeBadge}>
                <Text style={styles.surgeText}>
                  ×{currentRide.surge_multiplier.toFixed(1)}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.distanceText}>
            {currentRide.distance_km
              ? `${currentRide.distance_km.toFixed(1)} كم`
              : ''}
            {currentRide.duration_minutes
              ? ` • ${currentRide.duration_minutes} د`
              : ''}
          </Text>
        </View>

        {/* العناوين */}
        <View style={styles.addressContainer}>
          <View style={styles.addressRow}>
            <View style={styles.dotGreen} />
            <Text style={styles.addressText} numberOfLines={1}>
              {currentRide.pickup_address || 'نقطة الانطلاق'}
            </Text>
          </View>
          <View style={styles.addressLine} />
          <View style={styles.addressRow}>
            <View style={styles.dotBlue} />
            <Text style={styles.addressText} numberOfLines={1}>
              {currentRide.dropoff_address || 'الوجهة'}
            </Text>
          </View>
        </View>

        {/* عداد الرحلات */}
        {rides.length > 1 && (
          <Text style={styles.rideCount}>
            {currentIndex + 1} / {rides.length}
          </Text>
        )}

        {/* الأزرار */}
        <View style={styles.buttonsRow}>
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>تخطي</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptButton, accepting && styles.buttonDisabled]}
            onPress={handleAccept}
            disabled={accepting}
          >
            <Text style={styles.acceptText}>
              {accepting ? 'جاري القبول...' : 'قبول'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 12,
    right: 12,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  countdownBar: {
    height: 32,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  countdownUrgent: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  countdownText: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: 'bold',
    zIndex: 1,
  },
  countdownProgress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#00d9a5',
    opacity: 0.3,
  },
  countdownProgressUrgent: {
    backgroundColor: '#ef4444',
  },
  body: {
    padding: 16,
    gap: 14,
  },
  fareRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fareContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  fareValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00d9a5',
  },
  surgeBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  surgeText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: 'bold',
  },
  distanceText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  addressContainer: {
    gap: 4,
  },
  addressRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  dotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
  },
  dotBlue: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2A6CD5',
  },
  addressLine: {
    width: 2,
    height: 14,
    backgroundColor: '#475569',
    marginRight: 4, // RTL: aligns with dots
    alignSelf: 'flex-end',
    marginHorizontal: 14,
  },
  addressText: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 14,
    textAlign: 'right',
  },
  rideCount: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
  },
  buttonsRow: {
    flexDirection: 'row-reverse',
    gap: 12,
  },
  acceptButton: {
    flex: 2,
    backgroundColor: '#00d9a5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  skipButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  acceptText: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: 'bold',
  },
  skipText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
});
