/**
 * Hook للتحقق من وضع الصيانة
 * يقرأ إعداد maintenance_mode من جدول app_settings
 * يستخدم في RiderLayout و DriverLayout لمنع الاستخدام أثناء الصيانة
 *
 * ✅ محمي ضد crash عند فقدان React context
 * (يحصل عند فتح التطبيق من إشعار FCM يسبب race condition مؤقت)
 */

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GeneralSettings {
  maintenance_mode?: boolean;
  app_name?: string;
  [key: string]: unknown;
}

// ✅ Cache عالمي لمنع طلبات متكررة عبر مكونات متعددة
let cachedResult: boolean | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 30_000; // 30 ثانية

async function fetchMaintenanceMode(): Promise<boolean> {
  const now = Date.now();
  if (cachedResult !== null && now - lastFetchTime < CACHE_TTL) {
    return cachedResult;
  }

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'general')
      .single();

    if (error || !data?.value) {
      cachedResult = false;
    } else {
      const settings = data.value as unknown as GeneralSettings;
      cachedResult = settings.maintenance_mode === true;
    }
    lastFetchTime = now;
    return cachedResult;
  } catch {
    return cachedResult ?? false;
  }
}

/**
 * ✅ hook بدون useQuery — يتجنب crash "useContext is null"
 * الذي يحصل عند فتح التطبيق من إشعار FCM قبل تهيئة QueryClientProvider
 */
export function useMaintenanceMode() {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(cachedResult ?? false);
  const [isLoading, setIsLoading] = useState(cachedResult === null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const result = await fetchMaintenanceMode();
      if (!cancelled) {
        setIsMaintenanceMode(result);
        setIsLoading(false);
      }
    };

    // فحص فوري
    check();

    // إعادة فحص كل دقيقة
    intervalRef.current = setInterval(check, 60_000);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { isMaintenanceMode, isLoading };
}
