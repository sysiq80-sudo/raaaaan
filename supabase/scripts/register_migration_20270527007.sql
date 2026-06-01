INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '20270527007000',
  'fix_debt_limit_in_wallet_transaction',
  ARRAY[
    'CREATE OR REPLACE FUNCTION public.create_wallet_transaction(...)',
    'CREATE OR REPLACE FUNCTION public.deduct_driver_commission(...)'
  ]
)
ON CONFLICT (version) DO NOTHING;
