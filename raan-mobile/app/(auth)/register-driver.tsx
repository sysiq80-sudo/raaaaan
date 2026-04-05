/**
 * ران - تسجيل سائق جديد
 * Driver Registration Screen
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

type Gender = 'male' | 'female';

export default function DriverRegister() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'info' | 'password' | 'success'>('info');

  // الحقول
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // تنسيق رقم الهاتف
  const formatPhone = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('07') && digits.length >= 10) {
      return '+964' + digits.slice(1);
    }
    if (digits.startsWith('964')) {
      return '+' + digits;
    }
    return '+964' + digits;
  };

  const getEmail = (phoneNum: string): string => {
    const digits = phoneNum.replace(/\D/g, '');
    return `${digits}@raan.app`;
  };

  const validateInfo = (): boolean => {
    if (!fullName.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال الاسم الكامل');
      return false;
    }
    if (fullName.trim().length < 3) {
      Alert.alert('خطأ', 'الاسم يجب أن يكون 3 أحرف على الأقل');
      return false;
    }
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      Alert.alert('خطأ', 'يرجى إدخال رقم هاتف عراقي صحيح');
      return false;
    }
    return true;
  };

  const handleContinue = () => {
    if (validateInfo()) {
      setStep('password');
    }
  };

  const handleRegister = async () => {
    if (password.length < 6) {
      Alert.alert('خطأ', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('خطأ', 'كلمتا المرور غير متطابقتين');
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = formatPhone(phone);
      const email = getEmail(formattedPhone);

      // إنشاء حساب
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          Alert.alert('خطأ', 'هذا الرقم مسجل مسبقاً. يرجى تسجيل الدخول');
        } else {
          Alert.alert('خطأ', authError.message);
        }
        setLoading(false);
        return;
      }

      if (!authData.user) {
        Alert.alert('خطأ', 'فشل إنشاء الحساب');
        setLoading(false);
        return;
      }

      const userId = authData.user.id;

      // إنشاء الملف الشخصي
      await supabase.from('profiles').upsert({
        id: userId,
        full_name: fullName.trim(),
        phone: formattedPhone,
        role: 'driver',
      });

      // إنشاء سجل السائق
      const { error: driverError } = await supabase.from('drivers').insert({
        user_id: userId,
        full_name: fullName.trim(),
        phone: formattedPhone,
        gender,
        status: 'pending',
        is_online: false,
        is_available: false,
        vehicle_type: gender === 'female' ? 'women_only' : 'economy',
      });

      if (driverError) {
        console.error('Driver insert error:', driverError);
        Alert.alert('خطأ', 'فشل إنشاء حساب السائق');
        setLoading(false);
        return;
      }

      setStep('success');
    } catch (err) {
      console.error('Registration error:', err);
      Alert.alert('خطأ', 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>تم التسجيل بنجاح!</Text>
          <Text style={styles.successSubtitle}>
            حسابك قيد المراجعة من قبل الإدارة.{'\n'}
            سيتم إشعارك عند تفعيل حسابك.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace('/(driver)/(tabs)/home')}
          >
            <Text style={styles.primaryBtnText}>الذهاب للرئيسية</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <Text style={styles.logo}>ران</Text>
        <Text style={styles.title}>تسجيل سائق جديد</Text>
        <Text style={styles.subtitle}>
          {step === 'info' ? 'أدخل بياناتك الشخصية' : 'أنشئ كلمة مرور لحسابك'}
        </Text>

        {step === 'info' ? (
          <>
            {/* الاسم */}
            <Text style={styles.label}>الاسم الكامل</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="مثال: أحمد محمد علي"
              placeholderTextColor="#64748b"
              textAlign="right"
            />

            {/* رقم الهاتف */}
            <Text style={styles.label}>رقم الهاتف</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="07xx xxx xxxx"
              placeholderTextColor="#64748b"
              keyboardType="phone-pad"
              textAlign="right"
            />

            {/* الجنس */}
            <Text style={styles.label}>الجنس</Text>
            <View style={styles.genderRow}>
              <TouchableOpacity
                style={[styles.genderBtn, gender === 'male' && styles.genderBtnActive]}
                onPress={() => setGender('male')}
              >
                <Text style={[styles.genderText, gender === 'male' && styles.genderTextActive]}>
                  ذكر
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genderBtn, gender === 'female' && styles.genderBtnActive]}
                onPress={() => setGender('female')}
              >
                <Text style={[styles.genderText, gender === 'female' && styles.genderTextActive]}>
                  أنثى
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleContinue}>
              <Text style={styles.primaryBtnText}>متابعة</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* كلمة المرور */}
            <Text style={styles.label}>كلمة المرور</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="6 أحرف على الأقل"
              placeholderTextColor="#64748b"
              secureTextEntry
              textAlign="right"
            />

            <Text style={styles.label}>تأكيد كلمة المرور</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="أعد إدخال كلمة المرور"
              placeholderTextColor="#64748b"
              secureTextEntry
              textAlign="right"
            />

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.disabledBtn]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <Text style={styles.primaryBtnText}>إنشاء الحساب</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep('info')}>
              <Text style={styles.linkText}>← رجوع</Text>
            </TouchableOpacity>
          </>
        )}

        {/* رابط تسجيل الدخول */}
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.linkText}>لديك حساب؟ سجّل دخولك</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scroll: {
    padding: 24,
    paddingTop: 60,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#00d9a5',
    textAlign: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f1f5f9',
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 6,
    textAlign: 'right',
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#f1f5f9',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    backgroundColor: '#1e293b',
  },
  genderBtnActive: {
    borderColor: '#00d9a5',
    backgroundColor: '#00d9a520',
  },
  genderText: {
    fontSize: 16,
    color: '#94a3b8',
  },
  genderTextActive: {
    color: '#00d9a5',
    fontWeight: 'bold',
  },
  primaryBtn: {
    backgroundColor: '#00d9a5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  primaryBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  linkText: {
    color: '#00d9a5',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 8,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00d9a5',
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
});
