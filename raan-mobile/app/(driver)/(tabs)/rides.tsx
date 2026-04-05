/**
 * ران - سجل رحلات السائق (React Native)
 * يعرض الرحلات السابقة مع فلترة حسب الحالة
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
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { roundFare } from '@/lib/constants';

type FilterType = 'all' | 'completed' | 'cancelled';

interface RideHistoryItem {
  id: string;
  status: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  final_fare: number | null;
  estimated_fare: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  payment_method: string | null;
  created_at: string;
  completed_at: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  completed: { label: 'مكتملة', color: '#22c55e' },
  cancelled: { label: 'ملغاة', color: '#ef4444' },
  pending: { label: 'بانتظار', color: '#eab308' },
  accepted: { label: 'مقبولة', color: '#3b82f6' },
  arrived: { label: 'وصل', color: '#8b5cf6' },
  in_progress: { label: 'جارية', color: '#f97316' },
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'نقدي',
  wallet: 'المحفظة',
  nas_wallet: 'المحفظة',
  card: 'البطاقة',
  qi_card: 'البطاقة',
  zain_cash: 'زين كاش',
  asia_hawala: 'آسيا حوالة',
};

export default function DriverRideHistory() {
  const { session } = useAuth();
  const [rides, setRides] = useState<RideHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [driverId, setDriverId] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from('drivers')
      .select('id')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) setDriverId(data.id);
      });
  }, [session?.user?.id]);

  const fetchRides = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('rides')
        .select('id, status, pickup_address, dropoff_address, final_fare, estimated_fare, distance_km, duration_minutes, payment_method, created_at, completed_at')
        .eq('driver_id', driverId)
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
  }, [driverId, filter]);

  useEffect(() => {
    fetchRides();
  }, [fetchRides]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRides();
    setRefreshing(false);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMin < 1) return 'الآن';
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
    if (diffMin < 1440) return `منذ ${Math.floor(diffMin / 60)} ساعة`;
    return `منذ ${Math.floor(diffMin / 1440)} يوم`;
  };

  const renderRide = ({ item }: { item: RideHistoryItem }) => {
    const statusConf = STATUS_CONFIG[item.status] || { label: item.status, color: '#94a3b8' };
    const fare = item.final_fare || item.estimated_fare || 0;

    return (
      <View style={styles.rideCard}>
        <View style={styles.rideHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusConf.color + '22', borderColor: statusConf.color }]}>
            <Text style={[styles.statusText, { color: statusConf.color }]}>{statusConf.label}</Text>
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
          <View style={styles.rideDetails}>
            {item.distance_km != null && (
              <Text style={styles.detailText}>{item.distance_km.toFixed(1)} كم</Text>
            )}
            {item.duration_minutes != null && (
              <Text style={styles.detailText}>{Math.round(item.duration_minutes)} د</Text>
            )}
            {item.payment_method && (
              <Text style={styles.detailText}>{PAYMENT_LABELS[item.payment_method] || item.payment_method}</Text>
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
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>لا توجد رحلات</Text>
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
  list: { padding: 16, gap: 12 },
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
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
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
  rideDetails: { flexDirection: 'row', gap: 8 },
  detailText: { color: '#94a3b8', fontSize: 12 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: '#64748b', fontSize: 16 },
});
