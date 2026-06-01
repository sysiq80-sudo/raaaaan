-- RAAN card-wallet-only financial mode
-- Current production policy:
--   - Ride payments: cash or internal rider wallet only
--   - Wallet top-up: internal RAAN voucher cards only
--   - External payment gateways and bank card flows stay disabled unless explicitly re-enabled later

-- Keep only cash + internal wallet visible through the configurable payment methods table.
UPDATE public.payment_methods
SET
  is_enabled = method_key IN ('cash', 'wallet'),
  is_available_for_riders = method_key IN ('cash', 'wallet'),
  is_available_for_drivers = method_key IN ('cash', 'wallet'),
  updated_at = now()
WHERE method_key IN (
  'cash',
  'wallet',
  'card',
  'zain_cash',
  'super_key',
  'nas_wallet',
  'nass',
  'qi_card',
  'asia_hawala'
);

INSERT INTO public.payment_methods (
  method_key,
  name_ar,
  name_en,
  icon_name,
  is_enabled,
  is_available_for_riders,
  is_available_for_drivers,
  display_order
)
VALUES
  ('cash', 'نقداً', 'Cash', 'banknote', true, true, true, 1),
  ('wallet', 'المحفظة', 'Wallet', 'wallet', true, true, true, 2)
ON CONFLICT (method_key) DO UPDATE
SET
  is_enabled = true,
  is_available_for_riders = true,
  is_available_for_drivers = true,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- Disable legacy/manual top-up accounts and external payment integrations.
DO $$
BEGIN
  IF to_regclass('public.payment_accounts') IS NOT NULL THEN
    UPDATE public.payment_accounts SET is_active = false;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'payment_accounts'
        AND column_name = 'api_enabled'
    ) THEN
      UPDATE public.payment_accounts SET api_enabled = false;
    END IF;
  END IF;

  IF to_regclass('public.payment_integrations') IS NOT NULL THEN
    UPDATE public.payment_integrations SET is_active = false, updated_at = now();
  END IF;
END $$;

-- Prevent authenticated clients from writing rider wallet fields directly.
-- SECURITY DEFINER wallet/voucher functions keep their owner privileges and can still write these fields.
REVOKE UPDATE ON TABLE public.profiles FROM anon, authenticated;
GRANT UPDATE (
  avatar_url,
  current_location,
  device_type,
  email,
  fcm_token,
  full_name,
  phone,
  preferred_language,
  status,
  updated_at
) ON TABLE public.profiles TO authenticated;

REVOKE INSERT ON TABLE public.profiles FROM anon, authenticated;
GRANT INSERT (
  id,
  user_id,
  avatar_url,
  created_at,
  current_location,
  device_type,
  email,
  fcm_token,
  full_name,
  phone,
  preferred_language,
  status,
  updated_at
) ON TABLE public.profiles TO authenticated;

-- credit_wallet_safely is no longer part of the active top-up flow.
-- Voucher redemption uses redeem_voucher/redeem_voucher_driver instead.
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'credit_wallet_safely'
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
      fn.proname,
      fn.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',
      fn.proname,
      fn.args
    );
  END LOOP;
END $$;

COMMENT ON TABLE public.payment_methods IS
  'خيارات الدفع المتاحة. وضع التشغيل الحالي: نقدي + محفظة داخلية مشحونة بكروت RAAN فقط.';
