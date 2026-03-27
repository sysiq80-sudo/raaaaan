-- Insert commission settings if not exists
INSERT INTO app_settings (key, value, description)
VALUES (
  'commission',
  '{"rate": 15, "min_amount": 500}'::jsonb,
  'إعدادات عمولة الشركة على الرحلات'
)
ON CONFLICT (key) DO NOTHING;

-- Update the add_ride_earning function to read commission rate from settings
CREATE OR REPLACE FUNCTION public.add_ride_earning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_fare INTEGER;
  v_commission_rate NUMERIC;
  v_commission_amount INTEGER;
  v_driver_share INTEGER;
  v_settings JSONB;
BEGIN
  -- When ride is completed
  IF NEW.status = 'completed' 
     AND NEW.driver_id IS NOT NULL
     AND (OLD.status IS DISTINCT FROM 'completed' OR OLD IS NULL) THEN
    
    -- Get commission rate from settings (default 15%)
    SELECT value INTO v_settings
    FROM app_settings
    WHERE key = 'commission';
    
    v_commission_rate := COALESCE((v_settings->>'rate')::NUMERIC, 15) / 100;
    
    v_total_fare := COALESCE(NEW.final_fare, NEW.estimated_fare, 0);
    v_commission_amount := ROUND(v_total_fare * v_commission_rate);
    v_driver_share := v_total_fare - v_commission_amount;
    
    -- Add driver's share to wallet
    INSERT INTO driver_wallet_transactions (driver_id, amount, type, description, ride_id)
    VALUES (
      NEW.driver_id,
      v_driver_share,
      'ride_earning',
      'حصة السائق من رحلة مكتملة (بعد خصم العمولة ' || ROUND(v_commission_rate * 100) || '%)',
      NEW.id
    );
    
    -- Record company earnings
    INSERT INTO company_earnings (ride_id, driver_id, total_fare, commission_rate, commission_amount, driver_share)
    VALUES (
      NEW.id,
      NEW.driver_id,
      v_total_fare,
      v_commission_rate,
      v_commission_amount,
      v_driver_share
    );
    
  END IF;
  
  RETURN NEW;
END;
$function$;