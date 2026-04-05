/**
 * ران - صفحة الترحيب / توجيه المستخدم
 */

import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../src/hooks/useAuth';
import { supabase } from '../src/lib/supabase';
import {
  registerForPushNotifications,
  setupNotificationListeners,
} from '../src/services/notifications';

export default function Index() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (session) {
      // تسجيل الإشعارات
      registerForPushNotifications(session.user.id);

      // تحقق من الدور (سائق/راكب) وحوّل للمسار المناسب
      supabase
        .from('drivers')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            router.replace('/(driver)/(tabs)/home');
          } else {
            router.replace('/(rider)/(tabs)/home');
          }
        });
    } else {
      router.replace('/(auth)/login');
    }
  }, [session, loading]);

  // إعداد مستمعي الإشعارات
  useEffect(() => {
    const cleanup = setupNotificationListeners();
    return cleanup;
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>ران</Text>
      <Text style={styles.subtitle}>RAAN</Text>
      <ActivityIndicator size="large" color="#00d9a5" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  logo: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#00d9a5',
  },
  subtitle: {
    fontSize: 24,
    color: '#94a3b8',
    marginTop: 8,
  },
  spinner: {
    marginTop: 32,
  },
});
