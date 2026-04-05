/**
 * ران - أرباح السائق (React Native)
 * يعرض الأرباح اليومية والأسبوعية والشهرية مع تفاصيل المحفظة
 */

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { roundFare } from '@/lib/constants';

type PeriodType = 'today' | 'week' | 'month';

interface WalletData {
  balance: number;
  pending_balance: number;
  lifetime_earnings: number;
  total_withdrawn: number;
  total_rides_completed: number;
  commission_paid: number;
  tips_received: number;
}

interface PeriodStats {
  earnings: number;
  rides: number;
  cancelled: number;
  avgFare: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

const TX_TYPE_CONFIG: Record<string, { label: string; color: string; prefix: string }> = {
  ride_earning: { label: 'أجرة رحلة', color: '#22c55e', prefix: '+' },
  commission: { label: 'عمولة', color: '#ef4444', prefix: '-' },
  tip: { label: 'بقشيش', color: '#00d9a5', prefix: '+' },
  withdrawal: { label: 'سحب', color: '#f97316', prefix: '-' },
  bonus: { label: 'مكافأة', color: '#8b5cf6', prefix: '+' },
  penalty: { label: 'غرامة', color: '#ef4444', prefix: '-' },
  refund: { label: 'استرجاع', color: '#3b82f6', prefix: '+' },
  adjustment: { label: 'تعديل', color: '#eab308', prefix: '' },
};

export default function DriverEarnings() {
  const { session } = useAuth();
  const [driverId, setDriverId] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [stats, setStats] = useState<PeriodStats>({ earnings: 0, rides: 0, cancelled: 0, avgFare: 0 });
  const [period, setPeriod] = useState<PeriodType>('today');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const getDateRange = useCallback((p: PeriodType): Date => {
    const now = new Date();
    if (p === 'today') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (p === 'week') {
      const day = now.getDay();
      const diff = day === 6 ? 0 : day + 1; // Saturday = start of week
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    } else {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);

    try {
      // Fetch wallet
      const { data: walletData } = await supabase
        .from('driver_wallets')
        .select('balance, pending_balance, lifetime_earnings, total_withdrawn, total_rides_completed, commission_paid, tips_received')
        .eq('driver_id', driverId)
        .single();

      if (walletData) setWallet(walletData);

      // Fetch rides for period stats
      const fromDate = getDateRange(period);
      const { data: ridesData } = await supabase
        .from('rides')
        .select('status, final_fare, estimated_fare')
        .eq('driver_id', driverId)
        .gte('created_at', fromDate.toISOString());

      if (ridesData) {
        const completed = ridesData.filter((r) => r.status === 'completed');
        const cancelled = ridesData.filter((r) => r.status === 'cancelled');
        const totalEarnings = completed.reduce((sum, r) => sum + (r.final_fare || r.estimated_fare || 0), 0);
        setStats({
          earnings: totalEarnings,
          rides: completed.length,
          cancelled: cancelled.length,
          avgFare: completed.length > 0 ? totalEarnings / completed.length : 0,
        });
      }

      // Fetch recent transactions
      const { data: txData } = await supabase
        .from('wallet_transactions')
        .select('id, type, amount, description, created_at')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false })
        .limit(20);

      setTransactions(txData || []);
    } catch (err) {
      console.error('Error fetching earnings:', err);
    } finally {
      setLoading(false);
    }
  }, [driverId, period, getDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar-IQ', { month: 'short', day: 'numeric' }) +
      ' ' + date.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
  };

  const periods: { key: PeriodType; label: string }[] = [
    { key: 'today', label: 'اليوم' },
    { key: 'week', label: 'الأسبوع' },
    { key: 'month', label: 'الشهر' },
  ];

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#00d9a5" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00d9a5" />}
    >
      {/* Wallet Balance Card */}
      <View style={styles.walletCard}>
        <Text style={styles.walletLabel}>رصيد المحفظة</Text>
        <Text style={styles.walletBalance}>
          {roundFare(wallet?.balance || 0).toLocaleString()} <Text style={styles.currency}>د.ع</Text>
        </Text>
        {(wallet?.pending_balance ?? 0) > 0 && (
          <Text style={styles.pendingText}>
            معلق: {roundFare(wallet!.pending_balance).toLocaleString()} د.ع
          </Text>
        )}
      </View>

      {/* Period Selector */}
      <View style={styles.periodRow}>
        {periods.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{roundFare(stats.earnings).toLocaleString()}</Text>
          <Text style={styles.statLabel}>الأرباح (د.ع)</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.rides}</Text>
          <Text style={styles.statLabel}>رحلة مكتملة</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{roundFare(stats.avgFare).toLocaleString()}</Text>
          <Text style={styles.statLabel}>متوسط الأجرة</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#ef4444' }]}>{stats.cancelled}</Text>
          <Text style={styles.statLabel}>ملغاة</Text>
        </View>
      </View>

      {/* Lifetime Stats */}
      {wallet && (
        <View style={styles.lifetimeCard}>
          <Text style={styles.sectionTitle}>إحصائيات شاملة</Text>
          <View style={styles.lifetimeRow}>
            <Text style={styles.lifetimeLabel}>إجمالي الأرباح</Text>
            <Text style={styles.lifetimeValue}>{roundFare(wallet.lifetime_earnings).toLocaleString()} د.ع</Text>
          </View>
          <View style={styles.lifetimeRow}>
            <Text style={styles.lifetimeLabel}>إجمالي السحوبات</Text>
            <Text style={styles.lifetimeValue}>{roundFare(wallet.total_withdrawn).toLocaleString()} د.ع</Text>
          </View>
          <View style={styles.lifetimeRow}>
            <Text style={styles.lifetimeLabel}>العمولة المدفوعة</Text>
            <Text style={[styles.lifetimeValue, { color: '#ef4444' }]}>{roundFare(wallet.commission_paid).toLocaleString()} د.ع</Text>
          </View>
          <View style={styles.lifetimeRow}>
            <Text style={styles.lifetimeLabel}>البقشيش</Text>
            <Text style={[styles.lifetimeValue, { color: '#00d9a5' }]}>{roundFare(wallet.tips_received).toLocaleString()} د.ع</Text>
          </View>
          <View style={styles.lifetimeRow}>
            <Text style={styles.lifetimeLabel}>رحلات مكتملة</Text>
            <Text style={styles.lifetimeValue}>{wallet.total_rides_completed}</Text>
          </View>
        </View>
      )}

      {/* Recent Transactions */}
      <View style={styles.txSection}>
        <Text style={styles.sectionTitle}>آخر المعاملات</Text>
        {transactions.length === 0 ? (
          <Text style={styles.emptyText}>لا توجد معاملات</Text>
        ) : (
          transactions.map((tx) => {
            const conf = TX_TYPE_CONFIG[tx.type] || { label: tx.type, color: '#94a3b8', prefix: '' };
            return (
              <View key={tx.id} style={styles.txRow}>
                <View style={styles.txInfo}>
                  <Text style={styles.txType}>{conf.label}</Text>
                  <Text style={styles.txTime}>{formatTime(tx.created_at)}</Text>
                </View>
                <Text style={[styles.txAmount, { color: conf.color }]}>
                  {conf.prefix}{roundFare(tx.amount).toLocaleString()} د.ع
                </Text>
              </View>
            );
          })
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  walletCard: {
    backgroundColor: '#1e293b',
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00d9a5',
  },
  walletLabel: { color: '#94a3b8', fontSize: 14, marginBottom: 8 },
  walletBalance: { color: '#00d9a5', fontSize: 32, fontWeight: '800' },
  currency: { fontSize: 18, fontWeight: '400' },
  pendingText: { color: '#eab308', fontSize: 13, marginTop: 6 },
  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  periodBtnActive: { backgroundColor: '#00d9a5' },
  periodText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  periodTextActive: { color: '#0f172a' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: { color: '#f8fafc', fontSize: 22, fontWeight: '700' },
  statLabel: { color: '#64748b', fontSize: 12, marginTop: 4 },
  lifetimeCard: {
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700', marginBottom: 14 },
  lifetimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  lifetimeLabel: { color: '#94a3b8', fontSize: 14 },
  lifetimeValue: { color: '#f8fafc', fontSize: 14, fontWeight: '600' },
  txSection: {
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  txInfo: { flex: 1 },
  txType: { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
  txTime: { color: '#64748b', fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '700' },
  emptyText: { color: '#64748b', fontSize: 14, textAlign: 'center', paddingVertical: 20 },
});
