-- One-time DDL helper. Run ONCE in Supabase SQL Editor.
-- Will be DROPPED after Phase 1 along with _audit_exec_sql.

DROP FUNCTION IF EXISTS public._audit_exec_ddl(text);

CREATE FUNCTION public._audit_exec_ddl(stmt text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  EXECUTE stmt;
  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'state', SQLSTATE);
END;
$func$;

REVOKE ALL ON FUNCTION public._audit_exec_ddl(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._audit_exec_ddl(text) TO service_role;

SELECT public._audit_exec_ddl('SELECT 1');
