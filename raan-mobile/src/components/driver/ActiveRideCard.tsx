/**
 * ران - بطاقة الرحلة النشطة (React Native)
 * تعرض تفاصيل الرحلة المقبولة/الجارية مع أزرار التحكم
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { roundFare } from '@/lib/constants';
import type { Location, RideStatus } from '@/types';

interface ActiveRideData {
  id: string;
  status: RideStatus;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string | null;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_address: string | null;
  estimated_fare: number | null;
  final_fare: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  rider_id: string;
  payment_method: string | null;
  started_at: string | null;
  created_at: string;
}

interface RiderInfo {
  full_name: string | null;
  phone: string | null;
}

interface Props {
  driverId: string;
  driverLocation?: Location | null;
  onRideCompleted?: () => void;
}

interface RideTrackingPoint {
  lat: number;
  lng: number;
  recorded_at: string;
}

interface RideTrackingQuality {
  status: 'ok' | 'gps_network_gap';
  has_tracking_gap: boolean;
  reason: string | null;
  reasons: string[];
  tracking_points_count: number;
  valid_points_count: number;
  expected_min_points: number;
  trip_duration_minutes: number;
  estimated_distance_km: number;
  final_gps_distance_km: number | null;
  source: 'driver-mobile';
  recorded_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  accepted: 'متجه للعميل',
  arrived: 'في انتظار العميل',
  in_progress: 'الرحلة جارية',
};

const STATUS_COLORS: Record<string, string> = {
  accepted: '#3b82f6',
  arrived: '#f59e0b',
  in_progress: '#22c55e',
};

export default function ActiveRideCard({
  driverId,
  driverLocation,
  onRideCompleted,
}: Props) {
  const [ride, setRide] = useState<ActiveRideData | null>(null);
  const [riderInfo, setRiderInfo] = useState<RiderInfo | null>(null);
  const [updating, setUpdating] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const slideAnim = useRef(new Animated.Value(400)).current;
  const trackingPoints = useRef<RideTrackingPoint[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // جلب الرحلة النشطة
  const fetchActiveRide = useCallback(async () => {
    const { data } = await supabase
      .from('rides')
      .select('*')
      .eq('driver_id', driverId)
      .in('status', ['accepted', 'arrived', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setRide(data);
      fetchRiderInfo(data.rider_id);
    } else {
      setRide(null);
    }
  }, [driverId]);

  // جلب معلومات الراكب
  const fetchRiderInfo = async (riderId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', riderId)
      .single();
    if (data) setRiderInfo(data);
  };

  useEffect(() => {
    fetchActiveRide();

    // Realtime لتحديثات الرحلة
    const channel = supabase
      .channel(`active-ride-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rides',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload: any) => {
          const updated = payload.new as ActiveRideData;
          if (['completed', 'cancelled'].includes(updated.status)) {
            setRide(null);
            onRideCompleted?.();
          } else {
            setRide(updated);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId, fetchActiveRide]);

  // عداد الوقت المنقضي
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (ride?.status === 'in_progress' && ride.started_at) {
      timerRef.current = setInterval(() => {
        const start = new Date(ride.started_at!).getTime();
        const diff = Math.floor((Date.now() - start) / 1000);
        const mins = Math.floor(diff / 60).toString().padStart(2, '0');
        const secs = (diff % 60).toString().padStart(2, '0');
        setElapsedTime(`${mins}:${secs}`);
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [ride?.status, ride?.started_at]);

  // تتبع GPS أثناء الرحلة
  useEffect(() => {
    if (ride?.status === 'in_progress' && driverLocation) {
      trackingPoints.current.push({
        lat: driverLocation.lat,
        lng: driverLocation.lng,
        recorded_at: new Date().toISOString(),
      });
    }
  }, [driverLocation, ride?.status]);

  // إظهار/إخفاء
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: ride ? 0 : 400,
      useNativeDriver: true,
      tension: 50,
      friction: 10,
    }).start();
  }, [ride]);

  // === User Actions ===

  const handleArrived = async () => {
    if (!ride || updating) return;
    setUpdating(true);
    const { error } = await supabase
      .from('rides')
      .update({ status: 'arrived' })
      .eq('id', ride.id)
      .eq('status', 'accepted');

    if (!error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRide((r) => r && { ...r, status: 'arrived' });
    }
    setUpdating(false);
  };

  const handleStartRide = async () => {
    if (!ride || updating) return;
    setUpdating(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('rides')
      .update({ status: 'in_progress', started_at: now })
      .eq('id', ride.id)
      .eq('status', 'arrived');

    if (!error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRide((r) => r && { ...r, status: 'in_progress', started_at: now });
      trackingPoints.current = [];
    }
    setUpdating(false);
  };

  const calculateGpsDistance = (points: RideTrackingPoint[]): number => {
    if (points.length < 2) return 0;

    const toRad = (deg: number) => (deg * Math.PI) / 180;
    let totalKm = 0;

    for (let i = 1; i < points.length; i++) {
      const radiusKm = 6371;
      const dLat = toRad(points[i].lat - points[i - 1].lat);
      const dLng = toRad(points[i].lng - points[i - 1].lng);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(points[i - 1].lat)) *
          Math.cos(toRad(points[i].lat)) *
          Math.sin(dLng / 2) ** 2;
      totalKm += radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    return Math.round(totalKm * 100) / 100;
  };

  const buildTrackingQuality = (
    points: RideTrackingPoint[],
    gpsDistance: number,
  ): RideTrackingQuality => {
    const estimatedKm = ride?.distance_km || 0;
    const durationMinutes = ride?.started_at
      ? Math.max(0, Math.floor((Date.now() - new Date(ride.started_at).getTime()) / 60000))
      : 0;
    const expectedMinPoints =
      durationMinutes >= 8 ? Math.min(8, Math.max(2, Math.floor(durationMinutes / 5))) : 2;
    const reasons: string[] = [];

    if (estimatedKm >= 1 && points.length < 2) reasons.push('missing_tracking_points');
    if (durationMinutes >= 8 && points.length < expectedMinPoints) {
      reasons.push('sparse_tracking_points');
    }
    if (estimatedKm >= 1 && gpsDistance <= 0) reasons.push('missing_final_gps_distance');
    if (
      estimatedKm >= 3 &&
      gpsDistance > 0 &&
      gpsDistance < estimatedKm * 0.4 &&
      points.length < expectedMinPoints
    ) {
      reasons.push('gps_distance_unreliable');
    }

    const hasTrackingGap = reasons.length > 0;

    return {
      status: hasTrackingGap ? 'gps_network_gap' : 'ok',
      has_tracking_gap: hasTrackingGap,
      reason: reasons[0] || null,
      reasons,
      tracking_points_count: points.length,
      valid_points_count: points.length,
      expected_min_points: expectedMinPoints,
      trip_duration_minutes: durationMinutes,
      estimated_distance_km: estimatedKm,
      final_gps_distance_km: gpsDistance > 0 ? gpsDistance : null,
      source: 'driver-mobile',
      recorded_at: new Date().toISOString(),
    };
  };

  const handleCompleteRide = async () => {
    if (!ride || updating) return;
    setUpdating(true);

    try {
      const gpsDistance = calculateGpsDistance(trackingPoints.current);
      const trackingQuality = buildTrackingQuality(trackingPoints.current, gpsDistance);
      const gpsDistanceForAudit =
        !trackingQuality.has_tracking_gap && gpsDistance > 0 ? gpsDistance : null;

      // محاولة استخدام Edge Function
      const { error } = await supabase.functions.invoke('complete-ride', {
        body: {
          ride_id: ride.id,
          driver_id: driverId,
          final_gps_distance: gpsDistanceForAudit,
          tracking_points: trackingPoints.current.length > 1 ? trackingPoints.current : null,
          tracking_quality: trackingQuality,
          driver_lat: driverLocation?.lat,
          driver_lng: driverLocation?.lng,
        },
      });

      if (!error) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        trackingPoints.current = [];
        setRide(null);
        onRideCompleted?.();
      } else {
        Alert.alert(
          'تعذر إنهاء الرحلة',
          'لم يتم إكمال التسوية المالية من السيرفر. تأكد من الاتصال وحاول مرة أخرى.',
        );
      }
    } catch {
      Alert.alert(
        'تعذر إنهاء الرحلة',
        'الاتصال غير مستقر. حاول مرة أخرى عندما يعود الإنترنت حتى لا تضيع التسوية المالية.',
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelRide = () => {
    Alert.alert(
      'إلغاء الرحلة',
      'هل أنت متأكد من إلغاء هذه الرحلة؟',
      [
        { text: 'لا', style: 'cancel' },
        {
          text: 'نعم، إلغاء',
          style: 'destructive',
          onPress: async () => {
            if (!ride) return;
            await supabase
              .from('rides')
              .update({
                status: 'cancelled',
                cancelled_by: 'driver',
                cancelled_at: new Date().toISOString(),
              })
              .eq('id', ride.id);
            setRide(null);
          },
        },
      ],
    );
  };

  const handleNavigate = () => {
    if (!ride) return;
    const target =
      ride.status === 'accepted' || ride.status === 'arrived'
        ? { lat: ride.pickup_lat, lng: ride.pickup_lng }
        : { lat: ride.dropoff_lat, lng: ride.dropoff_lng };

    const url = `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}`;
    Linking.openURL(url);
  };

  const handleCallRider = () => {
    if (riderInfo?.phone) {
      Linking.openURL(`tel:${riderInfo.phone}`);
    }
  };

  if (!ride) return null;

  const fare = ride.estimated_fare ? roundFare(ride.estimated_fare) : null;
  const statusColor = STATUS_COLORS[ride.status] || '#3b82f6';
  const statusLabel = STATUS_LABELS[ride.status] || ride.status;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
    >
      {/* شريط الحالة */}
      <View style={[styles.statusBar, { backgroundColor: statusColor }]}>
        <Text style={styles.statusText}>{statusLabel}</Text>
        {ride.status === 'in_progress' && (
          <Text style={styles.timerText}>{elapsedTime}</Text>
        )}
      </View>

      <View style={styles.body}>
        {/* معلومات الراكب */}
        {riderInfo && (
          <View style={styles.riderRow}>
            <Text style={styles.riderName}>
              {riderInfo.full_name || 'راكب'}
            </Text>
            <TouchableOpacity
              style={styles.callButton}
              onPress={handleCallRider}
            >
              <Text style={styles.callButtonText}>📞 اتصال</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* العناوين */}
        <View style={styles.addressContainer}>
          <View style={styles.addressRow}>
            <View style={styles.dotGreen} />
            <Text style={styles.addressText} numberOfLines={1}>
              {ride.pickup_address || 'نقطة الانطلاق'}
            </Text>
          </View>
          <View style={styles.addressDivider} />
          <View style={styles.addressRow}>
            <View style={styles.dotBlue} />
            <Text style={styles.addressText} numberOfLines={1}>
              {ride.dropoff_address || 'الوجهة'}
            </Text>
          </View>
        </View>

        {/* السعر والمسافة */}
        <View style={styles.infoRow}>
          <Text style={styles.fareText}>
            {fare ? `${fare.toLocaleString()} د.ع` : '—'}
          </Text>
          <Text style={styles.distText}>
            {ride.distance_km ? `${ride.distance_km.toFixed(1)} كم` : ''}
            {ride.payment_method === 'cash' ? ' • نقداً' : ''}
          </Text>
        </View>

        {/* الأزرار */}
        <View style={styles.actionsRow}>
          {/* زر الانتقال */}
          <TouchableOpacity style={styles.navButton} onPress={handleNavigate}>
            <Text style={styles.navButtonText}>🗺️ تنقل</Text>
          </TouchableOpacity>

          {/* الزر الرئيسي حسب الحالة */}
          {ride.status === 'accepted' && (
            <TouchableOpacity
              style={[styles.mainButton, { backgroundColor: '#f59e0b' }]}
              onPress={handleArrived}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <Text style={styles.mainButtonText}>وصلت</Text>
              )}
            </TouchableOpacity>
          )}

          {ride.status === 'arrived' && (
            <TouchableOpacity
              style={[styles.mainButton, { backgroundColor: '#22c55e' }]}
              onPress={handleStartRide}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <Text style={styles.mainButtonText}>بدأ الركوب</Text>
              )}
            </TouchableOpacity>
          )}

          {ride.status === 'in_progress' && (
            <TouchableOpacity
              style={[styles.mainButton, { backgroundColor: '#00d9a5' }]}
              onPress={handleCompleteRide}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <Text style={styles.mainButtonText}>تم الوصول</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* زر الإلغاء */}
        {ride.status !== 'in_progress' && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancelRide}>
            <Text style={styles.cancelText}>إلغاء الرحلة</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  statusBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  timerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  body: {
    padding: 16,
    gap: 14,
    paddingBottom: 32,
  },
  riderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  riderName: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: 'bold',
  },
  callButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  callButtonText: {
    color: '#f1f5f9',
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
  addressDivider: {
    width: 2,
    height: 12,
    backgroundColor: '#475569',
    alignSelf: 'flex-end',
    marginHorizontal: 14,
  },
  addressText: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 14,
    textAlign: 'right',
  },
  infoRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 12,
  },
  fareText: {
    color: '#00d9a5',
    fontSize: 20,
    fontWeight: 'bold',
  },
  distText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  actionsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  navButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  navButtonText: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '600',
  },
  mainButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  mainButtonText: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelText: {
    color: '#ef4444',
    fontSize: 14,
  },
});
