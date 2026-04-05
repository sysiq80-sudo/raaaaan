-- ARCHIVED: لا تُشغَّل على الإنتاج — كان ضمن migrations ويمنع db push الآمن.
-- لاستخدامه يدوياً في بيئة تطوير فقط: انسخ المحتوى إلى SQL Editor.

-- Requested destructive operation: delete all auth users.
-- This block detaches FK references and deletes all users.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      format('%I.%I', n.nspname, c.relname) AS tbl,
      a.attname AS col,
      a.attnotnull AS is_not_null
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN unnest(con.conkey) WITH ORDINALITY ck(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ck.attnum
    WHERE con.contype = 'f'
      AND con.confrelid = 'auth.users'::regclass
  LOOP
    IF r.is_not_null THEN
      EXECUTE format(
        'DELETE FROM %s WHERE %I IN (SELECT id FROM auth.users)',
        r.tbl, r.col
      );
    ELSE
      EXECUTE format(
        'UPDATE %s SET %I = NULL WHERE %I IN (SELECT id FROM auth.users)',
        r.tbl, r.col, r.col
      );
    END IF;
  END LOOP;

  DELETE FROM auth.users;
END $$;
