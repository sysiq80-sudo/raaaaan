-- ران: جدول تنبيهات الاحتيال
-- Fraud Alerts Table

CREATE TABLE IF NOT EXISTS public.fraud_alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  user_id text NOT NULL,
  user_type text NOT NULL DEFAULT 'rider' CHECK (user_type IN ('rider', 'driver')),
  description text NOT NULL,
  details jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  reviewed_by uuid REFERENCES auth.users(id),
  review_notes text,
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status ON public.fraud_alerts(status);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_severity ON public.fraud_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_user ON public.fraud_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_created ON public.fraud_alerts(created_at DESC);

-- RLS
ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_full_access_fraud_alerts" ON public.fraud_alerts
  FOR ALL
  USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
  );

-- صلاحيات
GRANT SELECT, INSERT, UPDATE ON public.fraud_alerts TO authenticated;
GRANT INSERT ON public.fraud_alerts TO service_role;
