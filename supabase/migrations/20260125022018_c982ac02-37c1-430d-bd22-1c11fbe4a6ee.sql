-- Add a safe phone existence check that works even when profiles RLS blocks anon SELECT
-- Returns only a boolean to avoid leaking PII.

CREATE OR REPLACE FUNCTION public.is_phone_registered(p_phone text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_in_clean text;
  v_without_964 text;
  v_with_zero text;
  v_without_zero text;
  v_formats text[];
  v_exists boolean;
BEGIN
  IF p_phone IS NULL OR length(trim(p_phone)) < 5 THEN
    RETURN false;
  END IF;

  -- Normalize input to digits only
  v_in_clean := regexp_replace(p_phone, '\D', '', 'g');

  -- Strip leading country code if present
  IF v_in_clean LIKE '964%' THEN
    v_without_964 := substring(v_in_clean from 4);
  ELSE
    v_without_964 := v_in_clean;
  END IF;

  -- Build common Iraqi formats
  IF v_without_964 LIKE '0%' THEN
    v_with_zero := v_without_964;
    v_without_zero := substring(v_without_964 from 2);
  ELSE
    v_without_zero := v_without_964;
    v_with_zero := '0' || v_without_964;
  END IF;

  v_formats := ARRAY[
    v_in_clean,
    v_without_964,
    v_with_zero,
    v_without_zero,
    '964' || v_without_zero
  ];

  -- Check riders (profiles)
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.phone IS NOT NULL
      AND (
        regexp_replace(p.phone, '\D', '', 'g') = ANY (v_formats)
        OR regexp_replace(p.phone, '\D', '', 'g') LIKE '%' || v_without_zero
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.phone IS NOT NULL
      AND (
        regexp_replace(d.phone, '\D', '', 'g') = ANY (v_formats)
        OR regexp_replace(d.phone, '\D', '', 'g') LIKE '%' || v_without_zero
      )
  )
  INTO v_exists;

  RETURN COALESCE(v_exists, false);
END;
$$;

-- Lock down who can call it (still allow anon+authenticated for auth UX)
REVOKE ALL ON FUNCTION public.is_phone_registered(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_phone_registered(text) TO anon;
GRANT EXECUTE ON FUNCTION public.is_phone_registered(text) TO authenticated;
