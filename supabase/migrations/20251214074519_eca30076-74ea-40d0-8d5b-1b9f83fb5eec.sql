
-- Create function to update driver statistics when a ride is completed
CREATE OR REPLACE FUNCTION public.update_driver_stats_on_ride_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ride_earnings INTEGER;
  current_driver_id UUID;
BEGIN
  -- Only trigger when status changes to 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.driver_id IS NOT NULL THEN
    current_driver_id := NEW.driver_id;
    ride_earnings := COALESCE(NEW.final_fare, NEW.estimated_fare, 0);
    
    -- Update driver's total_rides and total_earnings
    UPDATE drivers
    SET 
      total_rides = COALESCE(total_rides, 0) + 1,
      total_earnings = COALESCE(total_earnings, 0) + ride_earnings,
      is_available = true,
      updated_at = now()
    WHERE id = current_driver_id;
    
    RAISE LOG 'Updated driver % stats: +1 ride, +% earnings', current_driver_id, ride_earnings;
  END IF;
  
  -- Update driver availability when ride status changes
  IF NEW.status IN ('accepted', 'arrived', 'in_progress') AND NEW.driver_id IS NOT NULL THEN
    UPDATE drivers
    SET is_available = false, updated_at = now()
    WHERE id = NEW.driver_id;
  END IF;
  
  -- Make driver available again if ride is cancelled
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' AND OLD.driver_id IS NOT NULL THEN
    UPDATE drivers
    SET is_available = true, updated_at = now()
    WHERE id = OLD.driver_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for updating driver stats
DROP TRIGGER IF EXISTS on_ride_status_change ON rides;
CREATE TRIGGER on_ride_status_change
  AFTER UPDATE ON rides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_driver_stats_on_ride_complete();

-- Create function to update driver average rating
CREATE OR REPLACE FUNCTION public.update_driver_rating_average()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_rating NUMERIC;
  driver_uuid UUID;
BEGIN
  driver_uuid := NEW.driver_id;
  
  IF driver_uuid IS NOT NULL THEN
    -- Calculate average rating from all completed rides
    SELECT ROUND(AVG(driver_rating)::numeric, 1)
    INTO avg_rating
    FROM rides
    WHERE driver_id = driver_uuid
      AND status = 'completed'
      AND driver_rating IS NOT NULL;
    
    -- Update driver's rating
    IF avg_rating IS NOT NULL THEN
      UPDATE drivers
      SET rating = avg_rating, updated_at = now()
      WHERE id = driver_uuid;
      
      RAISE LOG 'Updated driver % average rating to %', driver_uuid, avg_rating;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for updating driver rating
DROP TRIGGER IF EXISTS on_ride_rating_update ON rides;
CREATE TRIGGER on_ride_rating_update
  AFTER UPDATE OF driver_rating ON rides
  FOR EACH ROW
  WHEN (NEW.driver_rating IS NOT NULL AND NEW.driver_rating != COALESCE(OLD.driver_rating, 0))
  EXECUTE FUNCTION public.update_driver_rating_average();

-- Fix existing completed ride that wasn't counted
UPDATE drivers d
SET 
  total_rides = (
    SELECT COUNT(*) 
    FROM rides r 
    WHERE r.driver_id = d.id AND r.status = 'completed'
  ),
  total_earnings = (
    SELECT COALESCE(SUM(COALESCE(final_fare, estimated_fare, 0)), 0)
    FROM rides r 
    WHERE r.driver_id = d.id AND r.status = 'completed'
  )
WHERE EXISTS (
  SELECT 1 FROM rides r WHERE r.driver_id = d.id AND r.status = 'completed'
);
