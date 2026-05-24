-- ══════════════════════════════════════════════════════════════════════════════
-- ران — إصلاحات أمنية حرجة + فهارس الأداء + حماية البيانات
-- RAAN Critical Security Fixes Migration
-- Date: 2026-04-09
-- ══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════
-- 1. إضافة idempotency_key لمنع تكرار المدفوعات
-- ═══════════════════════════════════════════

-- إضافة عمود idempotency_key لمنع الدفع المزدوج عند إعادة المحاولة
ALTER TABLE rider_wallet_transactions
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- إضافة عمود لتتبع وقت التحقق من الـ webhook
ALTER TABLE rider_wallet_transactions
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- ═══════════════════════════════════════════
-- 2. دالة إضافة رصيد المحفظة بشكل آمن (Atomic)
-- تحل مشكلة race condition عند تحديث الرصيد
-- ═══════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.credit_wallet_safely(
  p_user_id UUID,
  p_amount INTEGER,
  p_transaction_id UUID,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_transaction RECORD;
  v_new_balance INTEGER;
BEGIN
  -- التحقق من أن المبلغ موجب
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'المبلغ يجب أن يكون أكبر من صفر');
  END IF;

  -- التحقق من idempotency: هل تمت معالجة هذه العملية من قبل؟
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, status INTO v_transaction
    FROM rider_wallet_transactions
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND AND v_transaction.status = 'completed' THEN
      RETURN jsonb_build_object('success', true, 'already_processed', true, 'message', 'تمت معالجة هذه العملية مسبقاً');
    END IF;
  END IF;

  -- قفل صف المعاملة لمنع معالجتها مرتين
  SELECT id, user_id, amount, status INTO v_transaction
  FROM rider_wallet_transactions
  WHERE id = p_transaction_id AND status = 'pending'
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المعاملة غير موجودة أو تمت معالجتها');
  END IF;

  -- تحديث الرصيد بشكل ذري (atomic increment)
  UPDATE profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount
  WHERE user_id = p_user_id
  RETURNING wallet_balance INTO v_new_balance;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المستخدم غير موجود');
  END IF;

  -- تحديث حالة المعاملة
  UPDATE rider_wallet_transactions
  SET
    status = 'completed',
    verified_at = now(),
    idempotency_key = COALESCE(p_idempotency_key, idempotency_key)
  WHERE id = p_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'amount_credited', p_amount,
    'transaction_id', p_transaction_id
  );
END;
$$;

COMMENT ON FUNCTION public.credit_wallet_safely IS 'إضافة رصيد للمحفظة بشكل آمن مع حماية من التكرار';

-- ═══════════════════════════════════════════
-- 3. إصلاح RLS لجدول fake_drivers
-- منع مستخدمين عاديين من رؤية السائقين الوهميين
-- ═══════════════════════════════════════════

-- حذف السياسة القديمة التي تسمح لأي شخص بمشاهدة السائقين الوهميين
DROP POLICY IF EXISTS "Anyone can view active fake drivers" ON fake_drivers;

-- سياسة جديدة: فقط المسؤولين يمكنهم رؤية fake_drivers
CREATE POLICY "Only admins can view fake drivers"
ON fake_drivers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- ═══════════════════════════════════════════
-- 4. حماية الإحالات الدائرية (Referral Cycle Protection)
-- منع A→B ثم B→A
-- ═══════════════════════════════════════════

-- يجب حذف الدالة القديمة أولاً لأن اسم المعامل تغيّر
-- (PostgreSQL لا يسمح بتغيير اسم معامل عبر CREATE OR REPLACE)
DROP FUNCTION IF EXISTS public.apply_referral(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.apply_referral(p_referred_id UUID, p_referral_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_referrer_id UUID;
    v_referral_id UUID;
    v_referrer_reward INTEGER := 5000;
    v_referred_reward INTEGER := 5000;
BEGIN
    -- التحقق من صحة الكود
    SELECT user_id INTO v_referrer_id
    FROM public.referral_codes
    WHERE code = p_referral_code AND is_active = true;

    IF v_referrer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'كود الإحالة غير صالح');
    END IF;

    -- التحقق من أن المستخدم لا يحيل نفسه
    IF v_referrer_id = p_referred_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'لا يمكنك استخدام كود الإحالة الخاص بك');
    END IF;

    -- التحقق من أن المستخدم لم يتم إحالته من قبل
    IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = p_referred_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'لقد استخدمت كود إحالة من قبل');
    END IF;

    -- ═══ حماية من الإحالات الدائرية ═══
    -- منع: المُحال (p_referred_id) سبق أن أحال المُحيل (v_referrer_id)
    IF EXISTS (
        SELECT 1 FROM public.referrals
        WHERE referrer_id = p_referred_id
        AND referred_id = v_referrer_id
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'لا يمكن الإحالة المتبادلة بين مستخدمين');
    END IF;

    -- منع سلاسل دائرية أعمق: A→B→C→A
    IF EXISTS (
        WITH RECURSIVE referral_chain AS (
            -- البداية: من أحال المُحيل؟
            SELECT referrer_id, referred_id, 1 AS depth
            FROM public.referrals
            WHERE referred_id = v_referrer_id

            UNION ALL

            -- تتبع السلسلة للأعلى
            SELECT r.referrer_id, r.referred_id, rc.depth + 1
            FROM public.referrals r
            JOIN referral_chain rc ON r.referred_id = rc.referrer_id
            WHERE rc.depth < 10  -- حد أقصى 10 مستويات لمنع loops لا نهائية
        )
        SELECT 1 FROM referral_chain
        WHERE referrer_id = p_referred_id
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'تم اكتشاف سلسلة إحالة دائرية');
    END IF;

    -- إنشاء الإحالة
    INSERT INTO public.referrals (referrer_id, referred_id, referral_code, referrer_reward, referred_reward, status)
    VALUES (v_referrer_id, p_referred_id, p_referral_code, v_referrer_reward, v_referred_reward, 'pending')
    RETURNING id INTO v_referral_id;

    RETURN jsonb_build_object(
        'success', true,
        'referral_id', v_referral_id,
        'reward', v_referred_reward,
        'message', 'تم تطبيق كود الإحالة بنجاح! ستحصل على مكافأتك بعد إكمال أول رحلة.'
    );
END;
$$;

-- ═══════════════════════════════════════════
-- 5. فهارس الأداء الحرجة (Critical Performance Indexes)
-- ═══════════════════════════════════════════

-- فهرس رحلات معلقة — يُستخدم في كل عملية مطابقة سائق
CREATE INDEX IF NOT EXISTS idx_rides_status_created
ON rides (status, created_at DESC)
WHERE status IN ('pending', 'accepted', 'in_progress');

-- فهرس رحلات السائق النشطة
CREATE INDEX IF NOT EXISTS idx_rides_driver_status
ON rides (driver_id, status)
WHERE driver_id IS NOT NULL;

-- فهرس رحلات الراكب
CREATE INDEX IF NOT EXISTS idx_rides_rider_status
ON rides (rider_id, status);

-- فهرس الإشعارات غير المقروءة
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
ON notifications (user_id, is_read, created_at DESC)
WHERE is_read = false;

-- فهرس إشعارات السائق غير المقروءة
CREATE INDEX IF NOT EXISTS idx_driver_notifications_unread
ON driver_notifications (driver_id, is_read, created_at DESC)
WHERE is_read = false;

-- فهرس إشعارات الراكب غير المقروءة
CREATE INDEX IF NOT EXISTS idx_rider_notifications_unread
ON rider_notifications (user_id, is_read, created_at DESC)
WHERE is_read = false;

-- فهرس نقاط التتبع (GPS breadcrumbs) — يُستخدم في حساب المسافة الفعلية
CREATE INDEX IF NOT EXISTS idx_ride_tracking_ride_time
ON ride_tracking_points (ride_id, recorded_at DESC);

-- فهرس سجل استخدام API — للاستعلامات اليومية
CREATE INDEX IF NOT EXISTS idx_api_usage_type_date
ON api_usage_logs (api_type, created_at DESC);

-- فهرس المعاملات المالية بحسب المرجع
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference
ON rider_wallet_transactions (reference_id)
WHERE reference_id IS NOT NULL;

-- فهرس المعاملات المالية بحسب المستخدم والحالة
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_status
ON rider_wallet_transactions (user_id, status, created_at DESC);

-- فهرس سجلات SMS للتحكم بالمعدل
CREATE INDEX IF NOT EXISTS idx_sms_logs_phone_date
ON sms_logs (phone, created_at DESC);

-- فهرس مواقع السائقين الحية
CREATE INDEX IF NOT EXISTS idx_driver_live_locations_updated
ON driver_live_locations (driver_id, updated_at DESC);

-- ═══════════════════════════════════════════
-- 6. دالة خصم رصيد المحفظة بشكل آمن (للرحلات)
-- ═══════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.deduct_wallet_safely(
  p_user_id UUID,
  p_amount INTEGER,
  p_ride_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- التحقق من أن المبلغ موجب
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'المبلغ يجب أن يكون أكبر من صفر');
  END IF;

  -- قفل صف المستخدم لمنع خصم متزامن
  SELECT wallet_balance INTO v_current_balance
  FROM profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المستخدم غير موجود');
  END IF;

  -- التحقق من كفاية الرصيد
  IF COALESCE(v_current_balance, 0) < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'رصيد المحفظة غير كافٍ',
      'current_balance', COALESCE(v_current_balance, 0),
      'required', p_amount
    );
  END IF;

  -- خصم الرصيد
  v_new_balance := v_current_balance - p_amount;

  UPDATE profiles
  SET wallet_balance = v_new_balance
  WHERE user_id = p_user_id;

  -- تسجيل المعاملة
  INSERT INTO wallet_transactions (user_id, type, amount, description, ride_id)
  VALUES (p_user_id, 'payment', -p_amount, 'دفع أجرة رحلة من المحفظة', p_ride_id);

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'amount_deducted', p_amount,
    'ride_id', p_ride_id
  );
END;
$$;

COMMENT ON FUNCTION public.deduct_wallet_safely IS 'خصم رصيد من المحفظة بشكل آمن مع قفل لمنع التكرار';

-- ═══════════════════════════════════════════
-- 7. حماية جدول system_configs من القراءة العامة
-- ═══════════════════════════════════════════

-- التأكد من أن RLS مفعل
ALTER TABLE system_configs ENABLE ROW LEVEL SECURITY;

-- فقط المسؤولين يمكنهم قراءة الإعدادات
DROP POLICY IF EXISTS "Anyone can read system_configs" ON system_configs;
DROP POLICY IF EXISTS "Public read system_configs" ON system_configs;

CREATE POLICY "Only admins can read system_configs"
ON system_configs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- ═══════════════════════════════════════════
-- منح الصلاحيات
-- ═══════════════════════════════════════════

GRANT EXECUTE ON FUNCTION public.credit_wallet_safely TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_wallet_safely TO authenticated;

-- تعليقات التوثيق
COMMENT ON INDEX idx_rides_status_created IS 'فهرس محسّن لاستعلامات الرحلات المعلقة والنشطة';
COMMENT ON INDEX idx_rides_driver_status IS 'فهرس رحلات السائق النشطة';
