-- إنشاء جدول معاملات محفظة السائق
CREATE TABLE public.driver_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ride_earning', 'cancellation_compensation', 'bonus', 'withdrawal', 'adjustment')),
  description TEXT,
  ride_id UUID REFERENCES public.rides(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- إنشاء فهرس للبحث السريع
CREATE INDEX idx_driver_wallet_driver_id ON public.driver_wallet_transactions(driver_id);
CREATE INDEX idx_driver_wallet_created_at ON public.driver_wallet_transactions(created_at DESC);

-- تفعيل RLS
ALTER TABLE public.driver_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان
CREATE POLICY "Drivers can view their own transactions"
ON public.driver_wallet_transactions
FOR SELECT
USING (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all transactions"
ON public.driver_wallet_transactions
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert transactions"
ON public.driver_wallet_transactions
FOR INSERT
WITH CHECK (true);

-- دالة لحساب رصيد السائق
CREATE OR REPLACE FUNCTION public.get_driver_wallet_balance(p_driver_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE WHEN type IN ('ride_earning', 'cancellation_compensation', 'bonus', 'adjustment') THEN amount
         WHEN type = 'withdrawal' THEN -amount
         ELSE 0
    END
  ), 0)::INTEGER
  FROM driver_wallet_transactions
  WHERE driver_id = p_driver_id
$$;

-- تريجر لإضافة تعويض الإلغاء تلقائياً للمحفظة
CREATE OR REPLACE FUNCTION public.add_cancellation_compensation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- عند إلغاء الرحلة من العميل مع غرامة
  IF NEW.status = 'cancelled' 
     AND NEW.cancelled_by = 'rider' 
     AND NEW.cancellation_fee > 0 
     AND NEW.driver_id IS NOT NULL
     AND (OLD.status IS DISTINCT FROM 'cancelled' OR OLD IS NULL) THEN
    
    INSERT INTO driver_wallet_transactions (driver_id, amount, type, description, ride_id)
    VALUES (
      NEW.driver_id,
      NEW.cancellation_fee,
      'cancellation_compensation',
      'تعويض إلغاء رحلة من العميل',
      NEW.id
    );
    
    RAISE LOG 'Added cancellation compensation % for driver %', NEW.cancellation_fee, NEW.driver_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء التريجر
DROP TRIGGER IF EXISTS add_cancellation_compensation_trigger ON rides;
CREATE TRIGGER add_cancellation_compensation_trigger
AFTER UPDATE ON rides
FOR EACH ROW
EXECUTE FUNCTION add_cancellation_compensation();

-- تريجر لإضافة أرباح الرحلة عند اكتمالها
CREATE OR REPLACE FUNCTION public.add_ride_earning()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- عند اكتمال الرحلة
  IF NEW.status = 'completed' 
     AND NEW.driver_id IS NOT NULL
     AND (OLD.status IS DISTINCT FROM 'completed' OR OLD IS NULL) THEN
    
    INSERT INTO driver_wallet_transactions (driver_id, amount, type, description, ride_id)
    VALUES (
      NEW.driver_id,
      COALESCE(NEW.final_fare, NEW.estimated_fare, 0),
      'ride_earning',
      'أجرة رحلة مكتملة',
      NEW.id
    );
    
    RAISE LOG 'Added ride earning % for driver %', COALESCE(NEW.final_fare, NEW.estimated_fare, 0), NEW.driver_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء التريجر
DROP TRIGGER IF EXISTS add_ride_earning_trigger ON rides;
CREATE TRIGGER add_ride_earning_trigger
AFTER UPDATE ON rides
FOR EACH ROW
EXECUTE FUNCTION add_ride_earning();