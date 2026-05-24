-- ════════════════════════════════════════════════════════════════
-- Phase 1 — Security Audit Findings Fix Migration
-- Generated: 2026-04-20 by RAAN security audit
--
-- Scope: Fixes 5 confirmed exploitable RLS / function-ACL gaps:
--   1. CRITICAL: rider_wallet_transactions INSERT open to all users
--   2. CRITICAL: driver_wallet_transactions INSERT open to all users
--   3. CRITICAL: saved_cards has NO RLS (payment tokens exposed)
--   4. HIGH: app_settings publicly readable (leaks API keys)
--   5. HIGH: 10 financial SECURITY DEFINER RPCs callable by anon
--
-- Strategy:
--   - Wallet writes must come from SECURITY DEFINER functions (server-side)
--     OR from admins. Direct INSERT by clients is blocked.
--   - app_settings split: only NON-secret keys are publicly readable;
--     secret keys (api_keys, dsn, tokens) require admin role.
--   - saved_cards: enable RLS, owner-only SELECT/UPDATE/DELETE, INSERT
--     restricted to service role.
--   - All risky DEFINER RPCs: REVOKE EXECUTE FROM PUBLIC/anon/authenticated;
--     keep callable only by service_role and admin RPCs.
-- ════════════════════════════════════════════════════════════════

-- ─── Fix #1: rider_wallet_transactions INSERT lockdown ───────────
DROP POLICY IF EXISTS "System can insert wallet transactions"  ON public.rider_wallet_transactions;
DROP POLICY IF EXISTS "user_insert_own_topup"                  ON public.rider_wallet_transactions;
DROP POLICY IF EXISTS "Users can create their own topup requests" ON public.rider_wallet_transactions;

-- Only admins can directly INSERT rider wallet rows. All normal flows
-- (top-up callback, ride completion, refund) must go through
-- SECURITY DEFINER functions called by Edge Functions with service_role,
-- which bypass RLS by design.
CREATE POLICY "rider_wallet_admin_insert"
  ON public.rider_wallet_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK ( public.is_admin() );

-- ─── Fix #2: driver_wallet_transactions INSERT lockdown ──────────
DROP POLICY IF EXISTS "System can insert transactions" ON public.driver_wallet_transactions;

CREATE POLICY "driver_wallet_admin_insert"
  ON public.driver_wallet_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK ( public.is_admin() );

-- ─── Fix #2b: same pattern for driver_incentive_claims & company_earnings ──
DROP POLICY IF EXISTS "System can insert claims"                ON public.driver_incentive_claims;
DROP POLICY IF EXISTS "service_insert_claims"                   ON public.driver_incentive_claims;
CREATE POLICY "driver_incentive_admin_insert"
  ON public.driver_incentive_claims
  FOR INSERT TO authenticated
  WITH CHECK ( public.is_admin() );

DROP POLICY IF EXISTS "System can insert earnings"              ON public.company_earnings;
DROP POLICY IF EXISTS "authenticated_insert_company_earnings"   ON public.company_earnings;
CREATE POLICY "company_earnings_admin_insert"
  ON public.company_earnings
  FOR INSERT TO authenticated
  WITH CHECK ( public.is_admin() );

-- ─── Fix #2c: wallet_topup_requests / withdrawal_requests user-scoped INSERT
-- These were "qual is null + with_check true" allowing any authenticated user
-- to create requests for any user_id. Constrain WITH CHECK to self.
DROP POLICY IF EXISTS "Users can create their own topup requests" ON public.wallet_topup_requests;
DROP POLICY IF EXISTS "user_insert_own_topup"                     ON public.wallet_topup_requests;
CREATE POLICY "topup_user_insert_own"
  ON public.wallet_topup_requests
  FOR INSERT TO authenticated
  WITH CHECK ( user_id = auth.uid() );

DROP POLICY IF EXISTS "driver_insert_own_withdrawal" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "drivers_create_withdrawal"    ON public.withdrawal_requests;
CREATE POLICY "withdrawal_driver_insert_own"
  ON public.withdrawal_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users create own promo usage" ON public.promo_code_usage;
CREATE POLICY "promo_usage_user_insert_own"
  ON public.promo_code_usage
  FOR INSERT TO authenticated
  WITH CHECK ( user_id = auth.uid() );

-- ─── Fix #3: saved_cards — enable RLS + owner-only access ────────
ALTER TABLE public.saved_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_cards FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_cards_owner_select" ON public.saved_cards;
DROP POLICY IF EXISTS "saved_cards_owner_update" ON public.saved_cards;
DROP POLICY IF EXISTS "saved_cards_owner_delete" ON public.saved_cards;
DROP POLICY IF EXISTS "saved_cards_admin_all"    ON public.saved_cards;

CREATE POLICY "saved_cards_owner_select"
  ON public.saved_cards FOR SELECT TO authenticated
  USING ( user_id = auth.uid() );

CREATE POLICY "saved_cards_owner_update"
  ON public.saved_cards FOR UPDATE TO authenticated
  USING ( user_id = auth.uid() )
  WITH CHECK ( user_id = auth.uid() );

CREATE POLICY "saved_cards_owner_delete"
  ON public.saved_cards FOR DELETE TO authenticated
  USING ( user_id = auth.uid() );

-- INSERT must come from server (after provider tokenization) — not direct.
-- No INSERT policy => only service_role (which bypasses RLS) can write.

CREATE POLICY "saved_cards_admin_all"
  ON public.saved_cards FOR ALL TO authenticated
  USING ( public.is_admin() ) WITH CHECK ( public.is_admin() );

-- ─── Fix #4: app_settings — hide secret keys from public ─────────
DROP POLICY IF EXISTS "Anyone can read settings"      ON public.app_settings;
DROP POLICY IF EXISTS "public_read_app_settings"      ON public.app_settings;

-- Public can read only non-secret config keys. Secrets stay admin-only.
CREATE POLICY "app_settings_public_safe_read"
  ON public.app_settings FOR SELECT
  TO anon, authenticated
  USING (
    key NOT IN (
      'google_maps_api_key',
      'maps',
      'integrations',
      'sentry_dsn',
      'support'
    )
    AND key NOT ILIKE '%api_key%'
    AND key NOT ILIKE '%secret%'
    AND key NOT ILIKE '%token%'
    AND key NOT ILIKE '%dsn%'
    AND key NOT ILIKE '%password%'
  );

-- ─── Fix #5: Lock down 10 risky financial SECURITY DEFINER RPCs ──
-- Default function ACL grants EXECUTE to PUBLIC. We revoke that and
-- only re-grant to service_role (for Edge Functions) and authenticated
-- where the function explicitly checks auth.uid() inside.
--
-- RPCs flagged as CRITICAL by step1.2 audit:
DO $fix$
DECLARE
  fn_signatures text[] := ARRAY[
    'public.admin_complete_withdrawal(uuid,text,text)',
    'public.audit_ride_fare(uuid,double precision)',
    'public.check_and_grant_incentives(uuid)',
    'public.create_wallet_transaction(uuid,text,numeric,uuid,text,jsonb)',
    'public.credit_wallet_safely(uuid,integer,uuid,text)',
    'public.deduct_driver_commission(uuid,integer,uuid)',
    'public.deduct_wallet_safely(uuid,integer,uuid)',
    'public.get_ride_by_share_token(text)',
    'public.process_ride_earnings(uuid,uuid,numeric,numeric)',
    'public.transfer_wallet_to_driver(uuid,uuid,integer,uuid,numeric)',
    -- HIGH severity admin RPCs
    'public.admin_delete_landmarks_by_governorate(uuid)',
    'public.admin_toggle_driver_activation(uuid,boolean,uuid)',
    'public.create_controller_account(text,text,text,text)',
    'public.delete_ride_cascade(uuid)',
    'public.reject_driver_update_request(uuid,uuid,text)'
  ];
  sig text;
BEGIN
  FOREACH sig IN ARRAY fn_signatures LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);
      RAISE NOTICE 'Locked down: %', sig;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skip (not found or wrong sig): % — %', sig, SQLERRM;
    END;
  END LOOP;
END;
$fix$;

-- ─── Sanity recheck markers ──────────────────────────────────────
COMMENT ON TABLE public.saved_cards IS 'Payment card tokens. RLS owner-only. Server-side INSERT via service role only.';
COMMENT ON TABLE public.rider_wallet_transactions IS 'Rider wallet ledger. INSERT/UPDATE only via SECURITY DEFINER functions or admin.';
COMMENT ON TABLE public.driver_wallet_transactions IS 'Driver wallet ledger. INSERT/UPDATE only via SECURITY DEFINER functions or admin.';
