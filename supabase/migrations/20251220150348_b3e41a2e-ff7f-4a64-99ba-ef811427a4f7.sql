-- جدول مستويات المكافآت
CREATE TABLE public.driver_incentives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  rides_required INTEGER NOT NULL,
  bonus_amount INTEGER NOT NULL,
  period TEXT NOT NULL DEFAULT 'daily', -- daily, weekly, monthly
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- جدول سجل المكافآت الممنوحة
CREATE TABLE public.driver_incentive_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  incentive_id UUID NOT NULL REFERENCES public.driver_incentives(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  rides_completed INTEGER NOT NULL,
  bonus_earned INTEGER NOT NULL,
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(driver_id, incentive_id, period_start)
);

-- تفعيل RLS
ALTER TABLE public.driver_incentives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_incentive_claims ENABLE ROW LEVEL SECURITY;

-- سياسات driver_incentives
CREATE POLICY "Anyone can view active incentives" ON public.driver_incentives
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage incentives" ON public.driver_incentives
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- سياسات driver_incentive_claims
CREATE POLICY "Drivers can view their own claims" ON public.driver_incentive_claims
  FOR SELECT USING (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all claims" ON public.driver_incentive_claims
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert claims" ON public.driver_incentive_claims
  FOR INSERT WITH CHECK (true);

-- إضافة بيانات افتراضية للمكافآت
INSERT INTO public.driver_incentives (name, description, rides_required, bonus_amount, period) VALUES
  ('مكافأة يومية برونزية', 'أكمل 5 رحلات يومياً', 5, 2000, 'daily'),
  ('مكافأة يومية فضية', 'أكمل 10 رحلات يومياً', 10, 5000, 'daily'),
  ('مكافأة يومية ذهبية', 'أكمل 15 رحلة يومياً', 15, 10000, 'daily'),
  ('مكافأة أسبوعية', 'أكمل 50 رحلة أسبوعياً', 50, 25000, 'weekly'),
  ('مكافأة شهرية', 'أكمل 200 رحلة شهرياً', 200, 100000, 'monthly');

-- Trigger لتحديث updated_at
CREATE TRIGGER update_driver_incentives_updated_at
  BEFORE UPDATE ON public.driver_incentives
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();