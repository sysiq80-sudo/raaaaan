-- Create company_earnings table to track commission from rides
CREATE TABLE public.company_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id UUID REFERENCES public.rides(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  total_fare INTEGER NOT NULL,
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.15,
  commission_amount INTEGER NOT NULL,
  driver_share INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Enable RLS
ALTER TABLE public.company_earnings ENABLE ROW LEVEL SECURITY;

-- Only admins can view company earnings
CREATE POLICY "Admins can view company earnings"
ON public.company_earnings
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert earnings
CREATE POLICY "System can insert earnings"
ON public.company_earnings
FOR INSERT
WITH CHECK (true);

-- Create index for faster date queries
CREATE INDEX idx_company_earnings_date ON public.company_earnings(date);
CREATE INDEX idx_company_earnings_driver ON public.company_earnings(driver_id);

-- Create view for daily stats
CREATE OR REPLACE VIEW public.company_earnings_daily_stats AS
SELECT 
  date,
  COUNT(*) as total_rides,
  SUM(total_fare) as total_fares,
  SUM(commission_amount) as total_commission,
  SUM(driver_share) as total_driver_share,
  ROUND(AVG(commission_rate) * 100, 2) as avg_commission_rate
FROM public.company_earnings
GROUP BY date
ORDER BY date DESC;

-- Update the add_ride_earning function to also record company earnings
CREATE OR REPLACE FUNCTION public.add_ride_earning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_fare INTEGER;
  v_commission_rate NUMERIC := 0.15;
  v_commission_amount INTEGER;
  v_driver_share INTEGER;
BEGIN
  -- When ride is completed
  IF NEW.status = 'completed' 
     AND NEW.driver_id IS NOT NULL
     AND (OLD.status IS DISTINCT FROM 'completed' OR OLD IS NULL) THEN
    
    v_total_fare := COALESCE(NEW.final_fare, NEW.estimated_fare, 0);
    v_commission_amount := ROUND(v_total_fare * v_commission_rate);
    v_driver_share := v_total_fare - v_commission_amount;
    
    -- Add driver's share to wallet
    INSERT INTO driver_wallet_transactions (driver_id, amount, type, description, ride_id)
    VALUES (
      NEW.driver_id,
      v_driver_share,
      'ride_earning',
      'حصة السائق من رحلة مكتملة (بعد خصم العمولة)',
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