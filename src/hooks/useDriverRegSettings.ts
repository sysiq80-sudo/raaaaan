import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DriverRegistrationSettings {
  id: string;
  // General Settings
  enable_promo: boolean;
  promo_end_date: string;
  
  // Promo Mode (Free Registration) Settings
  promo_title: string;
  promo_subtitle: string;
  promo_activation_fee: number;
  promo_activation_fee_text: string;
  promo_bonus_amount: number;
  promo_bonus_text: string;
  promo_urgency_text: string;
  promo_button_text: string;
  
  // Paid Mode (After Promo) Settings
  paid_title: string;
  paid_subtitle: string;
  paid_activation_fee: number;
  paid_wallet_bonus: number;
  paid_wallet_bonus_text: string;
  paid_challenge_rides: number;
  paid_challenge_bonus: number;
  paid_challenge_text: string;
  paid_summary_text: string;
  paid_warning_text: string;
  paid_button_text: string;
  
  // Common Settings
  terms_text: string;
  countdown_text: string;
  days_text: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// Default settings in case DB is not available
const DEFAULT_SETTINGS: DriverRegistrationSettings = {
  id: 'default',
  enable_promo: true,
  promo_end_date: '2026-01-30T23:59:59+00:00',
  promo_title: 'وية ران.. التسجيل بلاش والرصيد علينا! 😉',
  promo_subtitle: 'كابتنا، لا تفوت الفرصة وسجل قبل ما يخلص الوقت!',
  promo_activation_fee: 0,
  promo_activation_fee_text: 'ما تدفع ولا فلس!',
  promo_bonus_amount: 25000,
  promo_bonus_text: 'أول ما يتفعل حسابك يجيك الرصيد، عندك 15 يوم تستفاد منها وتشتغل براحتك.',
  promo_urgency_text: 'هذا العرض يخلص يوم 30.01.2026، وبعدها يرجع التفعيل بفلوس (25,000)، يعني سجل اليوم أحسن مما تدفع باجر!',
  promo_button_text: 'سجل الآن واستفد من العرض! 🚀',
  paid_title: 'انضم ويانة بتطبيق RAAN 🚗',
  paid_subtitle: 'وابدأ مشروعك صح!',
  paid_activation_fee: 20000,
  paid_wallet_bonus: 10000,
  paid_wallet_bonus_text: 'أول ما يتفعل حسابك ينزلك 10,000 دينار رصيد صافي بالمحفظة.',
  paid_challenge_rides: 15,
  paid_challenge_bonus: 10000,
  paid_challenge_text: 'تحدي: كمل 15 طلب صباحي بأول أسبوع، وتستلم 10,000 دينار مكافأة!',
  paid_summary_text: 'الـ 20,000 اللي دفعتها رجعت لجيبك (10,000 رصيد + 10,000 مكافأة تسجيل أول مرة) ✅',
  paid_warning_text: 'تنويه صغير: رصيد المحفظة مخصص لعمولة التطبيق، يعني إذا صفرت لازم تشحنها حتى تكمل استقبال الطلبات.',
  paid_button_text: 'ابدأ التسجيل الآن 🚀',
  terms_text: 'أوافق على شروط الاستخدام وسياسة الخصوصية',
  countdown_text: 'باقي على انتهاء العرض',
  days_text: 'يوم',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function useDriverRegSettings() {
  const [settings, setSettings] = useState<DriverRegistrationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if promo is currently active
  const isPromoActive = () => {
    if (!settings.enable_promo) return false;
    const promoEndDate = new Date(settings.promo_end_date);
    return new Date() < promoEndDate;
  };

  // Calculate days remaining for promo
  const getDaysRemaining = () => {
    const promoEndDate = new Date(settings.promo_end_date);
    const now = new Date();
    const diffTime = promoEndDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('driver_registration_settings' as any)
          .select('*')
          .limit(1)
          .single();

        if (fetchError) {
          console.error('Error fetching driver registration settings:', fetchError);
          setError(fetchError.message);
          // Use default settings on error
          setSettings(DEFAULT_SETTINGS);
        } else if (data) {
          setSettings(data as any as DriverRegistrationSettings);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('حدث خطأ غير متوقع');
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('driver_registration_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_registration_settings',
        },
        (payload) => {
          console.log('Settings updated:', payload);
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setSettings(payload.new as any as DriverRegistrationSettings);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    settings,
    loading,
    error,
    isPromoActive: isPromoActive(),
    daysRemaining: getDaysRemaining(),
  };
}
