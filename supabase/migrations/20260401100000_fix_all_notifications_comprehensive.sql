-- ═══════════════════════════════════════════════════════════════════
-- إصلاح شامل لنظام الإشعارات — ران RAAN
-- يضمن:
--   1. وجود جميع الجداول اللازمة
--   2. وجود جميع الإعدادات الافتراضية (10 إعداد)
--   3. تريجرات مرنة تعمل حتى بدون إعدادات (defaults مدمجة)
--   4. سياسات RLS صحيحة
--   5. أعمدة push_subscriptions اللازمة
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. ضمان وجود الجداول ──

CREATE TABLE IF NOT EXISTS public.notification_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'all_drivers', 'all_riders', 'group', 'individual')),
  target_user_id UUID,
  target_group_id UUID,
  target_filters JSONB DEFAULT '{}',
  notification_type TEXT NOT NULL DEFAULT 'custom' CHECK (notification_type IN ('promo', 'announcement', 'contest', 'system', 'custom')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  total_recipients INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  read_count INT DEFAULT 0,
  action_url TEXT,
  extra_data JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  group_type TEXT NOT NULL DEFAULT 'mixed' CHECK (group_type IN ('drivers', 'riders', 'mixed')),
  is_dynamic BOOLEAN DEFAULT false,
  filters JSONB DEFAULT '{}',
  member_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.notification_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.notification_auto_settings (
  id TEXT PRIMARY KEY,
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  sound TEXT DEFAULT 'default',
  priority TEXT DEFAULT 'high',
  target_role TEXT NOT NULL DEFAULT 'rider' CHECK (target_role IN ('rider', 'driver', 'both')),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.notification_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON public.notification_campaigns(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_campaigns_created ON public.notification_campaigns(created_at DESC);

-- ── 2. إدراج جميع الإعدادات الافتراضية (10 إعدادات) ──

INSERT INTO public.notification_auto_settings (id, title_template, body_template, priority, target_role, is_enabled) VALUES
  ('ride_accepted',        'تم قبول رحلتك! ✅',              'سائق في الطريق إليك',                                    'high',   'rider',  true),
  ('ride_arrived',         'السائق وصل! 🚗',                 'السائق بانتظارك في نقطة الانطلاق',                          'high',   'rider',  true),
  ('ride_started',         'بدأت الرحلة! 🛣️',               'في الطريق إلى وجهتك',                                     'high',   'rider',  true),
  ('ride_completed',       'وصلت! 🎉',                       'شكراً لاستخدامك ران — قيّم تجربتك',                        'normal', 'rider',  true),
  ('ride_cancelled',       'تم إلغاء الرحلة ❌',              'تم إلغاء رحلتك',                                          'high',   'rider',  true),
  ('new_ride_broadcast',   'طلب رحلة جديد! 🚖',              'رحلة جديدة بالقرب منك',                                    'urgent', 'driver', true),
  ('driver_approved',      'تم قبول طلبك! 🎉',               'مبروك! يمكنك الآن استقبال الرحلات',                         'high',   'driver', true),
  ('driver_suspended',     'تم إيقاف حسابك ⚠️',             'تواصل مع الدعم لمزيد من المعلومات',                         'high',   'driver', true),
  ('ride_cancelled_driver','❌ تم إلغاء الرحلة',              'الراكب ألغى الرحلة',                                       'high',   'driver', true),
  ('ride_completed_driver','🏁 رحلة مكتملة',                  'تم إكمال الرحلة بنجاح',                                    'normal', 'driver', true)
ON CONFLICT (id) DO NOTHING;

-- ── 3. ضمان أعمدة push_subscriptions ──

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='push_subscriptions' AND column_name='user_id') THEN
    ALTER TABLE public.push_subscriptions ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='push_subscriptions' AND column_name='fcm_token') THEN
    ALTER TABLE public.push_subscriptions ADD COLUMN fcm_token TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='push_subscriptions' AND column_name='platform') THEN
    ALTER TABLE public.push_subscriptions ADD COLUMN platform TEXT DEFAULT 'web';
  END IF;
END $$;

-- فهرس + UNIQUE على push_subscriptions
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_driver_id ON public.push_subscriptions(driver_id);

-- UNIQUE constraint (إذا لم يكن موجود)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_user_endpoint_unique') THEN
    ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_user_endpoint_unique UNIQUE (user_id, endpoint);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- RLS لـ push_subscriptions (ضمان وصول الركاب)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users_manage_own_push_subs' AND tablename = 'push_subscriptions') THEN
    CREATE POLICY "users_manage_own_push_subs" ON public.push_subscriptions
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 4. RLS لجداول الإشعارات ──

ALTER TABLE public.notification_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_auto_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- notification_campaigns: الأدمن فقط
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_manage_campaigns' AND tablename = 'notification_campaigns') THEN
    CREATE POLICY "admin_manage_campaigns" ON public.notification_campaigns FOR ALL USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  -- notification_groups: الأدمن فقط
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_manage_groups' AND tablename = 'notification_groups') THEN
    CREATE POLICY "admin_manage_groups" ON public.notification_groups FOR ALL USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  -- notification_group_members: الأدمن فقط
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_manage_group_members' AND tablename = 'notification_group_members') THEN
    CREATE POLICY "admin_manage_group_members" ON public.notification_group_members FOR ALL USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  -- notification_auto_settings: الأدمن يدير
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_manage_auto_settings' AND tablename = 'notification_auto_settings') THEN
    CREATE POLICY "admin_manage_auto_settings" ON public.notification_auto_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  -- notification_auto_settings: الكل يقرأ
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users_read_auto_settings' AND tablename = 'notification_auto_settings') THEN
    CREATE POLICY "users_read_auto_settings" ON public.notification_auto_settings FOR SELECT USING (true);
  END IF;
END $$;

-- ── 5. تريجر إشعار الراكب — نمط مرن مع defaults مدمجة ──

CREATE OR REPLACE FUNCTION public.push_rider_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _setting RECORD;
  _setting_id TEXT;
  _title TEXT;
  _body TEXT;
  _type TEXT;
  _found BOOLEAN := false;
  request_id BIGINT;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- تحديد النوع + القيم الافتراضية المدمجة
  CASE NEW.status
    WHEN 'accepted' THEN
      _setting_id := 'ride_accepted';
      _type := 'ride_accepted';
      _title := 'تم قبول رحلتك! ✅';
      _body := 'سائق في الطريق إليك';
    WHEN 'arrived' THEN
      _setting_id := 'ride_arrived';
      _type := 'ride_arrived';
      _title := 'السائق وصل! 🚗';
      _body := 'السائق بانتظارك في نقطة الانطلاق';
    WHEN 'in_progress' THEN
      _setting_id := 'ride_started';
      _type := 'ride_started';
      _title := 'بدأت الرحلة! 🛣️';
      _body := 'في الطريق إلى وجهتك';
    WHEN 'completed' THEN
      _setting_id := 'ride_completed';
      _type := 'ride_completed';
      _title := 'وصلت! 🎉';
      _body := 'شكراً لاستخدامك ران — قيّم تجربتك';
    WHEN 'cancelled' THEN
      _setting_id := 'ride_cancelled';
      _type := 'ride_cancelled';
      _title := 'تم إلغاء الرحلة ❌';
      _body := 'تم إلغاء رحلتك';
    ELSE
      RETURN NEW;
  END CASE;

  -- محاولة القراءة من جدول الإعدادات (اختياري — إذا لم يوجد نستخدم القيم أعلاه)
  BEGIN
    SELECT * INTO _setting FROM notification_auto_settings WHERE id = _setting_id;
    IF FOUND THEN
      _found := true;
      -- إذا معطل من الإدارة → تخطي
      IF NOT _setting.is_enabled THEN
        RETURN NEW;
      END IF;
      -- استخدام النصوص المخصصة من الإدارة
      _title := _setting.title_template;
      _body := _setting.body_template;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- الجدول غير موجود أو خطأ آخر → نستمر بالقيم الافتراضية
    RAISE LOG 'notification_auto_settings read failed (using defaults): %', SQLERRM;
  END;

  -- إرسال push notification عبر Edge Function
  BEGIN
    SELECT net.http_post(
      url := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo'
      ),
      body := jsonb_build_object(
        'action', 'notify_rider',
        'rider_id', NEW.rider_id,
        'title', _title,
        'body', _body,
        'data', jsonb_build_object(
          'type', _type,
          'ride_id', NEW.id,
          'status', NEW.status,
          'driver_id', NEW.driver_id,
          'action_url', '/track/' || NEW.id
        )
      )
    ) INTO request_id;
    RAISE LOG 'Rider push sent for ride % status %: req %', NEW.id, NEW.status, request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Rider push failed for ride % (non-fatal): %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_ride_status_push_rider ON public.rides;
CREATE TRIGGER on_ride_status_push_rider
  AFTER UPDATE OF status ON public.rides
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.push_rider_on_status_change();


-- ── 6. تريجر إشعار السائق — نمط مرن مع defaults مدمجة ──

CREATE OR REPLACE FUNCTION public.push_driver_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _setting RECORD;
  _setting_id TEXT;
  _title TEXT;
  _body TEXT;
  _type TEXT;
  _driver UUID;
  request_id BIGINT;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- تحديد السائق المستهدف
  _driver := COALESCE(NEW.driver_id, OLD.driver_id);
  IF _driver IS NULL THEN
    RETURN NEW;
  END IF;

  -- تحديد النوع + القيم الافتراضية
  CASE NEW.status
    WHEN 'cancelled' THEN
      IF NEW.cancelled_by IS DISTINCT FROM 'driver' THEN
        _setting_id := 'ride_cancelled_driver';
        _type := 'ride_cancelled';
        _title := '❌ تم إلغاء الرحلة';
        _body := 'الراكب ألغى الرحلة';
      ELSE
        RETURN NEW;
      END IF;
    WHEN 'completed' THEN
      _setting_id := 'ride_completed_driver';
      _type := 'ride_completed';
      _title := '🏁 رحلة مكتملة';
      _body := 'تم إكمال الرحلة بنجاح — ' || COALESCE(NEW.final_fare::TEXT, NEW.estimated_fare::TEXT, '0') || ' د.ع';
    ELSE
      RETURN NEW;
  END CASE;

  -- محاولة القراءة من الإعدادات
  BEGIN
    SELECT * INTO _setting FROM notification_auto_settings WHERE id = _setting_id;
    IF FOUND THEN
      IF NOT _setting.is_enabled THEN
        RETURN NEW;
      END IF;
      _title := _setting.title_template;
      -- للاكتمال: إلحاق الأجرة بالنص
      IF NEW.status = 'completed' THEN
        _body := _setting.body_template || ' — ' || COALESCE(NEW.final_fare::TEXT, NEW.estimated_fare::TEXT, '0') || ' د.ع';
      ELSE
        _body := _setting.body_template;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'notification_auto_settings read failed for driver (using defaults): %', SQLERRM;
  END;

  -- إرسال push للسائق
  BEGIN
    SELECT net.http_post(
      url := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo'
      ),
      body := jsonb_build_object(
        'action', 'notify_driver',
        'driver_id', _driver,
        'title', _title,
        'body', _body,
        'data', jsonb_build_object(
          'type', _type,
          'ride_id', NEW.id,
          'status', NEW.status,
          'action_url', '/driver/ride/' || NEW.id
        )
      )
    ) INTO request_id;
    RAISE LOG 'Driver push sent for ride % status %: req %', NEW.id, NEW.status, request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Driver push failed for ride % (non-fatal): %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_ride_status_push_driver ON public.rides;
CREATE TRIGGER on_ride_status_push_driver
  AFTER UPDATE OF status ON public.rides
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.push_driver_on_status_change();


-- ── 7. تريجر إشعار السائقين عند رحلة جديدة — مع custom_title/custom_body ──

CREATE OR REPLACE FUNCTION public.notify_drivers_new_ride()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  pickup_lat FLOAT;
  pickup_lng FLOAT;
  _title TEXT := 'طلب رحلة جديد! 🚖';
  _body TEXT := 'رحلة جديدة بالقرب منك';
  _setting RECORD;
  request_id BIGINT;
BEGIN
  IF NEW.status = 'pending' THEN
    pickup_lat := (NEW.pickup_location->>'lat')::FLOAT;
    pickup_lng := (NEW.pickup_location->>'lng')::FLOAT;

    -- محاولة القراءة من الإعدادات
    BEGIN
      SELECT * INTO _setting FROM notification_auto_settings WHERE id = 'new_ride_broadcast';
      IF FOUND THEN
        IF NOT _setting.is_enabled THEN
          RETURN NEW;
        END IF;
        _title := _setting.title_template;
        _body := _setting.body_template;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'notification_auto_settings read failed for new_ride (using defaults): %', SQLERRM;
    END;

    BEGIN
      SELECT net.http_post(
        url := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo'
        ),
        body := jsonb_build_object(
          'action', 'notify_new_ride',
          'ride_id', NEW.id,
          'pickup_lat', pickup_lat,
          'pickup_lng', pickup_lng,
          'pickup_address', NEW.pickup_address,
          'dropoff_address', NEW.dropoff_address,
          'vehicle_type', NEW.vehicle_type,
          'estimated_fare', NEW.estimated_fare,
          'custom_title', _title,
          'custom_body', _body
        )
      ) INTO request_id;
      RAISE LOG 'New ride broadcast for ride %: req %', NEW.id, request_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'New ride broadcast failed for ride % (non-fatal): %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_ride_notify_drivers ON public.rides;
CREATE TRIGGER on_new_ride_notify_drivers
  AFTER INSERT ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_drivers_new_ride();


-- ── 8. تريجر updated_at التلقائي ──

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.notification_campaigns;
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.notification_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_groups_updated_at ON public.notification_groups;
CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON public.notification_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_auto_settings_updated_at ON public.notification_auto_settings;
CREATE TRIGGER update_auto_settings_updated_at
  BEFORE UPDATE ON public.notification_auto_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
