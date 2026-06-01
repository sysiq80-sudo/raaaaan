/**
 * Hook لجلب طرق الدفع من قاعدة البيانات
 * يقرأ من جدول payment_methods الذي يديره الأدمن
 * مع fallback ثابتة في حال عدم توفر الاتصال
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PaymentMethodDB {
  id: string;
  method_key: string;
  name_ar: string;
  name_en: string;
  icon_name: string;
  display_order: number;
  is_enabled: boolean;
}

const ENABLED_PAYMENT_METHOD_KEYS = new Set(['cash', 'wallet']);

// Fallback في حالة عدم توفر قاعدة البيانات
const FALLBACK_PAYMENT_METHODS: PaymentMethodDB[] = [
  {
    id: 'fallback-cash',
    method_key: 'cash',
    name_ar: 'نقداً',
    name_en: 'Cash',
    icon_name: 'banknote',
    display_order: 1,
    is_enabled: true,
  },
  {
    id: 'fallback-wallet',
    method_key: 'wallet',
    name_ar: 'المحفظة',
    name_en: 'Wallet',
    icon_name: 'wallet',
    display_order: 2,
    is_enabled: true,
  },
];

export function usePaymentMethods() {
  const { data: paymentMethods = FALLBACK_PAYMENT_METHODS, isLoading, error } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('is_enabled', true)
        .order('display_order');

      if (error) throw error;
      
      // إذا لم تكن هناك بيانات، ارجع الافتراضي
      if (!data || data.length === 0) return FALLBACK_PAYMENT_METHODS;
      
      return (data as PaymentMethodDB[]).filter((method) =>
        ENABLED_PAYMENT_METHOD_KEYS.has(method.method_key)
      );
    },
    staleTime: 1000 * 60 * 30, // 30 دقيقة
    gcTime: 1000 * 60 * 60 * 24, // 24 ساعة
  });

  const getMethodName = (methodKey: string, lang: 'ar' | 'en' = 'ar'): string => {
    const method = paymentMethods.find(m => m.method_key === methodKey);
    return lang === 'ar' ? (method?.name_ar || methodKey) : (method?.name_en || methodKey);
  };

  const isMethodEnabled = (methodKey: string): boolean => {
    const method = paymentMethods.find(m => m.method_key === methodKey);
    return method?.is_enabled ?? false;
  };

  return {
    paymentMethods,
    getMethodName,
    isMethodEnabled,
    isLoading,
    error,
  };
}
