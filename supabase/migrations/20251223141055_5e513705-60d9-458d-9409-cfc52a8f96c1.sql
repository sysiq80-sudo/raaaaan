-- Create vehicle_types table
CREATE TABLE public.vehicle_types (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🚗',
  description_ar TEXT,
  description_en TEXT,
  multiplier NUMERIC NOT NULL DEFAULT 1.0,
  min_fare INTEGER NOT NULL DEFAULT 2000,
  commission_rate NUMERIC NOT NULL DEFAULT 15,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active vehicle types"
ON public.vehicle_types FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage vehicle types"
ON public.vehicle_types FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default vehicle types with commission rates
INSERT INTO public.vehicle_types (id, name_ar, name_en, icon, description_ar, description_en, multiplier, min_fare, commission_rate, sort_order)
VALUES 
  ('economy', 'اقتصادي', 'Economy', '🚗', 'رحلات يومية بأسعار معقولة', 'Affordable everyday rides', 1.0, 2000, 15, 1),
  ('comfort', 'مريح', 'Comfort', '🚙', 'سيارات أكثر راحة ومساحة', 'More comfortable and spacious cars', 1.3, 3000, 18, 2),
  ('premium', 'فاخر', 'Premium', '🚘', 'سيارات فاخرة لتجربة مميزة', 'Luxury cars for a premium experience', 1.8, 5000, 20, 3),
  ('women_only', 'نسائي', 'Women Only', '👩', 'رحلات آمنة للنساء فقط', 'Safe rides for women only', 1.2, 2500, 15, 4);

-- Create trigger for updated_at
CREATE TRIGGER update_vehicle_types_updated_at
BEFORE UPDATE ON public.vehicle_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update add_ride_earning function to use vehicle type commission
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
  v_min_commission INTEGER;
  v_settings JSONB;
BEGIN
  -- When ride is completed
  IF NEW.status = 'completed' 
     AND NEW.driver_id IS NOT NULL
     AND (OLD.status IS DISTINCT FROM 'completed' OR OLD IS NULL) THEN
    
    -- Get commission rate from vehicle_types table
    SELECT commission_rate INTO v_commission_rate
    FROM vehicle_types
    WHERE id = COALESCE(NEW.vehicle_type::TEXT, 'economy');
    
    -- If not found, fall back to app_settings
    IF v_commission_rate IS NULL THEN
      SELECT value INTO v_settings
      FROM app_settings
      WHERE key = 'commission';
      
      v_commission_rate := COALESCE((v_settings->>'rate')::NUMERIC, 15);
    END IF;
    
    -- Get min commission from settings
    SELECT value INTO v_settings
    FROM app_settings
    WHERE key = 'commission';
    
    v_min_commission := COALESCE((v_settings->>'min_amount')::INTEGER, 500);
    
    v_total_fare := COALESCE(NEW.final_fare, NEW.estimated_fare, 0);
    v_commission_amount := ROUND(v_total_fare * v_commission_rate / 100);
    
    -- Apply minimum commission if set
    IF v_commission_amount < v_min_commission THEN
      v_commission_amount := v_min_commission;
    END IF;
    
    v_driver_share := v_total_fare - v_commission_amount;
    
    -- Add driver's share to wallet
    INSERT INTO driver_wallet_transactions (driver_id, amount, type, description, ride_id)
    VALUES (
      NEW.driver_id,
      v_driver_share,
      'ride_earning',
      'حصة السائق من رحلة مكتملة (بعد خصم العمولة ' || v_commission_rate || '%)',
      NEW.id
    );
    
    -- Record company earnings
    INSERT INTO company_earnings (ride_id, driver_id, total_fare, commission_rate, commission_amount, driver_share)
    VALUES (
      NEW.id,
      NEW.driver_id,
      v_total_fare,
      v_commission_rate / 100,
      v_commission_amount,
      v_driver_share
    );
    
  END IF;
  
  RETURN NEW;
END;
$function$;