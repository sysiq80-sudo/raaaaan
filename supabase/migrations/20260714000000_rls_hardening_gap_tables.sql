-- ═══════════════════════════════════════════════════════════════════════════
-- RLS hardening: notifications, dynamic_pricing_history, rider_notifications,
-- visual_workflows (admin-only), workflow_executions / workflow_step_logs
-- ═══════════════════════════════════════════════════════════════════════════

-- ── public.notifications (in-app feed) ─────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "users_select_own_notifications" ON public.notifications;
    DROP POLICY IF EXISTS "users_update_own_notifications" ON public.notifications;
    DROP POLICY IF EXISTS "users_insert_own_notifications" ON public.notifications;
    DROP POLICY IF EXISTS "admins_all_notifications" ON public.notifications;

    CREATE POLICY "users_select_own_notifications" ON public.notifications
      FOR SELECT USING (auth.uid() = user_id);

    CREATE POLICY "users_update_own_notifications" ON public.notifications
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "users_insert_own_notifications" ON public.notifications
      FOR INSERT WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "admins_all_notifications" ON public.notifications
      FOR ALL USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- ── public.dynamic_pricing_history (ride-linked audit) ───────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'dynamic_pricing_history'
  ) THEN
    ALTER TABLE public.dynamic_pricing_history ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "dynamic_pricing_select_parties" ON public.dynamic_pricing_history;
    DROP POLICY IF EXISTS "dynamic_pricing_admin_all" ON public.dynamic_pricing_history;

    CREATE POLICY "dynamic_pricing_select_parties" ON public.dynamic_pricing_history
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.rides r
          WHERE r.id = dynamic_pricing_history.ride_id
            AND (
              r.rider_id = auth.uid()
              OR r.driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
            )
        )
      );

    CREATE POLICY "dynamic_pricing_admin_all" ON public.dynamic_pricing_history
      FOR ALL USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- ── public.rider_notifications ───────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'rider_notifications'
  ) THEN
    ALTER TABLE public.rider_notifications ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "riders_select_own_notifications" ON public.rider_notifications;
    DROP POLICY IF EXISTS "riders_update_own_notifications" ON public.rider_notifications;
    DROP POLICY IF EXISTS "admins_all_rider_notifications" ON public.rider_notifications;

    CREATE POLICY "riders_select_own_notifications" ON public.rider_notifications
      FOR SELECT USING (auth.uid() = user_id);

    CREATE POLICY "riders_update_own_notifications" ON public.rider_notifications
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    -- Inserts من triggers (SECURITY DEFINER) أو حملات الإدارة عبر service role
    CREATE POLICY "admins_all_rider_notifications" ON public.rider_notifications
      FOR ALL USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- ── visual_workflows: restrict to admins (was: any authenticated) ────────────
DROP POLICY IF EXISTS "admin_manage_workflows" ON public.visual_workflows;
CREATE POLICY "admin_manage_workflows" ON public.visual_workflows
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin_view_executions" ON public.workflow_executions;
CREATE POLICY "admin_view_executions" ON public.workflow_executions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin_view_step_logs" ON public.workflow_step_logs;
CREATE POLICY "admin_view_step_logs" ON public.workflow_step_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
