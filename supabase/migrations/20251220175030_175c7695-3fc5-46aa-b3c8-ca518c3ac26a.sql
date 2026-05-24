-- Prevent drivers from self-approving (manual admin approval only)

-- Function: enforce driver approval workflow & protect privileged fields
CREATE OR REPLACE FUNCTION public.enforce_driver_approval_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_new_status driver_status;
BEGIN
  v_is_admin := public.has_role(auth.uid(), 'admin'::app_role);
  v_new_status := COALESCE(NEW.status, 'pending'::driver_status);

  -- If driver is not approved, force offline/ unavailable (applies to everyone)
  IF v_new_status <> 'approved'::driver_status THEN
    NEW.is_online := false;
    NEW.is_available := false;
  END IF;

  -- Lock down privileged fields for non-admin users
  IF NOT v_is_admin THEN
    IF TG_OP = 'INSERT' THEN
      -- Always start as pending; admin must approve manually
      NEW.status := 'pending'::driver_status;

      -- Drivers must not control admin flags at creation
      NEW.admin_controlled := COALESCE(NEW.admin_controlled, false);
      NEW.admin_activated := COALESCE(NEW.admin_activated, true);

      RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'Not allowed to change driver status';
      END IF;

      IF NEW.admin_controlled IS DISTINCT FROM OLD.admin_controlled THEN
        RAISE EXCEPTION 'Not allowed to change admin_controlled';
      END IF;

      IF NEW.admin_activated IS DISTINCT FROM OLD.admin_activated THEN
        RAISE EXCEPTION 'Not allowed to change admin_activated';
      END IF;

      RETURN NEW;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger
DROP TRIGGER IF EXISTS enforce_driver_approval_workflow ON public.drivers;
CREATE TRIGGER enforce_driver_approval_workflow
BEFORE INSERT OR UPDATE ON public.drivers
FOR EACH ROW
EXECUTE FUNCTION public.enforce_driver_approval_workflow();
