/**
 * ران - صفحة تسجيل الدخول والتسجيل
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { supabase } from '../../src/lib/supabase';

type Mode = 'login' | 'register';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const formatPhone = (raw: string) => {
    // تحويل رقم عراقي: 07xx → +9647xx
    let cleaned = raw.replace(/[^0-9+]/g, '');
    if (cleaned.startsWith('07')) {
      cleaned = '+964' + cleaned.substring(1);
    } else if (cleaned.startsWith('964')) {
      cleaned = '+' + cleaned;
    }
    return cleaned;
  };

  const getEmail = (phoneNum: string) => {
    const digits = phoneNum.replace(/[^0-9]/g, '');
    return `${digits}@raan.app`;
  };

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert('خطأ', 'الرجاء إدخال رقم الهاتف وكلمة المرور');
      return;
    }

    setLoading(true);
    const email = getEmail(formatPhone(phone));
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      Alert.alert('فشل تسجيل الدخول', 'رقم الهاتف أو كلمة المرور غير صحيحة');
    }
  };

  const handleRegister = async () => {
    if (!phone || !password || !fullName) {
      Alert.alert('خطأ', 'الرجاء إكمال جميع الحقول');
      return;
    }
    if (password.length < 6) {
      Alert.alert('خطأ', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setLoading(true);
    const formattedPhone = formatPhone(phone);
    const email = getEmail(formattedPhone);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: formattedPhone,
          role: 'rider',
        },
      },
    });

    if (error) {
      setLoading(false);
      Alert.alert('فشل التسجيل', error.message);
      return;
    }

    // إنشاء ملف شخصي
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        phone: formattedPhone,
        role: 'rider',
      });
    }

    setLoading(false);
    Alert.alert('تم التسجيل', 'تم إنشاء حسابك بنجاح', [
      { text: 'حسناً', onPress: () => setMode('login') },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>ران</Text>
          <Text style={styles.subtitle}>
            {mode === 'login' ? 'تسجيل الدخول' : 'حساب جديد'}
          </Text>
        </View>

        <View style={styles.form}>
          {mode === 'register' && (
            <TextInput
              style={styles.input}
              placeholder="الاسم الكامل"
              placeholderTextColor="#64748b"
              value={fullName}
              onChangeText={setFullName}
              textAlign="right"
              autoCapitalize="words"
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="رقم الهاتف (مثال: 07801234567)"
            placeholderTextColor="#64748b"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            textAlign="right"
            maxLength={14}
          />

          <TextInput
            style={styles.input}
            placeholder="كلمة المرور"
            placeholderTextColor="#64748b"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            textAlign="right"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={mode === 'login' ? handleLogin : handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'login' ? 'دخول' : 'إنشاء حساب'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchBtn}
            onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            <Text style={styles.switchText}>
              {mode === 'login'
                ? 'ليس لديك حساب؟ سجل الآن'
                : 'لديك حساب بالفعل؟ سجل دخولك'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.driverBtn}
            onPress={() => router.push('/(auth)/register-driver')}
          >
            <Text style={styles.driverBtnText}>🚗 التسجيل كسائق</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#00d9a5',
  },
  subtitle: {
    fontSize: 20,
    color: '#94a3b8',
    marginTop: 8,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#334155',
  },
  button: {
    backgroundColor: '#00d9a5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  switchBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  switchText: {
    color: '#00d9a5',
    fontSize: 15,
  },
  driverBtn: {
    alignItems: 'center' as const,
    paddingVertical: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 14,
  },
  driverBtnText: {
    color: '#94a3b8',
    fontSize: 15,
  },
});
