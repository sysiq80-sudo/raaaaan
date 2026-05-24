/**
 * ران - تتبع الرحلة المباشر (React Native)
 * يعرض حالة الرحلة + موقع السائق في الوقت الحقيقي
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { router } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { supabase } from '../../src/lib/supabase';
import { useRiderStore } from '../../src/stores/riderStore';
import { LOCATIONS, RIDE_STATUS, roundFare } from '../../src/lib/constants';

const { width, height } = Dimensions.get('window');

interface RideData {
  id: string;
  status: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string | null;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_address: string | null;
  estimated_fare: number | null;
  final_fare: number | null;
  driver_id: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface DriverInfo {
  full_name: string | null;
  phone: string | null;
}

interface DriverLocation {
  lat: number;
  lng: number;
}

export default function LiveRideTracker() {
  const { user } = useAuth();
  const store = useRiderStore();
  const [ride, setRide] = useState<RideData | null>(null);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState('');
  const mapRef = useRef<MapView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRide = useCallback(async () => {
    if (!store.activeRideId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('rides')
      .select('*')
      .eq('id', store.activeRideId)
      .single();

    if (data) {
      setRide(data);
      if (data.driver_id) fetchDriverInfo(data.driver_id);
    }
    setLoading(false);
  }, [store.activeRideId]);

  const fetchDriverInfo = async (driverId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', driverId)
      .single();
    if (data) setDriverInfo(data);
  };

  useEffect(() => {
    fetchRide();
  }, [fetchRide]);

  // اشتراك Realtime لتحديثات الرحلة
  useEffect(() => {
    if (!store.activeRideId) return;

    const channel = supabase
      .channel(`ride-tracker-${store.activeRideId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rides',
          filter: `id=eq.${store.activeRideId}`,
        },
        (payload) => {
          const updated = payload.new as RideData;
          setRide(updated);
          store.setActiveRide(updated.id, updated.status as any);

          if (updated.status === 'completed' || updated.status === 'cancelled') {
            if (timerRef.current) clearInterval(timerRef.current);
            // الانتقال بعد 3 ثوان
            setTimeout(() => {
              store.resetTrip();
              router.replace('/(rider)/(tabs)/home');
            }, 3000);
          }

          if (updated.driver_id && !driverInfo) {
            fetchDriverInfo(updated.driver_id);
          }
        },
      )
      .subscribe();

    // اشتراك لموقع السائق عبر Broadcast
    const locationChannel = supabase
      .channel(`driver-location-${store.activeRideId}`)
      .on('broadcast', { event: 'driver_location' }, (payload) => {
        if (payload.payload?.lat && payload.payload?.lng) {
          setDriverLocation({
            lat: payload.payload.lat,
            lng: payload.payload.lng,
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(locationChannel);
    };
  }, [store.activeRideId]);

  // عداد الوقت
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (ride?.status === 'in_progress' && ride.started_at) {
      timerRef.current = setInterval(() => {
        const start = new Date(ride.started_at!).getTime();
        const diff = Math.floor((Date.now() - start) / 1000);
        const mins = Math.floor(diff / 60).toString().padStart(2, '0');
        const secs = (diff % 60).toString().padStart(2, '0');
        setElapsed(`${mins}:${secs}`);
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [ride?.status, ride?.started_at]);

  const handleCancelRide = () => {
    if (!ride || ride.status === 'in_progress') return;
    Alert.alert('إلغاء الرحلة', 'هل تريد إلغاء الرحلة؟', [
      { text: 'لا', style: 'cancel' },
      {
        text: 'نعم',
        style: 'destructive',
        onPress: async () => {
          await supabase
            .from('rides')
            .update({
              status: 'cancelled',
              cancelled_by: 'rider',
              cancelled_at: new Date().toISOString(),
            })
            .eq('id', ride.id);
          store.resetTrip();
          router.replace('/(rider)/(tabs)/home');
        },
      },
    ]);
  };

  const handleCallDriver = () => {
    if (driverInfo?.phone) {
      Linking.openURL(`tel:${driverInfo.phone}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00d9a5" />
        <Text style={styles.loadingText}>جاري تحميل الرحلة...</Text>
      </View>
    );
  }

  if (!ride) {
    return (
      <View style={styles.center}>
        <Text style={styles.noRideText}>لا توجد رحلة نشطة</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/(rider)/(tabs)/home')}
        >
          <Text style={styles.backButtonText}>العودة للرئيسية</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusInfo = RIDE_STATUS[ride.status as keyof typeof RIDE_STATUS];
  const fare = ride.final_fare ?? ride.estimated_fare;

  return (
    <View style={styles.container}>
      {/* الخريطة */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: ride.pickup_lat,
          longitude: ride.pickup_lng,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
      >
        {/* نقطة الانطلاق */}
        <Marker
          coordinate={{ latitude: ride.pickup_lat, longitude: ride.pickup_lng }}
          pinColor="#22c55e"
          title="نقطة الانطلاق"
        />
        {/* الوجهة */}
        <Marker
          coordinate={{ latitude: ride.dropoff_lat, longitude: ride.dropoff_lng }}
          pinColor="#2A6CD5"
          title="الوجهة"
        />
        {/* موقع السائق */}
        {driverLocation && (
          <Marker
            coordinate={{
              latitude: driverLocation.lat,
              longitude: driverLocation.lng,
            }}
            title="السائق"
          >
            <View style={styles.driverMarker}>
              <Text style={styles.driverMarkerText}>🚗</Text>
            </View>
          </Marker>
        )}
      </MapView>

      {/* البطاقة السفلية */}
      <View style={styles.bottomCard}>
        {/* حالة الرحلة */}
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusInfo?.color || '#3b82f6' },
          ]}
        >
          <Text style={styles.statusText}>{statusInfo?.nameAr || ride.status}</Text>
          {ride.status === 'in_progress' && elapsed && (
            <Text style={styles.elapsedText}>{elapsed}</Text>
          )}
        </View>

        {/* حالة الانتظار */}
        {ride.status === 'pending' && (
          <Text style={styles.waitingText}>جاري البحث عن سائق قريب...</Text>
        )}

        {/* معلومات السائق */}
        {driverInfo && ride.status !== 'pending' && (
          <View style={styles.driverRow}>
            <TouchableOpacity style={styles.callBtn} onPress={handleCallDriver}>
              <Text style={styles.callBtnText}>📞</Text>
            </TouchableOpacity>
            <Text style={styles.driverName}>
              {driverInfo.full_name || 'السائق'}
            </Text>
          </View>
        )}

        {/* العناوين */}
        <View style={styles.addressBlock}>
          <View style={styles.addressRow}>
            <View style={styles.dotGreen} />
            <Text style={styles.addressText} numberOfLines={1}>
              {ride.pickup_address || 'نقطة الانطلاق'}
            </Text>
          </View>
          <View style={styles.addressRow}>
            <View style={styles.dotBlue} />
            <Text style={styles.addressText} numberOfLines={1}>
              {ride.dropoff_address || 'الوجهة'}
            </Text>
          </View>
        </View>

        {/* السعر */}
        {fare && (
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>
              {ride.final_fare ? 'الأجرة النهائية' : 'السعر التقديري'}
            </Text>
            <Text style={styles.fareValue}>
              {roundFare(fare).toLocaleString()} د.ع
            </Text>
          </View>
        )}

        {/* اكتمال الرحلة */}
        {ride.status === 'completed' && (
          <View style={styles.completedBanner}>
            <Text style={styles.completedText}>تم إكمال الرحلة بنجاح!</Text>
          </View>
        )}

        {ride.status === 'cancelled' && (
          <View style={[styles.completedBanner, { backgroundColor: '#7f1d1d' }]}>
            <Text style={styles.completedText}>تم إلغاء الرحلة</Text>
          </View>
        )}

        {/* زر الإلغاء */}
        {ride.status !== 'in_progress' &&
          ride.status !== 'completed' &&
          ride.status !== 'cancelled' && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleCancelRide}
            >
              <Text style={styles.cancelText}>إلغاء الرحلة</Text>
            </TouchableOpacity>
          )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  map: {
    width,
    height: height * 0.55,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    gap: 16,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  noRideText: {
    color: '#94a3b8',
    fontSize: 18,
  },
  backButton: {
    backgroundColor: '#00d9a5',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  driverMarker: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 6,
    borderWidth: 2,
    borderColor: '#00d9a5',
  },
  driverMarkerText: {
    fontSize: 20,
  },
  bottomCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 14,
    marginTop: -20,
  },
  statusBadge: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
  },
  statusText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  elapsedText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  waitingText: {
    color: '#f59e0b',
    fontSize: 15,
    textAlign: 'center',
  },
  driverRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  driverName: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: 'bold',
  },
  callBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  callBtnText: {
    fontSize: 18,
  },
  addressBlock: {
    gap: 8,
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
  addressText: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 14,
    textAlign: 'right',
  },
  fareRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 14,
    borderRadius: 12,
  },
  fareLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  fareValue: {
    color: '#00d9a5',
    fontSize: 20,
    fontWeight: 'bold',
  },
  completedBanner: {
    backgroundColor: '#14532d',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  completedText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    color: '#ef4444',
    fontSize: 15,
  },
});
