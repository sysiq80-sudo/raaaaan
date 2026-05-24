-- ═══════════════════════════════════════════════════════════════
-- ران — ترقية نظام الإشعارات (Notification System Upgrade)
-- ═══════════════════════════════════════════════════════════════
-- 
-- التغييرات:
-- 1. إضافة عمود notification_preferences لجدول drivers
-- 2. إضافة أعمدة platform و fcm_token لجدول push_subscriptions
-- 3. إنشاء فهارس لتسريع الاستعلامات
--

-- 1. إضافة عمود تفضيلات الإشعارات في جدول السائقين
-- يخزن: mute_mode, mute_schedule_start, mute_schedule_end, mute_days, sounds_enabled, vibration_enabled, notification_volume
DO $$
BEGIN
  -- تحقق من وجود الجدول أولاً
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'drivers') THEN
    -- ثم تحقق من وجود العمود
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'drivers' AND column_name = 'notification_preferences'
    ) THEN
      ALTER TABLE drivers ADD COLUMN notification_preferences jsonb DEFAULT '{
        "mute_mode": "off",
        "mute_schedule_start": "23:00",
        "mute_schedule_end": "07:00",
        "mute_days": [0,1,2,3,4,5,6],
        "sounds_enabled": true,
        "vibration_enabled": true,
        "notification_volume": 80
      }'::jsonb;
      
      COMMENT ON COLUMN drivers.notification_preferences IS 'تفضيلات إشعارات السائق: وضع الكتم، الجدول، الصوت، الاهتزاز';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  جدول drivers غير موجود - تجاهل هذه الخطوة';
  END IF;
END
$$;

-- 2. إضافة أعمدة المنصة ورمز FCM لجدول الاشتراكات
DO $$
BEGIN
  -- تحقق من وجود الجدول أولاً
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'push_subscriptions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'push_subscriptions' AND column_name = 'platform'
    ) THEN
      ALTER TABLE push_subscriptions ADD COLUMN platform varchar(20) DEFAULT 'web';
      COMMENT ON COLUMN push_subscriptions.platform IS 'منصة الاشتراك: web, android, ios';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'push_subscriptions' AND column_name = 'fcm_token'
    ) THEN
      ALTER TABLE push_subscriptions ADD COLUMN fcm_token text DEFAULT NULL;
      COMMENT ON COLUMN push_subscriptions.fcm_token IS 'رمز Firebase Cloud Messaging للتطبيق الأصلي';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  جدول push_subscriptions غير موجود - تجاهل هذه الخطوة';
  END IF;
END
$$;

-- 3. فهرس على platform للبحث السريع عن اشتراكات FCM
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'push_subscriptions') THEN
    CREATE INDEX IF NOT EXISTS idx_push_subs_platform 
    ON push_subscriptions(platform) 
    WHERE platform != 'web';
  END IF;
END
$$;

-- 4. فهرس على notification_preferences->mute_mode للتصفية في Edge Function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'drivers') THEN
    CREATE INDEX IF NOT EXISTS idx_drivers_notif_mute 
    ON drivers ((notification_preferences->>'mute_mode')) 
    WHERE notification_preferences IS NOT NULL;
  END IF;
END
$$;

-- 5. تحديث RLS لعمود notification_preferences
-- السائق يمكنه قراءة/تحديث تفضيلاته فقط
-- (RLS موجود بالفعل على جدول drivers — يكفي أن العمود الجديد ضمن الجدول)

-- ═══ التحقق ═══
DO $$
BEGIN
  RAISE NOTICE '✅ تم تطبيق ترقية نظام الإشعارات';
  RAISE NOTICE '   - drivers.notification_preferences (jsonb)';
  RAISE NOTICE '   - push_subscriptions.platform (varchar)';
  RAISE NOTICE '   - push_subscriptions.fcm_token (text)';
  RAISE NOTICE '⚠️  إذا رأيت تحذيرات أعلاه = الجداول غير موجودة (تجاهل آمن)';
END
$$;
