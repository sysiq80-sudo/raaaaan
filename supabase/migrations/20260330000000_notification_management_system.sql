-- ═══════════════════════════════════════════════════════════════
-- نظام إدارة الإشعارات الشامل — ران RAAN
-- يشمل: إشعارات مخصصة، مجدولة، مجموعات، حملات
-- ═══════════════════════════════════════════════════════════════

-- 1. جدول حملات الإشعارات (الإشعارات المخصصة من لوحة التحكم)
CREATE TABLE IF NOT EXISTS public.notification_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  
  -- الاستهداف
  target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'all_drivers', 'all_riders', 'group', 'individual')),
  target_user_id UUID, -- للإرسال الفردي
  target_group_id UUID, -- للمجموعات
  target_filters JSONB DEFAULT '{}', -- فلاتر ذكية: {"vehicle_type": "economy", "region_id": "...", "min_rating": 4.0}
  
  -- نوع الإشعار
  notification_type TEXT NOT NULL DEFAULT 'custom' CHECK (notification_type IN ('promo', 'announcement', 'contest', 'system', 'custom')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- الجدولة
  scheduled_at TIMESTAMPTZ, -- NULL = فوري
  sent_at TIMESTAMPTZ,
  
  -- الحالة
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  
  -- الإحصائيات
  total_recipients INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  read_count INT DEFAULT 0,
  
  -- البيانات الإضافية
  action_url TEXT, -- deep link
  extra_data JSONB DEFAULT '{}',
  
  -- التتبع
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- فهارس لجدول الحملات
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.notification_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON public.notification_campaigns(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_campaigns_created ON public.notification_campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON public.notification_campaigns(notification_type);

-- 2. جدول مجموعات الإشعارات
CREATE TABLE IF NOT EXISTS public.notification_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  group_type TEXT NOT NULL DEFAULT 'drivers' CHECK (group_type IN ('drivers', 'riders', 'mixed')),
  
  -- فلاتر ديناميكية (تُحسب وقت الإرسال)
  is_dynamic BOOLEAN DEFAULT true,
  filters JSONB DEFAULT '{}', -- {"vehicle_type": "premium", "min_rating": 4.5, "region_id": "..."}
  
  member_count INT DEFAULT 0,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. جدول أعضاء المجموعات الثابتة
CREATE TABLE IF NOT EXISTS public.notification_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.notification_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.notification_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.notification_group_members(user_id);

-- 4. إضافة حقول للإشعارات الموجودة (driver_notifications + rider_notifications)
-- إضافة campaign_id لربط الإشعارات بالحملة
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_notifications' AND column_name = 'campaign_id') THEN
    ALTER TABLE public.driver_notifications ADD COLUMN campaign_id UUID REFERENCES public.notification_campaigns(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_notifications' AND column_name = 'action_url') THEN
    ALTER TABLE public.driver_notifications ADD COLUMN action_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_notifications' AND column_name = 'image_url') THEN
    ALTER TABLE public.driver_notifications ADD COLUMN image_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rider_notifications' AND column_name = 'campaign_id') THEN
    ALTER TABLE public.rider_notifications ADD COLUMN campaign_id UUID REFERENCES public.notification_campaigns(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rider_notifications' AND column_name = 'action_url') THEN
    ALTER TABLE public.rider_notifications ADD COLUMN action_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rider_notifications' AND column_name = 'image_url') THEN
    ALTER TABLE public.rider_notifications ADD COLUMN image_url TEXT;
  END IF;
END $$;

-- 5. إعدادات الإشعارات التلقائية (أنواع + نصوص قابلة للتعديل من الأدمن)
CREATE TABLE IF NOT EXISTS public.notification_auto_settings (
  id TEXT PRIMARY KEY, -- مثل: 'ride_accepted', 'ride_arrived', 'ride_started', 'ride_completed', 'ride_cancelled', 'new_ride_broadcast'
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  sound TEXT DEFAULT 'default',
  priority TEXT DEFAULT 'high',
  target_role TEXT NOT NULL DEFAULT 'rider' CHECK (target_role IN ('rider', 'driver', 'both')),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- إدراج الإعدادات الافتراضية
INSERT INTO public.notification_auto_settings (id, title_template, body_template, priority, target_role) VALUES
  ('ride_accepted', 'تم قبول رحلتك! ✅', 'سائق في الطريق إليك', 'high', 'rider'),
  ('ride_arrived', 'السائق وصل! 🚗', 'السائق بانتظارك في نقطة الانطلاق', 'high', 'rider'),
  ('ride_started', 'بدأت الرحلة! 🛣️', 'في الطريق إلى وجهتك', 'high', 'rider'),
  ('ride_completed', 'وصلت! 🎉', 'شكراً لاستخدامك ران - قيّم تجربتك', 'normal', 'rider'),
  ('ride_cancelled', 'تم إلغاء الرحلة ❌', 'تم إلغاء رحلتك', 'high', 'rider'),
  ('new_ride_broadcast', 'طلب رحلة جديد! 🚖', 'رحلة جديدة بالقرب منك', 'urgent', 'driver'),
  ('driver_approved', 'تم قبول طلبك! 🎉', 'مبروك! يمكنك الآن استقبال الرحلات', 'high', 'driver'),
  ('driver_suspended', 'تم إيقاف حسابك ⚠️', 'تواصل مع الدعم لمزيد من المعلومات', 'high', 'driver')
ON CONFLICT (id) DO NOTHING;

-- 6. دالة معالجة الإشعارات المجدولة
CREATE OR REPLACE FUNCTION public.process_scheduled_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  campaign RECORD;
  request_id BIGINT;
BEGIN
  -- جلب الحملات المجدولة المستحقة
  FOR campaign IN
    SELECT * FROM notification_campaigns
    WHERE status = 'scheduled'
      AND scheduled_at <= now()
    ORDER BY scheduled_at
    LIMIT 10 -- معالجة 10 حملات كحد أقصى لكل دورة
  LOOP
    -- تعليم الحملة كجاري الإرسال
    UPDATE notification_campaigns SET status = 'sending', updated_at = now() WHERE id = campaign.id;
    
    -- استدعاء Edge Function لإرسال الحملة
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'action', 'send_campaign',
        'campaign_id', campaign.id
      )
    ) INTO request_id;
    
    RAISE NOTICE 'Scheduled campaign % dispatched (request: %)', campaign.id, request_id;
  END LOOP;
END;
$$;

-- 7. تفعيل pg_cron لمعالجة الإشعارات المجدولة كل دقيقة
-- ملاحظة: pg_cron يجب أن يكون مفعلاً في Supabase Dashboard → Extensions
DO $outer$
BEGIN
  -- إنشاء الـ cron job فقط إذا كان pg_cron مفعلاً
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('process_scheduled_notifications');
    PERFORM cron.schedule(
      'process_scheduled_notifications',
      '* * * * *', -- كل دقيقة
      $$SELECT public.process_scheduled_notifications()$$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available - scheduled notifications require manual processing. Error: %', SQLERRM;
END $outer$;

-- 8. تحديث trigger إشعار الراكب عند تغير حالة الرحلة
-- يقرأ النصوص من جدول notification_auto_settings
CREATE OR REPLACE FUNCTION public.push_rider_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _setting RECORD;
  _setting_id TEXT;
  _title TEXT;
  _body TEXT;
  _type TEXT;
  request_id BIGINT;
BEGIN
  -- فقط عند تغير الحالة
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- تحديد نوع الإعداد
  CASE NEW.status
    WHEN 'accepted' THEN _setting_id := 'ride_accepted'; _type := 'ride_accepted';
    WHEN 'arrived' THEN _setting_id := 'ride_arrived'; _type := 'ride_arrived';
    WHEN 'in_progress' THEN _setting_id := 'ride_started'; _type := 'ride_started';
    WHEN 'completed' THEN _setting_id := 'ride_completed'; _type := 'ride_completed';
    WHEN 'cancelled' THEN _setting_id := 'ride_cancelled'; _type := 'ride_cancelled';
    ELSE RETURN NEW;
  END CASE;
  
  -- جلب الإعداد
  SELECT * INTO _setting FROM notification_auto_settings WHERE id = _setting_id;
  
  -- تخطي إذا معطل
  IF _setting IS NULL OR NOT _setting.is_enabled THEN
    RETURN NEW;
  END IF;
  
  _title := _setting.title_template;
  _body := _setting.body_template;
  
  -- تخزين في rider_notifications للعرض في التطبيق
  INSERT INTO rider_notifications (user_id, title, body, type, data)
  VALUES (
    NEW.rider_id,
    _title,
    _body,
    _type,
    jsonb_build_object(
      'ride_id', NEW.id,
      'status', NEW.status,
      'driver_id', NEW.driver_id,
      'action_url', '/track/' || NEW.id
    )
  );
  
  -- إرسال push notification عبر Edge Function
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

  RETURN NEW;
END;
$$;

-- إنشاء أو استبدال الـ trigger
DROP TRIGGER IF EXISTS on_ride_status_push_rider ON public.rides;
CREATE TRIGGER on_ride_status_push_rider
  AFTER UPDATE OF status ON public.rides
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.push_rider_on_status_change();

-- 9. RLS Policies

-- notification_campaigns: الأدمن فقط
ALTER TABLE public.notification_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_manage_campaigns" ON public.notification_campaigns;
CREATE POLICY "admin_manage_campaigns" ON public.notification_campaigns
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin')
  );

-- notification_groups: الأدمن فقط
ALTER TABLE public.notification_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_manage_groups" ON public.notification_groups;
CREATE POLICY "admin_manage_groups" ON public.notification_groups
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin')
  );

-- notification_group_members: الأدمن فقط
ALTER TABLE public.notification_group_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_manage_group_members" ON public.notification_group_members;
CREATE POLICY "admin_manage_group_members" ON public.notification_group_members
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin')
  );

-- notification_auto_settings: الأدمن يقرأ ويعدل
ALTER TABLE public.notification_auto_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_manage_auto_settings" ON public.notification_auto_settings;
CREATE POLICY "admin_manage_auto_settings" ON public.notification_auto_settings
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin')
  );
-- السائقين والركاب يقرأون فقط (لمعرفة الأنواع المتاحة)
DROP POLICY IF EXISTS "users_read_auto_settings" ON public.notification_auto_settings;
CREATE POLICY "users_read_auto_settings" ON public.notification_auto_settings
  FOR SELECT USING (true);

-- تحديث auto_updated_at
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
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_groups_updated_at ON public.notification_groups;
CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON public.notification_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
