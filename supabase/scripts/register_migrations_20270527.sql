INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES
  ('20270527004000', 'remove_dual_writes_fix_trigger_payload', ARRAY['CREATE OR REPLACE FUNCTION public.captain_compensation_shield_trigger()', 'CREATE OR REPLACE FUNCTION public.handle_driver_cancellation()', 'CREATE OR REPLACE FUNCTION public.handle_rider_cancellation_penalty()']),
  ('20270527005000', 'migrate_incentives_and_commission', ARRAY['CREATE OR REPLACE FUNCTION public.check_and_grant_incentives(UUID)', 'CREATE OR REPLACE FUNCTION public.deduct_driver_commission(UUID, INTEGER, UUID)']),
  ('20270527006000', 'drop_orphaned_add_cancellation_compensation', ARRAY['DROP FUNCTION IF EXISTS public.add_cancellation_compensation()'])
ON CONFLICT (version) DO NOTHING;
