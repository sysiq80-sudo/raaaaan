-- RPC function to detect ghost accounts (created by WhatsApp/Telegram bots)
-- Returns true if the given phone belongs to a ghost account
-- Used by Auth.tsx to redirect ghost users to the activation flow instead of login

CREATE OR REPLACE FUNCTION public.check_ghost_account(p_phone text)
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
  v_is_ghost boolean;
BEGIN
  IF p_phone IS NULL OR length(trim(p_phone)) < 5 THEN
    RETURN false;
  END IF;

  -- Normalize input to digits only
  v_in_clean := regexp_replace(p_phone, '\D', '', 'g');

  -- Strip leading country code
  IF v_in_clean LIKE '964%' THEN
    v_without_964 := substring(v_in_clean from 4);
  ELSE
    v_without_964 := v_in_clean;
  END IF;

  -- Build common Iraqi phone formats
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
    '964' || v_without_zero,
    '+964' || v_without_zero
  ];

  -- Check if a ghost account exists for this phone
  -- Joins profiles (phone field) with auth.users (metadata ghost flag)
  -- Also checks email pattern (phone@raan.app) and metadata phone field
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE (u.raw_user_meta_data->>'is_ghost_account')::boolean = true
      AND (
        -- Match by profile phone
        (p.phone IS NOT NULL AND (
          regexp_replace(p.phone, '\D', '', 'g') = ANY (v_formats)
          OR regexp_replace(p.phone, '\D', '', 'g') LIKE '%' || v_without_zero
        ))
        -- Match by email pattern (phone@raan.app)
        OR u.email = ANY (
          ARRAY[
            v_in_clean || '@raan.app',
            v_without_964 || '@raan.app',
            v_with_zero || '@raan.app',
            v_without_zero || '@raan.app',
            '964' || v_without_zero || '@raan.app'
          ]
        )
        -- Match by metadata phone
        OR regexp_replace(COALESCE(u.raw_user_meta_data->>'phone', ''), '\D', '', 'g') = ANY(v_formats)
      )
  )
  INTO v_is_ghost;

  RETURN COALESCE(v_is_ghost, false);
END;
$$;

-- Allow anon and authenticated to call this (needed for auth UX before login)
REVOKE ALL ON FUNCTION public.check_ghost_account(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_ghost_account(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_ghost_account(text) TO authenticated;
