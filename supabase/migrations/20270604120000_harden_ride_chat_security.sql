-- Harden ride chat delivery and data isolation.
--
-- Goals:
-- 1. A rider cannot spoof sender_type = 'driver', and a driver cannot spoof 'rider'.
-- 2. Only real ride participants can read or send messages for active rides.
-- 3. Authenticated users can only mark received messages as read, not edit message text.
-- 4. Bot relay is internal-only and uses x-internal-secret from Vault instead of hardcoded Bearer tokens.

ALTER TABLE public.ride_messages ENABLE ROW LEVEL SECURITY;

-- Tighten table privileges. Clients send through send_ride_message(); no direct INSERT.
REVOKE DELETE ON public.ride_messages FROM authenticated;
REVOKE INSERT ON public.ride_messages FROM authenticated;
REVOKE UPDATE ON public.ride_messages FROM authenticated;
GRANT SELECT ON public.ride_messages TO authenticated;
GRANT UPDATE (is_read) ON public.ride_messages TO authenticated;

DROP POLICY IF EXISTS "Ride participants can view messages" ON public.ride_messages;
DROP POLICY IF EXISTS "ride_messages_select_participants" ON public.ride_messages;
CREATE POLICY "ride_messages_select_participants"
  ON public.ride_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.rides r
      WHERE r.id = ride_messages.ride_id
        AND (
          r.rider_id = auth.uid()
          OR r.driver_id IN (
            SELECT d.id
            FROM public.drivers d
            WHERE d.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Admins can view all messages" ON public.ride_messages;
DROP POLICY IF EXISTS "ride_messages_admin_select" ON public.ride_messages;
CREATE POLICY "ride_messages_admin_select"
  ON public.ride_messages
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_or_moderator()
  );

DROP POLICY IF EXISTS "Ride participants can send messages" ON public.ride_messages;
DROP POLICY IF EXISTS "ride_messages_insert_participant_role_locked" ON public.ride_messages;
DROP POLICY IF EXISTS "ride_messages_no_direct_client_insert" ON public.ride_messages;
CREATE POLICY "ride_messages_no_direct_client_insert"
  ON public.ride_messages
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Recipients can mark as read" ON public.ride_messages;
DROP POLICY IF EXISTS "ride_messages_recipient_mark_read" ON public.ride_messages;
CREATE POLICY "ride_messages_recipient_mark_read"
  ON public.ride_messages
  FOR UPDATE
  USING (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.rides r
      WHERE r.id = ride_messages.ride_id
        AND (
          r.rider_id = auth.uid()
          OR r.driver_id IN (
            SELECT d.id
            FROM public.drivers d
            WHERE d.user_id = auth.uid()
          )
        )
    )
  )
  WITH CHECK (
    is_read = true
    AND sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.rides r
      WHERE r.id = ride_messages.ride_id
        AND (
          r.rider_id = auth.uid()
          OR r.driver_id IN (
            SELECT d.id
            FROM public.drivers d
            WHERE d.user_id = auth.uid()
          )
        )
    )
  );

CREATE OR REPLACE FUNCTION public.send_ride_message(
    p_ride_id UUID,
    p_message TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_sender_type TEXT;
    v_message TEXT;
    v_ride RECORD;
    v_message_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'غير مسجل الدخول');
    END IF;

    v_message := trim(COALESCE(p_message, ''));
    IF length(v_message) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'لا يمكن إرسال رسالة فارغة');
    END IF;
    IF length(v_message) > 1000 THEN
        RETURN jsonb_build_object('success', false, 'error', 'الرسالة طويلة جداً');
    END IF;

    SELECT id, rider_id, driver_id, status
    INTO v_ride
    FROM public.rides
    WHERE id = p_ride_id;

    IF v_ride IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'الرحلة غير موجودة');
    END IF;

    IF v_ride.status NOT IN ('accepted', 'arrived', 'in_progress') THEN
        RETURN jsonb_build_object('success', false, 'error', 'لا يمكن إرسال رسائل في هذه المرحلة');
    END IF;

    IF v_ride.rider_id = v_user_id THEN
        v_sender_type := 'rider';
    ELSIF EXISTS (
        SELECT 1
        FROM public.drivers d
        WHERE d.id = v_ride.driver_id
          AND d.user_id = v_user_id
    ) THEN
        v_sender_type := 'driver';
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'ليس لديك صلاحية لهذه الرحلة');
    END IF;

    INSERT INTO public.ride_messages (ride_id, sender_id, sender_type, message)
    VALUES (p_ride_id, v_user_id, v_sender_type, v_message)
    RETURNING id INTO v_message_id;

    RETURN jsonb_build_object(
        'success', true,
        'message_id', v_message_id,
        'sender_type', v_sender_type
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_messages_as_read(p_ride_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_count INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN 0;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.rides r
      WHERE r.id = p_ride_id
        AND (
          r.rider_id = v_user_id
          OR r.driver_id IN (
            SELECT d.id
            FROM public.drivers d
            WHERE d.user_id = v_user_id
          )
        )
    ) THEN
      RETURN 0;
    END IF;

    UPDATE public.ride_messages
    SET is_read = true
    WHERE ride_id = p_ride_id
      AND sender_id <> v_user_id
      AND is_read = false;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.relay_ride_message_to_bot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'private'
AS $$
DECLARE
  v_ride RECORD;
  v_secret text;
  request_id BIGINT;
BEGIN
  IF NEW.sender_type <> 'driver' THEN
    RETURN NEW;
  END IF;

  SELECT id, trip_type, rider_id, driver_id, status
  INTO v_ride
  FROM public.rides
  WHERE id = NEW.ride_id;

  IF v_ride IS NULL
     OR v_ride.trip_type NOT IN ('whatsapp', 'telegram')
     OR v_ride.status NOT IN ('accepted', 'arrived', 'in_progress')
  THEN
    RETURN NEW;
  END IF;

  v_secret := private.get_internal_edge_secret();
  IF v_secret IS NULL THEN
    RAISE LOG '[RelayChatMessage] internal_edge_secret not found; relay skipped for ride %', NEW.ride_id;
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/relay-chat-message',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', v_secret
    ),
    body := jsonb_build_object(
      'ride_id',     NEW.ride_id,
      'message',     NEW.message,
      'sender_type', NEW.sender_type,
      'platform',    v_ride.trip_type,
      'rider_id',    v_ride.rider_id
    )
  ) INTO request_id;

  RAISE LOG '[RelayChatMessage] Driver message relayed for ride % (platform=%): request_id=%',
    NEW.ride_id, v_ride.trip_type, request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG '[RelayChatMessage] relay failed for ride %: %', NEW.ride_id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS relay_ride_message_trigger ON public.ride_messages;
CREATE TRIGGER relay_ride_message_trigger
  AFTER INSERT ON public.ride_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.relay_ride_message_to_bot();

GRANT EXECUTE ON FUNCTION public.send_ride_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_messages_as_read(UUID) TO authenticated;

COMMENT ON FUNCTION public.send_ride_message(UUID, TEXT) IS
'Secure ride chat send function. It derives sender_type from the authenticated participant instead of trusting the client.';
COMMENT ON FUNCTION public.mark_messages_as_read(UUID) IS
'Marks only received messages for a ride participant as read.';
COMMENT ON FUNCTION public.relay_ride_message_to_bot() IS
'Internal-only bot relay trigger; calls Edge Function with x-internal-secret from Vault.';
