-- ══════════════════════════════════════════════════════════════
-- 🗺️ مزامنة موقع السائق الجغرافي (PostGIS driver_locations sync)
-- ══════════════════════════════════════════════════════════════
-- الوصف: إضافة trigger لمزامنة إحداثيات السائق وحالته تلقائياً 
--       من جدول drivers إلى جدول driver_locations الجغرافي.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_driver_location_to_geospatial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.driver_locations (driver_id, location, heading, is_online, updated_at)
  VALUES (
    NEW.id,
    CASE
      WHEN NEW.current_location IS NOT NULL 
           AND NEW.current_location ? 'lat' 
           AND NEW.current_location ? 'lng'
           AND (NEW.current_location->>'lat')::DOUBLE PRECISION != 0
           AND (NEW.current_location->>'lng')::DOUBLE PRECISION != 0
      THEN ST_SetSRID(
        ST_MakePoint(
          (NEW.current_location->>'lng')::DOUBLE PRECISION,
          (NEW.current_location->>'lat')::DOUBLE PRECISION
        ),
        4326
      )::GEOGRAPHY
      ELSE NULL
    END,
    CASE 
      WHEN NEW.current_location IS NOT NULL AND NEW.current_location ? 'heading'
      THEN (NEW.current_location->>'heading')::DOUBLE PRECISION 
      ELSE NULL 
    END,
    COALESCE(NEW.is_online, false),
    now()
  )
  ON CONFLICT (driver_id) DO UPDATE
  SET
    location = EXCLUDED.location,
    heading = EXCLUDED.heading,
    is_online = EXCLUDED.is_online,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_driver_location_to_geospatial() IS
'مزامنة موقع السائق ونشاطه تلقائياً لجدول PostGIS driver_locations';

-- إنشاء الـ trigger على جدول drivers
DROP TRIGGER IF EXISTS trg_sync_driver_location_to_geospatial ON public.drivers;
CREATE TRIGGER trg_sync_driver_location_to_geospatial
AFTER INSERT OR UPDATE OF current_location, is_online
ON public.drivers
FOR EACH ROW
EXECUTE FUNCTION public.sync_driver_location_to_geospatial();
