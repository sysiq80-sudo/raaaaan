/**
 * ران - إعدادات الراكب
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { APP_INFO } from '@/lib/constants';

export default function RiderSettings() {
  const { signOut } = useAuth();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [locationSharing, setLocationSharing] = useState(true);

  const handleSignOut = () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد من تسجيل الخروج؟', [
      { text: 'لا', style: 'cancel' },
      {
        text: 'نعم',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>الإعدادات</Text>

      {/* الحساب */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>حسابي</Text>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/(rider)/profile')}
        >
          <Text style={styles.menuArrow}>{'<'}</Text>
          <Text style={styles.menuText}>الملف الشخصي</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/(rider)/saved-places')}
        >
          <Text style={styles.menuArrow}>{'<'}</Text>
          <Text style={styles.menuText}>الأماكن المحفوظة</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/(rider)/(tabs)/rides')}
        >
          <Text style={styles.menuArrow}>{'<'}</Text>
          <Text style={styles.menuText}>سجل الرحلات</Text>
        </TouchableOpacity>
      </View>

      {/* التفضيلات */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>التفضيلات</Text>
        <View style={styles.menuItem}>
          <Switch
            value={soundEnabled}
            onValueChange={setSoundEnabled}
            trackColor={{ false: '#475569', true: '#00d9a5' }}
            thumbColor="#fff"
          />
          <Text style={styles.menuText}>أصوات الإشعارات</Text>
        </View>
        <View style={styles.menuItem}>
          <Switch
            value={locationSharing}
            onValueChange={setLocationSharing}
            trackColor={{ false: '#475569', true: '#00d9a5' }}
            thumbColor="#fff"
          />
          <Text style={styles.menuText}>مشاركة الموقع</Text>
        </View>
      </View>

      {/* حول */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>حول التطبيق</Text>
        <View style={styles.menuItem}>
          <Text style={styles.menuValue}>{APP_INFO.version}</Text>
          <Text style={styles.menuText}>الإصدار</Text>
        </View>
        <View style={styles.menuItem}>
          <Text style={styles.menuValue}>{APP_INFO.phone}</Text>
          <Text style={styles.menuText}>الدعم الفني</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
        <Text style={styles.logoutText}>تسجيل الخروج</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    color: '#f1f5f9',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 24,
  },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'right',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  menuText: {
    color: '#f1f5f9',
    fontSize: 16,
  },
  menuValue: {
    color: '#94a3b8',
    fontSize: 14,
  },
  menuArrow: {
    color: '#64748b',
    fontSize: 18,
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
