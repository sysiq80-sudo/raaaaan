/**
 * ران - الملف الشخصي للسائق
 */

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../src/hooks/useAuth';
import { supabase } from '../../src/lib/supabase';

interface ProfileData {
  full_name: string;
  phone: string;
  email: string;
}

export default function DriverProfile() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<ProfileData>({
    full_name: '',
    phone: '',
    email: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('full_name, phone, email')
      .eq('id', session.user.id)
      .single();
    if (data) {
      setProfile({
        full_name: data.full_name || '',
        phone: data.phone || '',
        email: data.email || '',
      });
    }
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    if (!session?.user?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        phone: profile.phone,
      })
      .eq('id', session.user.id);

    if (error) {
      Alert.alert('خطأ', 'فشل حفظ البيانات');
    } else {
      Alert.alert('نجاح', 'تم تحديث بياناتك بنجاح');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00d9a5" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>الملف الشخصي</Text>

      <View style={styles.field}>
        <Text style={styles.label}>الاسم الكامل</Text>
        <TextInput
          style={styles.input}
          value={profile.full_name}
          onChangeText={(v) => setProfile((p) => ({ ...p, full_name: v }))}
          placeholder="أدخل اسمك"
          placeholderTextColor="#64748b"
          textAlign="right"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>رقم الهاتف</Text>
        <TextInput
          style={styles.input}
          value={profile.phone}
          onChangeText={(v) => setProfile((p) => ({ ...p, phone: v }))}
          placeholder="07xxxxxxxxx"
          placeholderTextColor="#64748b"
          keyboardType="phone-pad"
          textAlign="right"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>البريد الإلكتروني</Text>
        <TextInput
          style={[styles.input, styles.readOnly]}
          value={profile.email}
          editable={false}
          textAlign="right"
        />
      </View>

      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.saveText}>حفظ التغييرات</Text>
        )}
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
  center: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#f1f5f9',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 24,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'right',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    color: '#f1f5f9',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  readOnly: {
    opacity: 0.6,
  },
  saveButton: {
    backgroundColor: '#00d9a5',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveText: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
