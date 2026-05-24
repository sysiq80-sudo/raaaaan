/**
 * ران - صفحة الراكب الرئيسية (React Native)
 * خريطة + اختيار النقاط + اختيار نوع المركبة + طلب رحلة
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as ExpoLocation from 'expo-location';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { LOCATIONS, roundFare } from '@/lib/constants';
import { useRiderStore } from '@/stores/riderStore';
import type { VehicleType } from '@/types';

const { width, height } = Dimensions.get('window');

const VEHICLE_OPTIONS: { type: VehicleType; label: string; icon: string; multiplier: number }[] = [
  { type: 'economy', label: 'اقتصادي', icon: '🚗', multiplier: 1.0 },
  { type: 'comfort', label: 'مريح', icon: '🚙', multiplier: 1.3 },
  { type: 'premium', label: 'فاخر', icon: '✨', multiplier: 1.8 },
  { type: 'women_only', label: 'نسائي', icon: '👩', multiplier: 1.2 },
];

// حساب المسافة التقريبية بالكيلومترات (هافرسين)
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function RiderHomeScreen() {
  const { user } = useAuth();
  const store = useRiderStore();
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const mapRef = useRef<MapView>(null);

  // تحديد موقع المستخدم
  useEffect(() => {
    (async () => {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoading(false);
        return;
      }

      const loc = await ExpoLocation.getCurrentPositionAsync({});
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setUserLocation(coords);
      // تعيين نقطة الانطلاق تلقائياً
      if (!store.pickup) {
        store.setPickup(coords, 'موقعي الحالي');
      }
      setLoading(false);
    })();
  }, []);

  // حساب السعر التقديري عند تغيير الوجهة أو نوع المركبة
  useEffect(() => {
    if (store.pickup && store.dropoff) {
      const dist = haversineKm(
        store.pickup.lat, store.pickup.lng,
        store.dropoff.lat, store.dropoff.lng,
      );
      setDistanceKm(dist);

      const baseFare = 2000; // 2000 دينار أساسي
      const perKm = 1000;   // 1000 دينار/كم
      const vehicle = VEHICLE_OPTIONS.find((v) => v.type === store.vehicleType);
      const multiplier = vehicle?.multiplier ?? 1;
      const fare = (baseFare + dist * perKm) * multiplier;
      setEstimatedFare(roundFare(fare));
    } else {
      setEstimatedFare(null);
      setDistanceKm(null);
    }
  }, [store.pickup, store.dropoff, store.vehicleType]);

  // إنشاء طلب الرحلة
  const handleBookRide = useCallback(async () => {
    if (!store.pickup || !store.dropoff || !user?.id) {
      Alert.alert('خطأ', 'يرجى تحديد نقطة الانطلاق والوجهة');
      return;
    }

    setBooking(true);
    try {
      const { data, error } = await supabase
        .from('rides')
        .insert({
          rider_id: user.id,
          pickup_lat: store.pickup.lat,
          pickup_lng: store.pickup.lng,
          pickup_address: store.pickupAddress || null,
          dropoff_lat: store.dropoff.lat,
          dropoff_lng: store.dropoff.lng,
          dropoff_address: store.dropoffAddress || null,
          vehicle_type: store.vehicleType,
          payment_method: store.paymentMethod,
          estimated_fare: estimatedFare,
          distance_km: distanceKm,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) throw error;

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      store.setActiveRide(data.id, 'pending');
      router.push('/(rider)/track');
    } catch (err) {
      console.error('Booking failed:', err);
      Alert.alert('خطأ', 'فشل حجز الرحلة. حاول مرة أخرى.');
    } finally {
      setBooking(false);
    }
  }, [store, user, estimatedFare, distanceKm]);

  // اختيار وجهة على الخريطة
  const handleMapPress = (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    store.setDropoff({ lat: latitude, lng: longitude }, 'نقطة على الخريطة');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00d9a5" />
        <Text style={styles.loadingText}>جاري تحديد موقعك...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* الخريطة */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: userLocation?.lat ?? LOCATIONS.RAMADI_CENTER.lat,
          longitude: userLocation?.lng ?? LOCATIONS.RAMADI_CENTER.lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation
        onPress={handleMapPress}
      >
        {store.pickup && (
          <Marker
            coordinate={{ latitude: store.pickup.lat, longitude: store.pickup.lng }}
            pinColor="#22c55e"
            title="نقطة الانطلاق"
          />
        )}
        {store.dropoff && (
          <Marker
            coordinate={{ latitude: store.dropoff.lat, longitude: store.dropoff.lng }}
            pinColor="#2A6CD5"
            title="الوجهة"
          />
        )}
      </MapView>

      {/* بطاقة الحجز */}
      <KeyboardAvoidingView
        style={styles.bottomSheet}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.greeting}>أهلاً 👋</Text>
        <Text style={styles.question}>إلى أين تريد الذهاب؟</Text>

        {/* حقول العنوان */}
        <View style={styles.inputContainer}>
          <View style={styles.dotGreen} />
          <TextInput
            style={styles.input}
            placeholder="نقطة الانطلاق"
            placeholderTextColor="#64748b"
            value={store.pickupAddress}
            onChangeText={(v) => store.setPickup(store.pickup, v)}
            textAlign="right"
          />
        </View>

        <View style={styles.inputContainer}>
          <View style={styles.dotBlue} />
          <TextInput
            style={styles.input}
            placeholder="اضغط على الخريطة لاختيار الوجهة"
            placeholderTextColor="#64748b"
            value={store.dropoffAddress}
            onChangeText={(v) => store.setDropoff(store.dropoff, v)}
            textAlign="right"
          />
        </View>

        {/* اختيار نوع المركبة */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.vehicleList}
          style={styles.vehicleScroll}
        >
          {VEHICLE_OPTIONS.map((v) => (
            <TouchableOpacity
              key={v.type}
              style={[
                styles.vehicleCard,
                store.vehicleType === v.type && styles.vehicleCardActive,
              ]}
              onPress={() => {
                store.setVehicleType(v.type);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Text style={styles.vehicleIcon}>{v.icon}</Text>
              <Text
                style={[
                  styles.vehicleLabel,
                  store.vehicleType === v.type && styles.vehicleLabelActive,
                ]}
              >
                {v.label}
              </Text>
              {estimatedFare && (
                <Text style={styles.vehiclePrice}>
                  {roundFare(
                    (estimatedFare / (VEHICLE_OPTIONS.find((o) => o.type === store.vehicleType)?.multiplier ?? 1)) *
                      v.multiplier,
                  ).toLocaleString()}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* السعر التقديري */}
        {estimatedFare && (
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>السعر التقديري</Text>
            <Text style={styles.fareValue}>
              {estimatedFare.toLocaleString()} د.ع
            </Text>
          </View>
        )}

        {/* زر الحجز */}
        <TouchableOpacity
          style={[styles.bookButton, !store.dropoff && styles.bookButtonDisabled]}
          onPress={handleBookRide}
          disabled={!store.dropoff || booking}
        >
          {booking ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.bookButtonText}>
              {store.dropoff ? 'اطلب رحلة' : 'اختر الوجهة أولاً'}
            </Text>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
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
    position: 'absolute',
    top: 0,
    left: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 16,
    fontSize: 16,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    gap: 10,
  },
  greeting: {
    color: '#f1f5f9',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  question: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'right',
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  dotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
  },
  dotBlue: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2A6CD5',
  },
  input: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#334155',
  },
  vehicleScroll: {
    maxHeight: 90,
  },
  vehicleList: {
    gap: 10,
    paddingVertical: 4,
  },
  vehicleCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  vehicleCardActive: {
    borderColor: '#00d9a5',
    backgroundColor: '#0f2a2a',
  },
  vehicleIcon: {
    fontSize: 24,
  },
  vehicleLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },
  vehicleLabelActive: {
    color: '#00d9a5',
    fontWeight: '600',
  },
  vehiclePrice: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  fareRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
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
  bookButton: {
    backgroundColor: '#00d9a5',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  bookButtonDisabled: {
    backgroundColor: '#334155',
  },
  bookButtonText: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
