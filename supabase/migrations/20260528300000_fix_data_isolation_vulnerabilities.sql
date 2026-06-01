-- ══════════════════════════════════════════════════════════════════════════════
-- ران — إصلاح ثغرات عزل البيانات بين الركاب والسواق
-- تاريخ: 2027-05-28
-- التدقيق الأمني: 5 ثغرات مكتشفة — هذه الـ migration تصلحها جميعاً
-- ══════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX #1 (P0/CRITICAL): driver_live_locations — إغلاق SELECT المفتوح
-- 
-- المشكلة: USING(true) يسمح لأي مستخدم مجهول (anon) بقراءة مواقع كل السائقين
-- الحل: تقييد القراءة على أطراف الرحلة + أدمن + دالة RPC للتتبع العام
--
-- صفحة /track/:token تستخدم:
--   1. get_ride_by_share_token (SECURITY DEFINER → يتجاوز RLS ✅)
--   2. Realtime subscription (يحترم RLS — لن يعمل مع anon بعد هذا الإصلاح)
--   3. Polling fallback (يحترم RLS — لن يعمل مع anon بعد هذا الإصلاح)
--
-- الحل للـ Realtime + Polling:
--   - إنشاء RPC جديد get_live_location_by_token() بدلاً من SELECT المباشر
--   - Realtime: يبقى يعمل للمستخدمين المسجّلين (راكب يتتبع رحلته)
--   - صفحة /track/:token: تستخدم polling عبر RPC (أكثر أماناً)
-- ═══════════════════════════════════════════════════════════════════════════

-- حذف كل policies القراءة القديمة
DROP POLICY IF EXISTS "public_read_live_locations"                ON public.driver_live_locations;
DROP POLICY IF EXISTS "riders_view_their_ride_driver_location"    ON public.driver_live_locations;
DROP POLICY IF EXISTS "read_own_or_ride_driver_location"          ON public.driver_live_locations;

-- سياسة جديدة: القراءة مقيّدة على أصحاب العلاقة فقط
DROP POLICY IF EXISTS "restricted_read_live_locations" ON public.driver_live_locations;
CREATE POLICY "restricted_read_live_locations"
ON public.driver_live_locations
FOR SELECT
USING (
  -- السائق يرى موقعه الخاص
  driver_id IN (
    SELECT id FROM public.drivers WHERE user_id = auth.uid()
  )
  OR
  -- الراكب يرى موقع سائقه في رحلة نشطة فقط
  EXISTS (
    SELECT 1 FROM public.rides
    WHERE rides.id = driver_live_locations.ride_id
    AND rides.rider_id = auth.uid()
    AND rides.status IN ('accepted', 'arrived', 'in_progress')
  )
  OR
  -- الأدمن يرى الكل
  public.is_admin_or_moderator()
);

-- ═══ RPC جديد: جلب موقع السائق عبر share token ═══
-- يُستخدم من صفحة /track/:token (بدون تسجيل دخول)
-- بديل آمن عن SELECT المباشر على driver_live_locations
CREATE OR REPLACE FUNCTION public.get_live_location_by_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ride_id UUID;
  v_result JSONB;
BEGIN
  -- التحقق من صلاحية التوكن
  SELECT ride_id INTO v_ride_id
  FROM public.ride_share_links
  WHERE token = p_token
    AND expires_at > now()
    AND is_active = true;

  IF v_ride_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'رابط غير صالح أو منتهي');
  END IF;

  -- التحقق أن الرحلة نشطة
  IF NOT EXISTS (
    SELECT 1 FROM public.rides
    WHERE id = v_ride_id AND status IN ('accepted', 'arrived', 'in_progress')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'الرحلة غير نشطة');
  END IF;

  -- جلب الموقع
  SELECT jsonb_build_object(
    'success', true,
    'location', dll.location,
    'heading', dll.heading,
    'speed', dll.speed,
    'updated_at', dll.updated_at
  ) INTO v_result
  FROM public.driver_live_locations dll
  WHERE dll.ride_id = v_ride_id
  LIMIT 1;

  RETURN COALESCE(v_result, jsonb_build_object('success', false, 'error', 'لا يوجد موقع حالي'));
END;
$$;

-- السماح لـ anon + authenticated باستدعاء الدالة
GRANT EXECUTE ON FUNCTION public.get_live_location_by_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_live_location_by_token(TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_live_location_by_token IS
  'جلب موقع السائق عبر share token — بديل آمن عن SELECT المباشر على driver_live_locations';


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX #2 (P1/HIGH): check_emergency_abuse() — إضافة auth guard
--
-- المشكلة: أي مستخدم مسجّل يمكنه استعلام/إنشاء تنبيه لأي مستخدم آخر
-- الحل: إضافة تحقق auth.uid() == p_user_id
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_emergency_abuse(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usage_count INTEGER;
  v_alert_exists BOOLEAN;
  v_result JSON;
BEGIN
  -- 🔒 تحقق أمني: المستخدم يفحص نفسه فقط
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN json_build_object(
      'usage_count', 0,
      'threshold_exceeded', false,
      'alert_exists', false,
      'error', 'غير مصرح — يمكنك فحص حسابك فقط'
    );
  END IF;

  -- حساب عدد استخدامات "إنهاء الرحلة" في آخر 7 أيام
  SELECT COUNT(*)
  INTO v_usage_count
  FROM public.emergency_usage_log
  WHERE user_id = p_user_id
    AND action_type = 'end_ride'
    AND created_at >= now() - INTERVAL '7 days';

  -- التحقق من وجود تنبيه نشط
  SELECT EXISTS(
    SELECT 1 FROM public.user_alerts
    WHERE user_id = p_user_id
      AND alert_type = 'emergency_abuse'
      AND status = 'active'
  ) INTO v_alert_exists;

  -- إذا >3 مرات ولا يوجد تنبيه، إنشاء تنبيه جديد
  IF v_usage_count > 3 AND NOT v_alert_exists THEN
    INSERT INTO public.user_alerts (
      user_id, user_type, alert_type, severity,
      title, description, evidence, status
    )
    SELECT
      p_user_id,
      CASE WHEN EXISTS(SELECT 1 FROM public.drivers WHERE user_id = p_user_id) THEN 'driver' ELSE 'rider' END,
      'emergency_abuse',
      'high',
      'استخدام مفرط لزر الطوارئ',
      format('تم استخدام زر إنهاء الرحلة %s مرات في آخر 7 أيام', v_usage_count),
      json_build_object(
        'usage_count', v_usage_count,
        'period_days', 7,
        'threshold', 3
      ),
      'active';
  END IF;

  v_result := json_build_object(
    'usage_count', v_usage_count,
    'threshold_exceeded', v_usage_count > 3,
    'alert_exists', v_alert_exists OR (v_usage_count > 3)
  );

  RETURN v_result;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX #3 (P1/HIGH): get_ride_messages() — إضافة auth guard
--
-- المشكلة: SECURITY DEFINER يتجاوز RLS — أي شخص يعرف ride_id يقرأ الرسائل
-- الحل: إضافة تحقق أن المستدعي مشارك في الرحلة
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_ride_messages(p_ride_id UUID)
RETURNS TABLE (
    id UUID,
    sender_id UUID,
    sender_type TEXT,
    sender_name TEXT,
    message TEXT,
    is_read BOOLEAN,
    created_at TIMESTAMPTZ,
    is_mine BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 🔒 تحقق أمني: فقط أطراف الرحلة أو الأدمن
    IF auth.uid() IS NULL THEN
      RETURN; -- لا شيء لمستخدم غير مسجّل
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.rides
      WHERE rides.id = p_ride_id
      AND (
        rides.rider_id = auth.uid()
        OR rides.driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
      )
    ) AND NOT public.is_admin_or_moderator() THEN
      RETURN; -- لا شيء إذا ليس مشارك ولا أدمن
    END IF;

    RETURN QUERY
    SELECT
        rm.id,
        rm.sender_id,
        rm.sender_type,
        COALESCE(p.full_name, 'مستخدم') as sender_name,
        rm.message,
        rm.is_read,
        rm.created_at,
        (rm.sender_id = auth.uid()) as is_mine
    FROM public.ride_messages rm
    LEFT JOIN public.profiles p ON p.user_id = rm.sender_id
    WHERE rm.ride_id = p_ride_id
    ORDER BY rm.created_at ASC;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX #4 (P2/MEDIUM): إغلاق INSERT المفتوح على جداول التنبيهات
--
-- المشكلة: WITH CHECK (true) يسمح لأي authenticated user بإنشاء تنبيهات وهمية
-- الحل: WITH CHECK (false) — فقط service_role (Edge Functions) أو SECURITY DEFINER يمكنه الإدراج
-- ═══════════════════════════════════════════════════════════════════════════

-- dual_stop_alerts
DROP POLICY IF EXISTS "system_create_alerts" ON public.dual_stop_alerts;
DROP POLICY IF EXISTS "no_direct_insert_dual_stop_alerts" ON public.dual_stop_alerts;
CREATE POLICY "no_direct_insert_dual_stop_alerts" ON public.dual_stop_alerts
  FOR INSERT WITH CHECK (false);

-- user_alerts
DROP POLICY IF EXISTS "system_create_alerts" ON public.user_alerts;
DROP POLICY IF EXISTS "no_direct_insert_user_alerts" ON public.user_alerts;
CREATE POLICY "no_direct_insert_user_alerts" ON public.user_alerts
  FOR INSERT WITH CHECK (false);

-- fraud_alerts (قد لا يكون موجوداً)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fraud_alerts'
  ) THEN
    DROP POLICY IF EXISTS "service_insert_fraud_alerts" ON public.fraud_alerts;
    DROP POLICY IF EXISTS "no_direct_insert_fraud_alerts" ON public.fraud_alerts;
    EXECUTE $p$
      CREATE POLICY "no_direct_insert_fraud_alerts" ON public.fraud_alerts
        FOR INSERT WITH CHECK (false)
    $p$;
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX #5 (P3/LOW): get_driver_wallet_balance() — إضافة auth guard
--
-- المشكلة: أي شخص يمكنه معرفة رصيد أي سائق بمعرفة driver_id
-- الحل: التحقق أن المستدعي هو السائق نفسه أو أدمن
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_driver_wallet_balance(p_driver_id UUID)
RETURNS DECIMAL(12,2) AS $$
DECLARE
  v_balance DECIMAL(12,2);
BEGIN
  -- 🔒 تحقق أمني: السائق يرى رصيده فقط أو الأدمن
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.drivers
    WHERE id = p_driver_id AND user_id = auth.uid()
  ) AND NOT public.is_admin_or_moderator() THEN
    RETURN 0;
  END IF;

  SELECT balance INTO v_balance
  FROM public.driver_wallets
  WHERE driver_id = p_driver_id;

  RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════════════════════════════
-- ملخص الإصلاحات:
--   1. 🔴 P0: driver_live_locations SELECT مقيّد + RPC بديل للتتبع العام ✅
--   2. 🟠 P1: check_emergency_abuse() يتحقق auth.uid() == p_user_id ✅
--   3. 🟠 P1: get_ride_messages() يتحقق أن المستدعي مشارك في الرحلة ✅
--   4. 🟡 P2: INSERT WITH CHECK(false) على 3 جداول تنبيهات ✅
--   5. 🟢 P3: get_driver_wallet_balance() يتحقق أن المستدعي هو السائق ✅
-- ═══════════════════════════════════════════════════════════════════════════
