-- ════════════════════════════════════════
-- Rate Limiting Table — حدود الاستخدام في قاعدة البيانات
-- يعمل مع عدة instances من Edge Functions
-- ════════════════════════════════════════
-- جدول تسجيل الرسائل للتحكم بالمعدل
CREATE TABLE IF NOT EXISTS rate_limit_log (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    phone_key text NOT NULL,
    -- "msg:964xxx" أو "voice:964xxx"
    created_at timestamptz NOT NULL DEFAULT now()
);
-- فهرس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_rate_limit_phone_time ON rate_limit_log (phone_key, created_at DESC);
-- دالة فحص وتسجيل Rate Limit
-- ترجع true إذا الرقم محدود (تجاوز الحد)
CREATE OR REPLACE FUNCTION check_rate_limit(
        p_phone_key text,
        p_limit integer,
        p_window_seconds integer DEFAULT 60
    ) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_count integer;
v_cutoff timestamptz;
BEGIN v_cutoff := now() - (p_window_seconds || ' seconds')::interval;
-- عد الرسائل في النافذة الزمنية
SELECT count(*) INTO v_count
FROM rate_limit_log
WHERE phone_key = p_phone_key
    AND created_at > v_cutoff;
-- إذا تجاوز الحد — ارجع true (محدود)
IF v_count >= p_limit THEN RETURN true;
END IF;
-- سجّل الرسالة الجديدة
INSERT INTO rate_limit_log (phone_key, created_at)
VALUES (p_phone_key, now());
RETURN false;
END;
$$;
-- تنظيف تلقائي — حذف السجلات الأقدم من ساعة واحدة
-- يمكن تشغيل هذا بـ pg_cron أو من Edge Function
CREATE OR REPLACE FUNCTION cleanup_rate_limit_log() RETURNS void LANGUAGE plpgsql AS $$ BEGIN
DELETE FROM rate_limit_log
WHERE created_at < now() - interval '1 hour';
END;
$$;
-- إضافة Policy لـ RLS (اختياري — فقط service role يحتاج)
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;
-- سياسة تسمح للـ service role فقط
CREATE POLICY "service_role_rate_limit" ON rate_limit_log FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
COMMENT ON TABLE rate_limit_log IS 'جدول Rate Limiting — تسجيل الرسائل للتحكم بعدد الطلبات لكل رقم هاتف';
COMMENT ON FUNCTION check_rate_limit IS 'فحص وتسجيل حد الاستخدام — يرجع true إذا تم تجاوز الحد';
COMMENT ON FUNCTION cleanup_rate_limit_log IS 'تنظيف السجلات القديمة (أكثر من ساعة)';