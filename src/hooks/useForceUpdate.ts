import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { APP_INFO } from '@/lib/constants';

/**
 * يتحقق من الحد الأدنى لإصدار التطبيق المطلوب
 * يقرأ min_app_version من app_settings ويقارنه بالإصدار الحالي
 * يرجع true إذا كان التحديث مطلوباً
 */
export function useForceUpdate() {
  const [updateRequired, setUpdateRequired] = useState(false);
  const [minVersion, setMinVersion] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const checkVersion = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'min_app_version')
          .maybeSingle();

        if (isCancelled) return;

        if (data?.value) {
          const required = String(data.value);
          setMinVersion(required);
          if (isVersionLessThan(APP_INFO.version, required)) {
            setUpdateRequired(true);
          }
        }
      } catch {
        // صمت — لا نمنع التطبيق من العمل إذا فشل الفحص
      }
    };

    checkVersion();
    return () => { isCancelled = true; };
  }, []);

  return { updateRequired, currentVersion: APP_INFO.version, minVersion };
}

/** مقارنة إصدارات semver: هل a < b؟ */
function isVersionLessThan(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na < nb) return true;
    if (na > nb) return false;
  }
  return false;
}
