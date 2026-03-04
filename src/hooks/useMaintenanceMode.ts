/**
 * Hook للتحقق من وضع الصيانة
 * يقرأ إعداد maintenance_mode من جدول app_settings
 * يستخدم في RiderLayout و DriverLayout لمنع الاستخدام أثناء الصيانة
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface GeneralSettings {
  maintenance_mode?: boolean;
  app_name?: string;
  [key: string]: unknown;
}

export function useMaintenanceMode() {
  const { data: isMaintenanceMode = false, isLoading } = useQuery({
    queryKey: ['maintenance-mode'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'general')
        .single();

      if (error || !data?.value) return false;

      const settings = data.value as unknown as GeneralSettings;
      return settings.maintenance_mode === true;
    },
    staleTime: 1000 * 30, // 30 ثانية — فحص متكرر لأن الصيانة حالة طوارئ
    gcTime: 1000 * 60 * 5, // 5 دقائق
    refetchInterval: 1000 * 60, // إعادة فحص كل دقيقة
  });

  return { isMaintenanceMode, isLoading };
}
