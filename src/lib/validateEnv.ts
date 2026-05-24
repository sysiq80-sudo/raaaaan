/**
 * ران — التحقق من متغيرات البيئة عند بداية التطبيق
 * يُطلق تحذيرات في الإنتاج إذا كانت متغيرات مهمة مفقودة
 */

interface EnvVar {
  key: string;
  required: boolean;
  label: string;
}

const ENV_VARS: EnvVar[] = [
  { key: 'VITE_SUPABASE_URL', required: true, label: 'Supabase URL' },
  { key: 'VITE_SUPABASE_PUBLISHABLE_KEY', required: true, label: 'Supabase Anon Key' },
  { key: 'VITE_GOOGLE_MAPS_API_KEY', required: false, label: 'Google Maps API Key' },
  { key: 'VITE_SENTRY_DSN', required: false, label: 'Sentry DSN' },
  { key: 'VITE_APP_VERSION', required: false, label: 'App Version' },
];

export function validateEnv(): void {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const v of ENV_VARS) {
    const value = import.meta.env[v.key];
    if (!value || value === '') {
      if (v.required) {
        missing.push(`❌ ${v.label} (${v.key})`);
      } else {
        warnings.push(`⚠️ ${v.label} (${v.key}) — غير مكوّن`);
      }
    }
  }

  if (missing.length > 0) {
    console.error(
      `[RAAN] متغيرات بيئة مطلوبة مفقودة:\n${missing.join('\n')}\n` +
      `راجع ملف .env.example`
    );
  }

  if (warnings.length > 0 && import.meta.env.DEV) {
    console.warn(
      `[RAAN] متغيرات بيئة اختيارية غير مكوّنة:\n${warnings.join('\n')}`
    );
  }
}
