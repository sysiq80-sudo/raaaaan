/**
 * Hook لجلب إعدادات الدعم الفني من قاعدة البيانات
 * يقرأ من app_settings[support] الذي يديره الأدمن
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SupportSettings {
  email: string;
  phone: string;
  whatsapp?: string;
  terms: string;
  privacy: string;
}

const FALLBACK_SUPPORT: SupportSettings = {
  email: 'support@raan.app',
  phone: '+9647884669922',
  whatsapp: '+9647884669922',
  terms: '',
  privacy: '',
};

export function useSupportSettings() {
  const { data: support = FALLBACK_SUPPORT, isLoading, error } = useQuery({
    queryKey: ['support-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'support')
        .single();

      if (error || !data?.value) return FALLBACK_SUPPORT;

      const settings = data.value as unknown as SupportSettings;
      return {
        email: settings.email || FALLBACK_SUPPORT.email,
        phone: settings.phone || FALLBACK_SUPPORT.phone,
        whatsapp: settings.whatsapp || settings.phone || FALLBACK_SUPPORT.phone,
        terms: settings.terms || '',
        privacy: settings.privacy || '',
      };
    },
    staleTime: 1000 * 60 * 60, // ساعة واحدة
    gcTime: 1000 * 60 * 60 * 24, // 24 ساعة
  });

  return { support, isLoading, error };
}
