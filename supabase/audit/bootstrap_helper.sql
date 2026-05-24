-- One-time bootstrap helper. Run ONCE in Supabase SQL Editor.
-- Simplified version: returns SETOF jsonb directly via dynamic query, no EXECUTE INTO.

DROP FUNCTION IF EXISTS public._audit_exec_sql(text);

CREATE FUNCTION public._audit_exec_sql(q text)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  RETURN QUERY EXECUTE format('SELECT to_jsonb(t) FROM (%s) t', q);
END;
$func$;

REVOKE ALL ON FUNCTION public._audit_exec_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._audit_exec_sql(text) TO service_role;

-- Quick test (should return one row {"x": 1}):
SELECT public._audit_exec_sql('SELECT 1 AS x');

-- After Phase 1 finishes, drop it:
-- DROP FUNCTION IF EXISTS public._audit_exec_sql(text);
