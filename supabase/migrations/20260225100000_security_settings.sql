-- ═══════════════════════════════════════════════════════════
-- إعدادات الأمان والحدود — قابلة للتعديل من لوحة التحكم
-- Security & Rate Limit Settings (Admin-Configurable)
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.app_settings (key, value, description)
VALUES (
  'security_settings',
  '{
    "whatsapp_rate_limit_per_minute": 10,
    "whatsapp_voice_rate_limit_per_minute": 3,
    "max_active_rides_per_user": 3,
    "ride_creation_cooldown_seconds": 60,
    "max_failed_match_attempts": 5
  }'::jsonb,
  'إعدادات الأمان والحدود — قابلة للتعديل من لوحة التحكم'
)
ON CONFLICT (key) DO NOTHING;
