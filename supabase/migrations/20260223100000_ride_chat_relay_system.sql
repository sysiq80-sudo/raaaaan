-- =============================================================
-- نظام ترحيل الدردشة — Ride Chat Relay System
-- Migration: 20260223100000
--
-- يربط بين ride_messages (الدردشة في التطبيق) وبوتات واتساب/تيليغرام
-- عندما يرسل السائق رسالة في التطبيق → يتم ترحيلها للراكب عبر البوت
-- عندما يرسل الراكب رسالة عبر البوت → تُدخل في ride_messages
-- =============================================================

-- ══════════════════════════════════════════════════════════════════
-- 1. إضافة سياسة RLS للسماح لـ service_role بالإدراج نيابة عن بوتات
--    (الـ Edge Functions تستخدم service_role_key)
-- ══════════════════════════════════════════════════════════════════

-- سياسة لتمكين service_role من إدراج رسائل (للبوتات)
-- ملاحظة: service_role يتجاوز RLS افتراضياً، لكن نضيف هذا للوضوح
-- لا حاجة لسياسة إضافية — service_role_key يتجاوز RLS

-- ══════════════════════════════════════════════════════════════════
-- 2. Trigger: ترحيل رسائل السائق لراكبي البوت
--    يُفحص بعد كل INSERT في ride_messages:
--    إذا sender_type = 'driver' والرحلة trip_type IN ('whatsapp', 'telegram')
--    → يُرسل HTTP POST لـ Edge Function relay-chat-message
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.relay_ride_message_to_bot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_ride RECORD;
  request_id BIGINT;
BEGIN
  -- فقط ترحيل رسائل السائق (السائق يرسل من التطبيق → الراكب على البوت)
  IF NEW.sender_type = 'driver' THEN
    -- جلب بيانات الرحلة
    SELECT id, trip_type, rider_id, driver_id, status
    INTO v_ride
    FROM rides
    WHERE id = NEW.ride_id;

    -- ترحيل فقط لرحلات البوت النشطة
    IF v_ride IS NOT NULL
       AND v_ride.trip_type IN ('whatsapp', 'telegram')
       AND v_ride.status IN ('accepted', 'arrived', 'in_progress')
    THEN
      SELECT net.http_post(
        url := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/relay-chat-message',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo'
        ),
        body := jsonb_build_object(
          'ride_id',     NEW.ride_id,
          'message',     NEW.message,
          'sender_type', NEW.sender_type,
          'platform',    v_ride.trip_type,
          'rider_id',    v_ride.rider_id
        )
      ) INTO request_id;

      RAISE LOG '[RelayChatMessage] Driver message relayed for ride % (platform=%): request_id=%',
        NEW.ride_id, v_ride.trip_type, request_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger
DROP TRIGGER IF EXISTS relay_ride_message_trigger ON public.ride_messages;
CREATE TRIGGER relay_ride_message_trigger
  AFTER INSERT ON public.ride_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.relay_ride_message_to_bot();

-- ══════════════════════════════════════════════════════════════════
-- تم الحمد لله رب العالمين
-- ══════════════════════════════════════════════════════════════════
