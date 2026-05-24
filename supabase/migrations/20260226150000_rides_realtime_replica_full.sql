-- ════════════════════════════════════════
-- تفعيل Realtime بالكامل لجدول rides 
-- مع replica identity full لإرسال القيم القديمة في UPDATE
-- ════════════════════════════════════════
-- Replica identity FULL يجعل Supabase يرسل القيم القديمة (old) مع UPDATE
-- هذا ضروري لمعرفة أن الحالة تغيرت من draft إلى pending
ALTER TABLE rides REPLICA IDENTITY FULL;
-- التأكد من إضافة rides إلى supabase_realtime publication
-- (قد يكون مفعلاً بالفعل — DROP IF EXISTS للأمان)
DO $$ BEGIN -- فحص إذا الجدول مضاف بالفعل
IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
        AND tablename = 'rides'
) THEN ALTER PUBLICATION supabase_realtime
ADD TABLE rides;
RAISE NOTICE 'Added rides table to supabase_realtime publication';
ELSE RAISE NOTICE 'rides table already in supabase_realtime publication';
END IF;
END $$;
-- التأكد أيضاً من rate_limit_log و analytics_events
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
        AND tablename = 'rate_limit_log'
) THEN ALTER PUBLICATION supabase_realtime
ADD TABLE rate_limit_log;
END IF;
END $$;
COMMENT ON TABLE rides IS 'جدول الرحلات — Realtime مفعّل مع REPLICA IDENTITY FULL لدعم إشعارات واتساب الفورية';