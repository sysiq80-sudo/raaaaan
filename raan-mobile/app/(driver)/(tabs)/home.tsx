/**
 * ران - صفحة السائق الرئيسية (React Native)
 * تتضمن الخريطة + التحكم بالحالة + بطاقة الرحلة
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useDriverStore } from '@/stores/driverStore';
import { supabase } from '@/lib/supabase';
import { LOCATIONS, MAP_CONFIG } from '@/lib/constants';
import RideRequestCard from '@/components/driver/RideRequestCard';
import ActiveRideCard from '@/components/driver/ActiveRideCard';

const { width, height } = Dimensions.get('window');

export default function DriverHomeScreen() {
  const { user, signOut } = useAuth();
  const {
    driver,
    isOnline,
    currentLocation,
    activeRide,
    todayStats,
    setDriver,
    setOnline,
    setAvailable,
    setCurrentLocation,
    setActiveRide,
  } = useDriverStore();

  const [loading, setLoading] = useState(true);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const mapRef = useRef<MapView>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // جلب بيانات السائق
  useEffect(() => {
    if (!user) return;

    const fetchDriver = async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data && !error) {
        setDriver({
          id: data.id,
          userId: data.user_id,
          fullName: data.full_name || '',
          phone: data.phone || '',
          vehicleType: data.vehicle_type || 'economy',
          vehicleModel: data.vehicle_model,
          vehiclePlate: data.vehicle_plate,
          vehicleColor: data.vehicle_color,
          status: data.status || 'pending',
          rating: data.rating || 5.0,
          totalRides: data.total_rides || 0,
          totalEarnings: data.total_earnings || 0,
        });
      }
      setLoading(false);
    };

    fetchDriver();
  }, [user]);

  // تتبع الموقع عند الاتصال
  useEffect(() => {
    if (!isOnline || !driver) return;

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('خطأ', 'يجب السماح بالوصول للموقع');
        setOnline(false);
        return;
      }

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 20,
          timeInterval: 5000,
        },
        (loc) => {
          const newLocation = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          setCurrentLocation(newLocation);

          // تحديث الموقع في قاعدة البيانات
          if (driver) {
            supabase
              .from('drivers')
              .update({
                current_lat: newLocation.lat,
                current_lng: newLocation.lng,
                updated_at: new Date().toISOString(),
              })
              .eq('id', driver.id)
              .then(() => {});
          }
        },
      );
    };

    startTracking();

    return () => {
      locationSubscription.current?.remove();
    };
  }, [isOnline, driver?.id]);

  // تبديل حالة الاتصال
  const handleToggleOnline = useCallback(async () => {
    if (!driver || driver.status !== 'approved') {
      Alert.alert('تنبيه', 'حسابك غير مفعل بعد');
      return;
    }

    setTogglingStatus(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const newStatus = !isOnline;

    const { error } = await supabase
      .from('drivers')
      .update({
        is_online: newStatus,
        is_available: newStatus,
      })
      .eq('id', driver.id);

    if (!error) {
      setOnline(newStatus);
      setAvailable(newStatus);
    } else {
      Alert.alert('خطأ', 'فشل تغيير الحالة');
    }

    setTogglingStatus(false);
  }, [driver, isOnline]);

  // الاشتراك في طلبات الرحلات
  useEffect(() => {
    if (!driver || !isOnline) return;

    const channel = supabase
      .channel(`ride-requests-${driver.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ride_requests',
          filter: `driver_id=eq.${driver.id}`,
        },
        (payload: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          // يعرض RideRequestCard تلقائياً عبر Realtime
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driver?.id, isOnline]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00d9a5" />
        <Text style={styles.loadingText}>جاري التحميل...</Text>
      </View>
    );
  }

  if (!driver) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>لم يتم العثور على بيانات السائق</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutButtonText}>تسجيل الخروج</Text>
        </TouchableOpacity>
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
          latitude: currentLocation?.lat ?? LOCATIONS.RAMADI_CENTER.lat,
          longitude: currentLocation?.lng ?? LOCATIONS.RAMADI_CENTER.lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {currentLocation && (
          <Marker
            coordinate={{
              latitude: currentLocation.lat,
              longitude: currentLocation.lng,
            }}
            title="موقعك"
          />
        )}
      </MapView>

      {/* شريط الحالة العلوي */}
      <View style={styles.topBar}>
        <View style={styles.statusBadge}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isOnline ? '#22c55e' : '#ef4444' },
            ]}
          />
          <Text style={styles.statusText}>
            {isOnline ? 'متصل' : 'غير متصل'}
          </Text>
        </View>

        <Text style={styles.driverName}>{driver.fullName}</Text>
      </View>

      {/* إحصائيات سريعة */}
      {isOnline && !activeRide && (
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(driver)/(tabs)/rides')}>
            <Text style={styles.statValue}>{todayStats.rides}</Text>
            <Text style={styles.statLabel}>رحلات اليوم</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(driver)/(tabs)/earnings')}>
            <Text style={styles.statValue}>
              {todayStats.earnings.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>الأرباح (د.ع)</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* زر التبديل */}
      <View style={styles.bottomControls}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            isOnline ? styles.toggleOnline : styles.toggleOffline,
          ]}
          onPress={handleToggleOnline}
          disabled={togglingStatus}
        >
          {togglingStatus ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.toggleText}>
              {isOnline ? 'إيقاف الاستقبال' : 'ابدأ الاستقبال'}
            </Text>
          )}
        </TouchableOpacity>

        {/* زر الإعدادات */}
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => router.push('/(driver)/(tabs)/settings')}
        >
          <Text style={styles.settingsButtonText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* بطاقة طلب الرحلة */}
      {isOnline && !activeRide && driver && (
        <RideRequestCard
          driverId={driver.id}
          vehicleType={driver.vehicleType}
          isOnline={isOnline}
          driverLocation={currentLocation}
          onRideAccepted={() => {
            // سيتم تحديث الرحلة النشطة عبر Realtime
          }}
        />
      )}

      {/* بطاقة الرحلة النشطة */}
      {activeRide && driver && (
        <ActiveRideCard
          driverId={driver.userId}
          driverLocation={currentLocation}
          onRideCompleted={() => setActiveRide(null)}
        />
      )}
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
    height,
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
  errorText: {
    color: '#ef4444',
    fontSize: 18,
    marginBottom: 16,
  },
  logoutButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#f1f5f9',
    fontSize: 16,
  },
  topBar: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600',
  },
  driverName: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: 'bold',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  statsRow: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    flexDirection: 'row-reverse',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    color: '#00d9a5',
    fontSize: 22,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
  },
  toggleButton: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  toggleOnline: {
    backgroundColor: '#ef4444',
  },
  toggleOffline: {
    backgroundColor: '#00d9a5',
  },
  toggleText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  settingsButton: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  settingsButtonText: {
    fontSize: 24,
  },
});
