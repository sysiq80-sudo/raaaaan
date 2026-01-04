-- دالة للتحقق ومنح المكافآت للسائق
CREATE OR REPLACE FUNCTION public.check_and_grant_incentives(p_driver_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incentive RECORD;
  v_rides_count INTEGER;
  v_period_start DATE;
  v_period_end DATE;
  v_already_claimed BOOLEAN;
BEGIN
  -- المرور على جميع الحوافز النشطة
  FOR v_incentive IN 
    SELECT * FROM driver_incentives WHERE is_active = true
  LOOP
    -- تحديد فترة الحافز
    CASE v_incentive.period
      WHEN 'daily' THEN
        v_period_start := CURRENT_DATE;
        v_period_end := CURRENT_DATE;
      WHEN 'weekly' THEN
        v_period_start := date_trunc('week', CURRENT_DATE)::DATE;
        v_period_end := (date_trunc('week', CURRENT_DATE) + interval '6 days')::DATE;
      WHEN 'monthly' THEN
        v_period_start := date_trunc('month', CURRENT_DATE)::DATE;
        v_period_end := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::DATE;
    END CASE;
    
    -- التحقق من عدم وجود مطالبة سابقة لهذه الفترة
    SELECT EXISTS (
      SELECT 1 FROM driver_incentive_claims 
      WHERE driver_id = p_driver_id 
        AND incentive_id = v_incentive.id 
        AND period_start = v_period_start
    ) INTO v_already_claimed;
    
    IF NOT v_already_claimed THEN
      -- حساب عدد الرحلات المكتملة في هذه الفترة
      SELECT COUNT(*) INTO v_rides_count
      FROM rides
      WHERE driver_id = p_driver_id
        AND status = 'completed'
        AND completed_at::DATE >= v_period_start
        AND completed_at::DATE <= v_period_end;
      
      -- إذا وصل للعدد المطلوب، منح المكافأة
      IF v_rides_count >= v_incentive.rides_required THEN
        -- إضافة سجل المطالبة
        INSERT INTO driver_incentive_claims (
          driver_id, incentive_id, period_start, period_end, 
          rides_completed, bonus_earned
        ) VALUES (
          p_driver_id, v_incentive.id, v_period_start, v_period_end,
          v_rides_count, v_incentive.bonus_amount
        );
        
        -- إضافة المكافأة للمحفظة
        INSERT INTO driver_wallet_transactions (
          driver_id, amount, type, description
        ) VALUES (
          p_driver_id, v_incentive.bonus_amount, 'bonus',
          'مكافأة: ' || v_incentive.name
        );
        
        RAISE LOG 'Granted incentive % to driver %: % IQD', 
          v_incentive.name, p_driver_id, v_incentive.bonus_amount;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Trigger لمنح المكافآت تلقائياً عند اكتمال الرحلة
CREATE OR REPLACE FUNCTION public.trigger_check_incentives_on_ride_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- عند اكتمال الرحلة
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.driver_id IS NOT NULL THEN
    PERFORM check_and_grant_incentives(NEW.driver_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء الـ trigger
DROP TRIGGER IF EXISTS check_incentives_on_ride_complete ON rides;
CREATE TRIGGER check_incentives_on_ride_complete
  AFTER UPDATE ON rides
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_incentives_on_ride_complete();

-- دالة لجلب تقدم السائق نحو الحوافز
CREATE OR REPLACE FUNCTION public.get_driver_incentive_progress(p_driver_id UUID)
RETURNS TABLE (
  incentive_id UUID,
  name TEXT,
  description TEXT,
  period TEXT,
  rides_required INTEGER,
  bonus_amount INTEGER,
  rides_completed INTEGER,
  is_claimed BOOLEAN,
  period_start DATE,
  period_end DATE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start DATE;
  v_period_end DATE;
BEGIN
  RETURN QUERY
  SELECT 
    di.id as incentive_id,
    di.name,
    di.description,
    di.period,
    di.rides_required,
    di.bonus_amount,
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM rides r
      WHERE r.driver_id = p_driver_id
        AND r.status = 'completed'
        AND r.completed_at::DATE >= 
          CASE di.period
            WHEN 'daily' THEN CURRENT_DATE
            WHEN 'weekly' THEN date_trunc('week', CURRENT_DATE)::DATE
            WHEN 'monthly' THEN date_trunc('month', CURRENT_DATE)::DATE
          END
        AND r.completed_at::DATE <= 
          CASE di.period
            WHEN 'daily' THEN CURRENT_DATE
            WHEN 'weekly' THEN (date_trunc('week', CURRENT_DATE) + interval '6 days')::DATE
            WHEN 'monthly' THEN (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::DATE
          END
    ), 0) as rides_completed,
    EXISTS (
      SELECT 1 FROM driver_incentive_claims dic
      WHERE dic.driver_id = p_driver_id
        AND dic.incentive_id = di.id
        AND dic.period_start = 
          CASE di.period
            WHEN 'daily' THEN CURRENT_DATE
            WHEN 'weekly' THEN date_trunc('week', CURRENT_DATE)::DATE
            WHEN 'monthly' THEN date_trunc('month', CURRENT_DATE)::DATE
          END
    ) as is_claimed,
    CASE di.period
      WHEN 'daily' THEN CURRENT_DATE
      WHEN 'weekly' THEN date_trunc('week', CURRENT_DATE)::DATE
      WHEN 'monthly' THEN date_trunc('month', CURRENT_DATE)::DATE
    END as period_start,
    CASE di.period
      WHEN 'daily' THEN CURRENT_DATE
      WHEN 'weekly' THEN (date_trunc('week', CURRENT_DATE) + interval '6 days')::DATE
      WHEN 'monthly' THEN (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::DATE
    END as period_end
  FROM driver_incentives di
  WHERE di.is_active = true
  ORDER BY di.period, di.rides_required;
END;
$$;