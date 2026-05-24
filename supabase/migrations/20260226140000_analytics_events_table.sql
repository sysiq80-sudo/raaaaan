-- ════════════════════════════════════════
-- Analytics Events Table — جدول تحليلات الأحداث
-- يخزن أحداث البوت لتحليل الأداء والتحويلات
-- ════════════════════════════════════════
CREATE TABLE IF NOT EXISTS analytics_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_type text NOT NULL,
    phone_number text,
    -- مشفّر جزئياً (964****123)
    ride_id uuid,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);
-- فهارس سريعة
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_ride_id ON analytics_events (ride_id)
WHERE ride_id IS NOT NULL;
-- ═══ حماية RLS ═══
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_analytics" ON analytics_events FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
-- ═══ دالة تقرير يومي ═══
CREATE OR REPLACE FUNCTION get_daily_analytics(p_date date DEFAULT CURRENT_DATE) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_result jsonb;
BEGIN
SELECT jsonb_build_object(
        'date',
        p_date,
        'total_events',
        count(*),
        'unique_users',
        count(DISTINCT phone_number),
        'booking_funnel',
        jsonb_build_object(
            'locations_received',
            count(*) FILTER (
                WHERE event_type = 'booking_location_received'
            ),
            'destinations_set',
            count(*) FILTER (
                WHERE event_type = 'booking_destination_set'
            ),
            'confirmed',
            count(*) FILTER (
                WHERE event_type = 'booking_confirmed'
            ),
            'completed',
            count(*) FILTER (
                WHERE event_type = 'booking_completed'
            ),
            'cancelled',
            count(*) FILTER (
                WHERE event_type = 'booking_cancelled'
            ),
            'repeat_trips',
            count(*) FILTER (
                WHERE event_type = 'booking_repeat_trip'
            )
        ),
        'classification',
        jsonb_build_object(
            'local',
            count(*) FILTER (
                WHERE event_type = 'classify_local'
            ),
            'cached',
            count(*) FILTER (
                WHERE event_type = 'classify_cached'
            ),
            'gpt',
            count(*) FILTER (
                WHERE event_type = 'classify_gpt'
            )
        ),
        'errors',
        jsonb_build_object(
            'send_failed',
            count(*) FILTER (
                WHERE event_type = 'wa_send_failed'
            ),
            'send_error',
            count(*) FILTER (
                WHERE event_type = 'wa_send_error'
            ),
            'geocode_failed',
            count(*) FILTER (
                WHERE event_type = 'geocode_failed'
            ),
            'ai_error',
            count(*) FILTER (
                WHERE event_type = 'ai_error'
            )
        ),
        'avg_response_ms',
        COALESCE(
            (
                SELECT avg((metadata->>'duration_ms')::numeric)
                FROM analytics_events
                WHERE event_type = 'response_time'
                    AND created_at::date = p_date
            ),
            0
        )
    ) INTO v_result
FROM analytics_events
WHERE created_at::date = p_date;
RETURN v_result;
END;
$$;
-- ═══ تنظيف تلقائي — حذف أحداث أقدم من 30 يوم ═══
CREATE OR REPLACE FUNCTION cleanup_old_analytics() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_deleted integer;
BEGIN
DELETE FROM analytics_events
WHERE created_at < now() - interval '30 days';
GET DIAGNOSTICS v_deleted = ROW_COUNT;
RETURN v_deleted;
END;
$$;
COMMENT ON TABLE analytics_events IS 'جدول تحليلات أحداث بوت واتساب — تتبع الأداء والتحويلات';
COMMENT ON FUNCTION get_daily_analytics IS 'تقرير يومي شامل للتحليلات — booking funnel + classification + errors';
COMMENT ON FUNCTION cleanup_old_analytics IS 'حذف أحداث أقدم من 30 يوم';