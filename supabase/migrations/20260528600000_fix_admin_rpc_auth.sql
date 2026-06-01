-- ============================================================
-- ران — إصلاح أمني: admin_toggle_driver_activation
-- يستخدم auth.uid() بدل p_admin_user_id من العميل
-- تاريخ: 2026-05-28
-- ============================================================

-- إعادة إنشاء الدالة مع استخدام auth.uid()
CREATE OR REPLACE FUNCTION public.admin_toggle_driver_activation(
  p_driver_id     UUID,
  p_is_active     BOOLEAN,
  p_admin_user_id UUID DEFAULT NULL  -- مُتجاهَل الآن — يبقى لعدم كسر الاستدعاءات القديمة
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := COALESCE(auth.uid(), p_admin_user_id);
BEGIN
  -- ✅ SECURITY FIX: التحقق من الهوية عبر auth.uid() أولاً
  -- p_admin_user_id يُستخدم كـ fallback فقط عند الاستدعاء من service_role (Edge Functions)
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: no authenticated user';
  END IF;

  -- التحقق من أن المستدعي أدمن أو مشرف
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_admin_id
      AND role IN ('admin', 'moderator')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: only admins can toggle driver activation';
  END IF;

  -- تحديث حالة التفعيل
  UPDATE public.drivers
  SET
    admin_activated  = p_is_active,
    is_online        = CASE WHEN NOT p_is_active THEN false ELSE is_online END,
    is_available     = CASE WHEN NOT p_is_active THEN false ELSE is_available END,
    admin_controlled = NOT p_is_active,
    updated_at       = now()
  WHERE id = p_driver_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Driver not found: %', p_driver_id;
  END IF;
END;
$$;

-- ✅ صلاحيات: authenticated يحتاج JWT (يُفحص auth.uid() داخلياً) + service_role لـ Edge Functions
REVOKE EXECUTE ON FUNCTION public.admin_toggle_driver_activation(UUID, BOOLEAN, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_toggle_driver_activation(UUID, BOOLEAN, UUID) TO authenticated, service_role;
