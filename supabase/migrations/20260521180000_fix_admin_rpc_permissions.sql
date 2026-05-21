-- ══════════════════════════════════════════════════════════════
-- 🔒 تصحيح صلاحيات RPC للأدمن بعد hardening
-- ══════════════════════════════════════════════════════════════
-- المشكلة:
--   1. generate_voucher_batch مُنحت لـ authenticated بدون تحقق أدمن داخل الدالة.
--   2. admin_complete_withdrawal تم سحبها من authenticated بينما الواجهة تستدعيها مباشرة.
--
-- الحل:
--   - generate_voucher_batch تبقى قابلة للاستدعاء من عميل الأدمن، لكن تفشل
--     داخلياً إذا لم يكن المستخدم admin/moderator.
--   - admin_complete_withdrawal تُمنح لـ authenticated لأن الدالة نفسها تتحقق
--     من public.is_admin_or_moderator().
-- ══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.generate_voucher_batch(INTEGER, DECIMAL, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.generate_voucher_batch(
  p_count INTEGER,
  p_amount DECIMAL,
  p_batch_name TEXT DEFAULT NULL,
  p_expires_days INTEGER DEFAULT NULL,
  p_audience TEXT DEFAULT 'any'
)
RETURNS TABLE (code TEXT, amount DECIMAL)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_i INTEGER;
  v_generated INTEGER := 0;
  v_part1 TEXT;
  v_part2 TEXT;
  v_expires TIMESTAMPTZ;
  v_prefix TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin_or_moderator() THEN
    RAISE EXCEPTION 'غير مصرح: إصدار الكاردات للأدمن فقط';
  END IF;

  IF p_count < 1 OR p_count > 500 THEN
    RAISE EXCEPTION 'العدد يجب أن يكون بين 1 و 500';
  END IF;

  IF p_amount < 250 THEN
    RAISE EXCEPTION 'الحد الأدنى 250 دينار';
  END IF;

  IF p_audience NOT IN ('rider', 'driver', 'any') THEN
    RAISE EXCEPTION 'نوع الكارت غير صالح';
  END IF;

  v_prefix := CASE p_audience
    WHEN 'driver' THEN 'RD-'
    WHEN 'rider' THEN 'RR-'
    ELSE 'RAAN-'
  END;

  IF p_expires_days IS NOT NULL THEN
    v_expires := now() + (p_expires_days || ' days')::interval;
  END IF;

  WHILE v_generated < p_count LOOP
    v_part1 := '';
    v_part2 := '';

    FOR v_i IN 1..4 LOOP
      v_part1 := v_part1 || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
      v_part2 := v_part2 || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    END LOOP;

    v_code := v_prefix || v_part1 || '-' || v_part2;

    IF NOT EXISTS (SELECT 1 FROM public.voucher_codes vc WHERE vc.code = v_code) THEN
      INSERT INTO public.voucher_codes (
        code,
        amount,
        batch_name,
        expires_at,
        created_by,
        audience
      )
      VALUES (
        v_code,
        p_amount,
        COALESCE(p_batch_name, 'batch_' || to_char(now(), 'YYYYMMDD_HH24MI')),
        v_expires,
        auth.uid(),
        p_audience
      );

      code := v_code;
      amount := p_amount;
      RETURN NEXT;
      v_generated := v_generated + 1;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_voucher_batch(INTEGER, DECIMAL, TEXT, INTEGER, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_voucher_batch(INTEGER, DECIMAL, TEXT, INTEGER, TEXT)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_complete_withdrawal(UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_complete_withdrawal(UUID, TEXT, TEXT)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.generate_voucher_batch IS
  'إصدار دفعة كاردات شحن: callable من واجهة الأدمن فقط مع تحقق داخلي من admin/moderator';

COMMENT ON FUNCTION public.admin_complete_withdrawal IS
  'إكمال طلب سحب ذري: callable من واجهة الأدمن مع تحقق داخلي من admin/moderator وقفل FOR UPDATE';
