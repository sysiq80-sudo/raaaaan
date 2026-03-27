-- ════════════════════════════════════════
-- تنظيف الجلسات المنتهية تلقائياً
-- Automatic Session Cleanup & Stale Chat Purge
-- ════════════════════════════════════════
-- دالة تنظيف الدردشات المنتهية (الرحلة انتهت لكن last_intent لا يزال chatting)
CREATE OR REPLACE FUNCTION cleanup_stale_chat_sessions() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_cleaned integer;
BEGIN -- مسح حالة الدردشة للمستخدمين الذين رحلتهم انتهت
WITH stale_chats AS (
    SELECT bc.id,
        bc.last_intent,
        substring(
            bc.last_intent
            from 'chatting_with_driver:(.+)'
        ) as ride_id
    FROM bot_customers bc
    WHERE bc.last_intent LIKE 'chatting_with_driver:%'
        AND bc.platform = 'whatsapp'
),
ended_rides AS (
    SELECT sc.id as bc_id
    FROM stale_chats sc
        LEFT JOIN rides r ON r.id::text = sc.ride_id
    WHERE r.id IS NULL
        OR r.status NOT IN ('accepted', 'arrived', 'in_progress')
)
UPDATE bot_customers bc
SET last_intent = NULL
FROM ended_rides er
WHERE bc.id = er.bc_id;
GET DIAGNOSTICS v_cleaned = ROW_COUNT;
IF v_cleaned > 0 THEN RAISE NOTICE 'Cleaned % stale chat sessions',
v_cleaned;
END IF;
RETURN v_cleaned;
END;
$$;
-- دالة تنظيف draft sessions القديمة (أقدم من 30 دقيقة)
CREATE OR REPLACE FUNCTION cleanup_stale_draft_sessions() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_cleaned integer;
BEGIN
DELETE FROM rides
WHERE status = 'draft'
    AND trip_type = 'whatsapp'
    AND dropoff_address IS NULL
    AND created_at < now() - interval '30 minutes';
GET DIAGNOSTICS v_cleaned = ROW_COUNT;
IF v_cleaned > 0 THEN RAISE NOTICE 'Cleaned % stale draft sessions',
v_cleaned;
END IF;
RETURN v_cleaned;
END;
$$;
-- دالة تنظيف awaiting_schedule المنتهية (أقدم من 15 دقيقة)
CREATE OR REPLACE FUNCTION cleanup_stale_awaiting_schedule() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_cleaned integer;
BEGIN
UPDATE bot_customers
SET last_intent = NULL
WHERE last_intent = 'awaiting_schedule'
    AND last_active < now() - interval '15 minutes';
GET DIAGNOSTICS v_cleaned = ROW_COUNT;
RETURN v_cleaned;
END;
$$;
-- دالة شاملة تنظف كل شي
CREATE OR REPLACE FUNCTION run_all_cleanups() RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_chats integer;
v_drafts integer;
v_schedules integer;
v_rate_limits integer;
BEGIN
SELECT cleanup_stale_chat_sessions() INTO v_chats;
SELECT cleanup_stale_draft_sessions() INTO v_drafts;
SELECT cleanup_stale_awaiting_schedule() INTO v_schedules;
-- تنظيف rate limit log
DELETE FROM rate_limit_log
WHERE created_at < now() - interval '1 hour';
GET DIAGNOSTICS v_rate_limits = ROW_COUNT;
RETURN jsonb_build_object(
    'stale_chats_cleaned',
    v_chats,
    'stale_drafts_cleaned',
    v_drafts,
    'stale_schedules_cleaned',
    v_schedules,
    'rate_limit_entries_cleaned',
    v_rate_limits,
    'cleaned_at',
    now()
);
END;
$$;
COMMENT ON FUNCTION cleanup_stale_chat_sessions IS 'تنظيف حالة الدردشة للمستخدمين الذين انتهت رحلتهم';
COMMENT ON FUNCTION cleanup_stale_draft_sessions IS 'حذف جلسات draft القديمة (30 دقيقة+)';
COMMENT ON FUNCTION cleanup_stale_awaiting_schedule IS 'مسح حالة awaiting_schedule المنتهية (15 دقيقة+)';
COMMENT ON FUNCTION run_all_cleanups IS 'دالة شاملة لتنظيف كل الجلسات والسجلات القديمة';