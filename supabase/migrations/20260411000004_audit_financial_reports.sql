-- ============================================================
-- ران - تدقيق أمني للصفحات المالية والتقارير
-- الصفحات: AdminReports, AdminCostControls, AdminCommissionReports,
--          AdminWalletRequests, AdminWithdrawals, AdminCancellationSettings,
--          AdminCancellationReport, AdminApiStats, AdminSMSLogs
-- تاريخ: 2026-04-11 (الدفعة الرابعة)
-- ============================================================

-- ============================================================
-- SECTION 1: RLS على company_earnings (AdminCommissionReports)
-- جدول حساس جداً — لا يجب أن يراه إلا الأدمن
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'company_earnings'
  ) THEN
    ALTER TABLE public.company_earnings ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "admin_read_company_earnings"  ON public.company_earnings;
    DROP POLICY IF EXISTS "driver_own_company_earnings"  ON public.company_earnings;
    DROP POLICY IF EXISTS "system_insert_company_earnings" ON public.company_earnings;

    -- الأدمن يرى كل شيء
    EXECUTE $policy$
      CREATE POLICY "admin_read_company_earnings" ON public.company_earnings
        FOR SELECT
        USING (public.is_admin_or_moderator())
    $policy$;

    -- السائق يرى أرباحه الخاصة فقط
    EXECUTE $policy$
      CREATE POLICY "driver_own_company_earnings" ON public.company_earnings
        FOR SELECT
        USING (driver_id = auth.uid())
    $policy$;

    -- النظام يسجل الأرباح (SECURITY DEFINER functions)
    EXECUTE $policy$
      CREATE POLICY "authenticated_insert_company_earnings" ON public.company_earnings
        FOR INSERT
        WITH CHECK (public.is_admin_or_moderator())
    $policy$;
  END IF;
END $$;

-- ============================================================
-- SECTION 2: RLS على wallet_topup_requests (AdminWalletRequests)
-- كل مستخدم يرى طلباته فقط + الأدمن يرى الكل
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wallet_topup_requests'
  ) THEN
    ALTER TABLE public.wallet_topup_requests ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "user_own_topup_requests"  ON public.wallet_topup_requests;
    DROP POLICY IF EXISTS "admin_all_topup_requests" ON public.wallet_topup_requests;

    -- المستخدم يرى طلباته الخاصة فقط
    EXECUTE $policy$
      CREATE POLICY "user_own_topup_requests" ON public.wallet_topup_requests
        FOR SELECT
        USING (user_id = auth.uid() OR public.is_admin_or_moderator())
    $policy$;

    -- المستخدم يرسل طلبات باسمه فقط
    EXECUTE $policy$
      CREATE POLICY "user_insert_own_topup" ON public.wallet_topup_requests
        FOR INSERT
        WITH CHECK (user_id = auth.uid())
    $policy$;

    -- الأدمن يدير كل الطلبات (موافقة/رفض)
    EXECUTE $policy$
      CREATE POLICY "admin_manage_topup_requests" ON public.wallet_topup_requests
        FOR UPDATE
        USING (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $policy$;
  END IF;
END $$;

-- ============================================================
-- SECTION 3: RLS على withdrawal_requests (AdminWithdrawals)
-- السائق يرى طلبات سحبه الخاصة فقط + الأدمن يدير الكل
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'withdrawal_requests'
  ) THEN
    ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "driver_own_withdrawals"  ON public.withdrawal_requests;
    DROP POLICY IF EXISTS "admin_all_withdrawals"   ON public.withdrawal_requests;

    -- السائق يرى طلبات سحبه فقط
    EXECUTE $policy$
      CREATE POLICY "driver_own_withdrawals" ON public.withdrawal_requests
        FOR SELECT
        USING (driver_id = auth.uid() OR public.is_admin_or_moderator())
    $policy$;

    -- السائق يرسل طلبات سحبه الخاصة
    EXECUTE $policy$
      CREATE POLICY "driver_insert_own_withdrawal" ON public.withdrawal_requests
        FOR INSERT
        WITH CHECK (driver_id = auth.uid())
    $policy$;

    -- الأدمن يدير (موافقة/رفض/إكمال)
    EXECUTE $policy$
      CREATE POLICY "admin_manage_withdrawals" ON public.withdrawal_requests
        FOR UPDATE
        USING (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $policy$;
  END IF;
END $$;

-- ============================================================
-- SECTION 4: RLS على api_usage_logs (AdminApiStats)
-- بيانات حساسة عن الأسعار — أدمن فقط
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'api_usage_logs'
  ) THEN
    ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "admin_read_api_usage_logs"  ON public.api_usage_logs;
    DROP POLICY IF EXISTS "service_insert_api_logs"    ON public.api_usage_logs;

    -- الأدمن يرى السجلات
    EXECUTE $policy$
      CREATE POLICY "admin_read_api_usage_logs" ON public.api_usage_logs
        FOR SELECT
        USING (public.is_admin_or_moderator())
    $policy$;

    -- النظام يسجل الاستخدام (Edge Functions)
    EXECUTE $policy$
      CREATE POLICY "service_insert_api_logs" ON public.api_usage_logs
        FOR INSERT
        WITH CHECK (true)
    $policy$;
  END IF;
END $$;

-- ============================================================
-- SECTION 5: RLS على sms_logs (AdminSMSLogs)
-- بيانات حساسة + أرقام هواتف المستخدمين — أدمن فقط
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sms_logs'
  ) THEN
    ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "admin_read_sms_logs"  ON public.sms_logs;
    DROP POLICY IF EXISTS "service_insert_sms"   ON public.sms_logs;

    -- الأدمن يرى السجلات
    EXECUTE $policy$
      CREATE POLICY "admin_read_sms_logs" ON public.sms_logs
        FOR SELECT
        USING (public.is_admin_or_moderator())
    $policy$;

    -- النظام يكتب (Edge Functions)
    EXECUTE $policy$
      CREATE POLICY "service_insert_sms_logs" ON public.sms_logs
        FOR INSERT
        WITH CHECK (true)
    $policy$;
  END IF;
END $$;

-- ============================================================
-- SECTION 6: RLS على blocked_phones (AdminSMSLogs)
-- إدارة الأرقام المحظورة — أدمن فقط
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'blocked_phones'
  ) THEN
    ALTER TABLE public.blocked_phones ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "admin_manage_blocked_phones" ON public.blocked_phones;
    DROP POLICY IF EXISTS "service_insert_blocked"      ON public.blocked_phones;

    -- الأدمن يدير القائمة
    EXECUTE $policy$
      CREATE POLICY "admin_manage_blocked_phones" ON public.blocked_phones
        FOR ALL
        USING (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $policy$;

    -- النظام يضيف أرقاماً تلقائياً
    EXECUTE $policy$
      CREATE POLICY "service_insert_blocked_phones" ON public.blocked_phones
        FOR INSERT
        WITH CHECK (true)
    $policy$;
  END IF;
END $$;

-- ============================================================
-- SECTION 7: CRITICAL FIX — AdminWithdrawals يعدل المحفظة مباشرة
-- هذا خطر! تحويل منطق "complete withdrawal" إلى RPC آمنة
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_complete_withdrawal(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.admin_complete_withdrawal(
  p_request_id    UUID,
  p_tx_reference  TEXT DEFAULT NULL,
  p_notes         TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request   RECORD;
  v_wallet    RECORD;
  v_new_bal   NUMERIC;
  v_new_total NUMERIC;
BEGIN
  -- تحقق من صلاحيات الأدمن
  IF NOT public.is_admin_or_moderator() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- اجلب الطلب
  SELECT * INTO v_request
  FROM public.withdrawal_requests
  WHERE id = p_request_id;

  IF v_request IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_request.status NOT IN ('pending', 'approved', 'processing') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request is already ' || v_request.status);
  END IF;

  -- اجلب المحفظة
  SELECT * INTO v_wallet
  FROM public.driver_wallets
  WHERE id = v_request.wallet_id;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- حساب الرصيد الجديد
  v_new_bal   := GREATEST(0, v_wallet.balance - v_request.amount);
  v_new_total := COALESCE(v_wallet.total_withdrawn, 0) + v_request.amount;

  -- تحديث المحفظة
  UPDATE public.driver_wallets
  SET
    balance         = v_new_bal,
    total_withdrawn = v_new_total
  WHERE id = v_wallet.id;

  -- تسجيل المعاملة
  INSERT INTO public.wallet_transactions (
    wallet_id, driver_id, transaction_type, amount,
    balance_before, balance_after, description, metadata, status
  ) VALUES (
    v_wallet.id,
    v_request.driver_id,
    'withdrawal',
    -v_request.amount,
    v_wallet.balance,
    v_new_bal,
    'سحب أرباح — ' || v_request.withdrawal_method,
    jsonb_build_object(
      'withdrawal_request_id', p_request_id,
      'transaction_reference', p_tx_reference
    ),
    'completed'
  );

  -- تحديث حالة الطلب
  UPDATE public.withdrawal_requests
  SET
    status                  = 'completed',
    processed_at            = NOW(),
    transaction_reference   = p_tx_reference,
    review_notes            = COALESCE(p_notes, review_notes)
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success',        true,
    'new_balance',    v_new_bal,
    'amount_debited', v_request.amount
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================
-- SECTION 8: AdminReports — تحسين الأداء (كان يجلب كل الرحلات)
-- إنشاء View للتقارير المالية بدلاً من جلب كل الحقول
-- ============================================================

CREATE OR REPLACE VIEW public.rides_financial_summary AS
SELECT
  id,
  status,
  created_at,
  COALESCE(final_fare, estimated_fare, 0) AS fare,
  payment_method
FROM public.rides
WHERE status IN ('completed', 'cancelled');

-- ============================================================
-- SECTION 9: Indexes للأداء
-- ============================================================

-- company_earnings: استعلام حسب التاريخ (AdminCommissionReports)
CREATE INDEX IF NOT EXISTS idx_company_earnings_date
  ON public.company_earnings (date DESC);

CREATE INDEX IF NOT EXISTS idx_company_earnings_driver_date
  ON public.company_earnings (driver_id, date DESC);

-- wallet_topup_requests: pending filter
CREATE INDEX IF NOT EXISTS idx_topup_requests_status
  ON public.wallet_topup_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_topup_requests_user
  ON public.wallet_topup_requests (user_id, status);

-- withdrawal_requests
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status
  ON public.withdrawal_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_driver
  ON public.withdrawal_requests (driver_id, status);

-- api_usage_logs
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_date
  ON public.api_usage_logs (date DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_type_date
  ON public.api_usage_logs (api_type, date DESC);

-- sms_logs
CREATE INDEX IF NOT EXISTS idx_sms_logs_created
  ON public.sms_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_logs_phone
  ON public.sms_logs (phone, created_at DESC);

-- blocked_phones
CREATE INDEX IF NOT EXISTS idx_blocked_phones_phone
  ON public.blocked_phones (phone);

-- ============================================================
-- END OF MIGRATION
-- الملاحظات:
-- 1. AdminReports: كان يجلب جميع صفوف rides — View مُضافة للأداء
-- 2. AdminCostControls: لا قاعدة بيانات (حالة محلية فقط) ✅
-- 3. AdminCommissionReports: RLS مُضاف على company_earnings ✅
-- 4. AdminWalletRequests: RLS مُضاف + RPCs موجودة ✅
-- 5. AdminWithdrawals: RLS مُضاف + RPC آمنة للإكمال ✅ (CRITICAL)
-- 6. AdminCancellationSettings: app_settings مؤمّن من Batch 2 ✅
-- 7. AdminCancellationReport: rides مؤمّنة من Batch 1 ✅
-- 8. AdminApiStats: RLS مُضاف على api_usage_logs ✅
-- 9. AdminSMSLogs: RLS مُضاف على sms_logs و blocked_phones ✅
-- ============================================================
