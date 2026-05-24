/**
 * ران - سجل رحلات الراكب (React Native)
 * يعرض الرحلات السابقة مع إمكانية إعادة الحجز
 */

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { roundFare } from '@/lib/constants';
import { useRiderStore } from '@/stores/riderStore';

type FilterType = 'all' | 'completed' | 'cancelled';

interface RideHistoryItem {
  id: string;
  status: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  final_fare: number | null;
  estimated_fare: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  vehicle_type: string | null;
  payment_method: string | null;
  created_at: string;
  completed_at: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  completed: { label: 'مكتملة', color: '#22c55e' },
  cancelled: { label: 'ملغاة', color: '#ef4444' },
  pending: { label: 'بانتظار', color: '#eab308' },
  accepted: { label: 'مقبولة', color: '#3b82f6' },
  arrived: { label: 'السائق وصل', color: '#8b5cf6' },
  in_progress: { label: 'جارية', color: '#f97316' },
};

const VEHICLE_LABELS: Record<string, string> = {
  economy: 'اقتصادي',
  comfort: 'مريح',
  premium: 'فاخر',
  women_only: 'نسائي',
};

export default function RiderRideHistory() {
  const { session } = useAuth();
  const [rides, setRides] = useState<RideHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const setDropoff = useRiderStore((s) => s.setDropoff);
  const setPickup = useRiderStore((s) => s.setPickup);

  const fetchRides = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from('rides')
        .select('id, status, pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, final_fare, estimated_fare, distance_km, duration_minutes, vehicle_type, payment_method, created_at, completed_at')
        .eq('rider_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter === 'completed') query = query.eq('status', 'completed');
      else if (filter === 'cancelled') query = query.eq('status', 'cancelled');

      const { data, error } = await query;
      if (error) throw error;
      setRides(data || []);
    } catch (err) {
      console.error('Error fetching rides:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, filter]);

  useEffect(() => {
    fetchRides();
  }, [fetchRides]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRides();
    setRefreshing(false);
  };

  const rebook = (ride: RideHistoryItem) => {
    if (ride.pickup_lat && ride.pickup_lng) {
      setPickup(
        { lat: ride.pickup_lat, lng: ride.pickup_lng },
        ride.pickup_address || undefined
      );
    }
    if (ride.dropoff_lat && ride.dropoff_lng) {
      setDropoff(
        { lat: ride.dropoff_lat, lng: ride.dropoff_lng },
        ride.dropoff_address || undefined
      );
    }
    router.push('/(rider)/(tabs)/home');
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMin < 1) return 'الآن';
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
    if (diffMin < 1440) return `منذ ${Math.floor(diffMin / 60)} ساعة`;
    return date.toLocaleDateString('ar-IQ', { month: 'short', day: 'numeric' });
  };

  const renderRide = ({ item }: { item: RideHistoryItem }) => {
    const statusConf = STATUS_CONFIG[item.status] || { label: item.status, color: '#94a3b8' };
    const fare = item.final_fare || item.estimated_fare || 0;

    return (
      <View style={styles.rideCard}>
        <View style={styles.rideHeader}>
          <View style={styles.headerLeft}>
            <View style={[styles.statusBadge, { backgroundColor: statusConf.color + '22', borderColor: statusConf.color }]}>
              <Text style={[styles.statusText, { color: statusConf.color }]}>{statusConf.label}</Text>
            </View>
            {item.vehicle_type && (
              <Text style={styles.vehicleText}>{VEHICLE_LABELS[item.vehicle_type] || item.vehicle_type}</Text>
            )}
          </View>
          <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
        </View>

        <View style={styles.rideLocations}>
          <View style={styles.locationRow}>
            <Text style={styles.locationDot}>🟢</Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {item.pickup_address || 'نقطة الانطلاق'}
            </Text>
          </View>
          <View style={styles.locationRow}>
            <Text style={styles.locationDot}>🔴</Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {item.dropoff_address || 'نقطة الوصول'}
            </Text>
          </View>
        </View>

        <View style={styles.rideFooter}>
          <Text style={styles.fareText}>{roundFare(fare).toLocaleString()} د.ع</Text>
          <View style={styles.footerRight}>
            {item.distance_km != null && (
              <Text style={styles.detailText}>{item.distance_km.toFixed(1)} كم</Text>
            )}
            {item.status === 'completed' && (
              <TouchableOpacity style={styles.rebookBtn} onPress={() => rebook(item)}>
                <Text style={styles.rebookText}>إعادة الحجز</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'completed', label: 'مكتملة' },
    { key: 'cancelled', label: 'ملغاة' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color="#00d9a5" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item.id}
          renderItem={renderRide}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00d9a5" />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🚗</Text>
              <Text style={styles.emptyText}>لا توجد رحلات سابقة</Text>
              <TouchableOpacity style={styles.bookBtn} onPress={() => router.push('/(rider)/(tabs)/home')}>
                <Text style={styles.bookBtnText}>احجز رحلتك الأولى</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e293b',
  },
  filterBtnActive: { backgroundColor: '#00d9a5' },
  filterText: { color: '#94a3b8', fontSize: 14 },
  filterTextActive: { color: '#0f172a', fontWeight: '700' },
  list: { padding: 16 },
  rideCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  vehicleText: { color: '#64748b', fontSize: 12 },
  timeText: { color: '#64748b', fontSize: 12 },
  rideLocations: { gap: 6, marginBottom: 12 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationDot: { fontSize: 10 },
  locationText: { color: '#e2e8f0', fontSize: 14, flex: 1 },
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 10,
  },
  fareText: { color: '#00d9a5', fontSize: 16, fontWeight: '700' },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailText: { color: '#94a3b8', fontSize: 12 },
  rebookBtn: {
    backgroundColor: '#00d9a5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rebookText: { color: '#0f172a', fontSize: 12, fontWeight: '700' },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: '#64748b', fontSize: 16, marginBottom: 16 },
  bookBtn: {
    backgroundColor: '#00d9a5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  bookBtnText: { color: '#0f172a', fontSize: 15, fontWeight: '700' },
});
