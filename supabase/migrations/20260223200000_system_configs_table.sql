-- =============================================================
-- ران المطور — Raan Developer Configuration Hub
-- Migration: 20260223200000
--
-- جدول system_configs: مخزن ديناميكي لجميع مفاتيح API
-- والتوكنات والإعدادات المركزية للنظام
-- =============================================================

-- ══════════════════════════════════════════════════════════════════
-- 1. إنشاء الجدول
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.system_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    key_name TEXT NOT NULL UNIQUE,
    key_value TEXT NOT NULL DEFAULT '',
    is_secret BOOLEAN NOT NULL DEFAULT false,
    description TEXT DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_system_configs_category ON public.system_configs(category);
CREATE INDEX IF NOT EXISTS idx_system_configs_key_name ON public.system_configs(key_name);

-- ══════════════════════════════════════════════════════════════════
-- 2. Row Level Security — فقط المدير يقدر يشوف ويعدّل
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;

-- المدير يقدر يشوف الكل
DROP POLICY IF EXISTS "Admins can view system_configs" ON public.system_configs;
CREATE POLICY "Admins can view system_configs"
    ON public.system_configs FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));

-- المدير يقدر يضيف
DROP POLICY IF EXISTS "Admins can insert system_configs" ON public.system_configs;
CREATE POLICY "Admins can insert system_configs"
    ON public.system_configs FOR INSERT
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- المدير يقدر يعدّل
DROP POLICY IF EXISTS "Admins can update system_configs" ON public.system_configs;
CREATE POLICY "Admins can update system_configs"
    ON public.system_configs FOR UPDATE
    USING (public.has_role(auth.uid(), 'admin'));

-- المدير يقدر يحذف
DROP POLICY IF EXISTS "Admins can delete system_configs" ON public.system_configs;
CREATE POLICY "Admins can delete system_configs"
    ON public.system_configs FOR DELETE
    USING (public.has_role(auth.uid(), 'admin'));

-- ══════════════════════════════════════════════════════════════════
-- 3. Service role policy — Edge Functions تقدر تقرأ (service_role يتجاوز RLS لكن للتوضيح)
-- ══════════════════════════════════════════════════════════════════

-- service_role يتجاوز RLS تلقائياً — لا حاجة لسياسة إضافية

-- ══════════════════════════════════════════════════════════════════
-- 4. دالة مساعدة: جلب قيمة مفتاح بالاسم
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_config(p_key_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_value TEXT;
BEGIN
    SELECT key_value INTO v_value
    FROM system_configs
    WHERE key_name = p_key_name
    LIMIT 1;
    
    RETURN v_value;
END;
$$;

-- دالة مساعدة: جلب كل مفاتيح فئة معينة
CREATE OR REPLACE FUNCTION public.get_configs_by_category(p_category TEXT)
RETURNS TABLE(key_name TEXT, key_value TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT sc.key_name, sc.key_value
    FROM system_configs sc
    WHERE sc.category = p_category;
END;
$$;

-- ══════════════════════════════════════════════════════════════════
-- 5. Trigger لتحديث updated_at تلقائياً
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_system_configs_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS system_configs_updated_at ON public.system_configs;
CREATE TRIGGER system_configs_updated_at
    BEFORE UPDATE ON public.system_configs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_system_configs_timestamp();

-- ══════════════════════════════════════════════════════════════════
-- 6. البيانات الأولية — القيم الحالية من البيئة
-- ══════════════════════════════════════════════════════════════════

INSERT INTO public.system_configs (category, key_name, key_value, is_secret, description) VALUES
-- واتساب
('whatsapp', 'WHATSAPP_ACCESS_TOKEN', '', true, 'Meta WhatsApp Cloud API access token'),
('whatsapp', 'WHATSAPP_PHONE_ID', '', false, 'WhatsApp Business Phone Number ID'),
('whatsapp', 'WHATSAPP_VERIFY_TOKEN', '', true, 'Webhook verification token (تعيّنه أنت)'),

-- تيليغرام
('telegram', 'TELEGRAM_BOT_TOKEN', '', true, 'Telegram Bot API token من @BotFather'),

-- OpenAI
('openai', 'OPENAI_API_KEY', '', true, 'OpenAI API key لـ GPT-4o و Whisper'),

-- خرائط جوجل
('google_maps', 'GOOGLE_MAPS_KEY', '', true, 'Google Maps Platform API key'),

-- Supabase Core
('supabase_core', 'SUPABASE_URL', '', false, 'Supabase project URL'),
('supabase_core', 'SUPABASE_SERVICE_ROLE_KEY', '', true, 'Supabase service role key (خطير!)'),
('supabase_core', 'SUPABASE_ANON_KEY', '', true, 'Supabase anonymous key'),

-- الموقع
('site', 'SITE_URL', '', false, 'رابط الموقع الرئيسي للتطبيق'),

-- Meta (Instagram / Messenger) — مُعدّ للمستقبل
('instagram', 'INSTAGRAM_ACCESS_TOKEN', '', true, 'Instagram Graph API token (قريباً)'),
('instagram', 'INSTAGRAM_PAGE_ID', '', false, 'Instagram Business Page ID (قريباً)'),
('messenger', 'MESSENGER_PAGE_TOKEN', '', true, 'Facebook Messenger Page token (قريباً)'),
('messenger', 'MESSENGER_VERIFY_TOKEN', '', true, 'Messenger webhook verification token (قريباً)'),

-- X (Twitter) — مُعدّ للمستقبل
('x_twitter', 'X_API_KEY', '', true, 'X (Twitter) API Key (قريباً)'),
('x_twitter', 'X_API_SECRET', '', true, 'X (Twitter) API Secret (قريباً)'),
('x_twitter', 'X_BEARER_TOKEN', '', true, 'X (Twitter) Bearer Token (قريباً)'),

-- TikTok — مُعدّ للمستقبل
('tiktok', 'TIKTOK_CLIENT_KEY', '', true, 'TikTok for Business Client Key (قريباً)'),
('tiktok', 'TIKTOK_CLIENT_SECRET', '', true, 'TikTok for Business Client Secret (قريباً)')

ON CONFLICT (key_name) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════
-- تم الحمد لله رب العالمين
-- ══════════════════════════════════════════════════════════════════
