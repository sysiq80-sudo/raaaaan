-- ============================================================
-- اختبار: استدعاء مباشر بدون JWT → يجب أن يرفع UNAUTHORIZED_ADMIN
-- ============================================================

-- أولاً: تحقق من auth.uid() و has_role في غياب JWT
SELECT
  auth.uid() AS current_uid,
  public.has_role(auth.uid(), 'admin'::app_role) AS is_admin;

-- ثانياً: عدد صفوف الطلبات المعلقة قبل المحاولة
SELECT count(*) AS pending_before FROM public.wallet_topup_requests WHERE status = 'pending';

-- ثالثاً: استدعاء approve بدون JWT (يجب أن يفشل)
DO $$
BEGIN
  BEGIN
    PERFORM public.approve_topup_request(
      '00000000-0000-0000-0000-000000000000'::uuid,
      'non-admin test'
    );
    RAISE EXCEPTION 'SECURITY_BREACH: approve succeeded without admin role!';
  EXCEPTION
    WHEN sqlstate '42501' THEN
      RAISE NOTICE 'PASS: approve_topup_request → UNAUTHORIZED_ADMIN (42501)';
    WHEN OTHERS THEN
      -- استثناء آخر (مثل: الطلب غير موجود) يعني أن الـ guard لم يعمل
      IF SQLERRM LIKE '%UNAUTHORIZED%' OR SQLSTATE = '42501' THEN
        RAISE NOTICE 'PASS: approve_topup_request → %', SQLERRM;
      ELSE
        RAISE EXCEPTION 'SECURITY_BREACH: got unexpected error instead of 42501: % %', SQLSTATE, SQLERRM;
      END IF;
  END;

  BEGIN
    PERFORM public.reject_topup_request(
      '00000000-0000-0000-0000-000000000000'::uuid,
      'non-admin test'
    );
    RAISE EXCEPTION 'SECURITY_BREACH: reject succeeded without admin role!';
  EXCEPTION
    WHEN sqlstate '42501' THEN
      RAISE NOTICE 'PASS: reject_topup_request → UNAUTHORIZED_ADMIN (42501)';
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%UNAUTHORIZED%' OR SQLSTATE = '42501' THEN
        RAISE NOTICE 'PASS: reject_topup_request → %', SQLERRM;
      ELSE
        RAISE EXCEPTION 'SECURITY_BREACH: got unexpected error instead of 42501: % %', SQLSTATE, SQLERRM;
      END IF;
  END;
END;
$$ LANGUAGE plpgsql;

-- رابعاً: تأكد أن لا شيء تغير
SELECT count(*) AS pending_after FROM public.wallet_topup_requests WHERE status = 'pending';
