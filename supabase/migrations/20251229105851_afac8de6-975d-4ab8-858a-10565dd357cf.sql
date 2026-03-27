-- جدول سجل الرسائل SMS
CREATE TABLE public.sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  message_type VARCHAR(50) NOT NULL, -- otp, promotional, notification
  purpose VARCHAR(50), -- rider_registration, driver_registration, login, password_reset
  provider VARCHAR(20), -- whatsapp, sms
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, sent, delivered, failed
  error_message TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  cost DECIMAL(10,4) DEFAULT 0,
  external_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- فهرس للبحث السريع
CREATE INDEX idx_sms_logs_phone ON public.sms_logs(phone);
CREATE INDEX idx_sms_logs_created_at ON public.sms_logs(created_at DESC);
CREATE INDEX idx_sms_logs_status ON public.sms_logs(status);

-- تفعيل RLS
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان
CREATE POLICY "Admins can view all SMS logs" ON public.sms_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert SMS logs" ON public.sms_logs
  FOR INSERT WITH CHECK (true);

-- جدول الأرقام المحظورة
CREATE TABLE public.blocked_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  reason TEXT,
  blocked_by UUID,
  blocked_until TIMESTAMPTZ,
  is_permanent BOOLEAN DEFAULT false,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_blocked_phones_phone ON public.blocked_phones(phone);

ALTER TABLE public.blocked_phones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage blocked phones" ON public.blocked_phones
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert blocked phones" ON public.blocked_phones
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update blocked phones" ON public.blocked_phones
  FOR UPDATE USING (true);

-- جدول Rate Limit بـ IP
CREATE TABLE public.ip_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address VARCHAR(45) NOT NULL,
  action_type VARCHAR(50) NOT NULL, -- send_otp, verify_otp, reset_password
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ip_rate_limits_ip_action ON public.ip_rate_limits(ip_address, action_type);
CREATE INDEX idx_ip_rate_limits_window ON public.ip_rate_limits(window_start);

ALTER TABLE public.ip_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view rate limits" ON public.ip_rate_limits
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can manage rate limits" ON public.ip_rate_limits
  FOR ALL USING (true) WITH CHECK (true);

-- تحديث جدول otp_verifications بإضافة أعمدة جديدة
ALTER TABLE public.otp_verifications 
  ADD COLUMN IF NOT EXISTS code_hash VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45),
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- دالة للتحقق من حظر الرقم
CREATE OR REPLACE FUNCTION public.is_phone_blocked(p_phone VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM blocked_phones
    WHERE phone = p_phone
      AND (is_permanent = true OR blocked_until > now())
  );
END;
$$;

-- دالة للتحقق من Rate Limit بـ IP
CREATE OR REPLACE FUNCTION public.check_ip_rate_limit(
  p_ip VARCHAR,
  p_action VARCHAR,
  p_max_requests INTEGER DEFAULT 50,
  p_window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  v_window_start := now() - (p_window_minutes || ' minutes')::INTERVAL;
  
  SELECT COALESCE(SUM(request_count), 0) INTO v_count
  FROM ip_rate_limits
  WHERE ip_address = p_ip
    AND action_type = p_action
    AND window_start > v_window_start;
  
  RETURN v_count < p_max_requests;
END;
$$;

-- دالة لتسجيل طلب Rate Limit
CREATE OR REPLACE FUNCTION public.record_ip_request(p_ip VARCHAR, p_action VARCHAR)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO ip_rate_limits (ip_address, action_type, request_count, window_start)
  VALUES (p_ip, p_action, 1, now());
END;
$$;

-- دالة لحظر رقم تلقائياً
CREATE OR REPLACE FUNCTION public.auto_block_phone(p_phone VARCHAR, p_reason TEXT DEFAULT 'Excessive failures')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO blocked_phones (phone, reason, blocked_until, failure_count)
  VALUES (p_phone, p_reason, now() + INTERVAL '24 hours', 1)
  ON CONFLICT (phone) DO UPDATE
  SET failure_count = blocked_phones.failure_count + 1,
      blocked_until = CASE 
        WHEN blocked_phones.failure_count >= 10 THEN now() + INTERVAL '7 days'
        WHEN blocked_phones.failure_count >= 5 THEN now() + INTERVAL '24 hours'
        ELSE now() + INTERVAL '1 hour'
      END,
      updated_at = now();
END;
$$;

-- دالة لإحصائيات SMS
CREATE OR REPLACE FUNCTION public.get_sms_stats(p_days INTEGER DEFAULT 30)
RETURNS TABLE(
  total_sent BIGINT,
  total_delivered BIGINT,
  total_failed BIGINT,
  total_cost DECIMAL,
  whatsapp_count BIGINT,
  sms_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE status IN ('sent', 'delivered')) as total_sent,
    COUNT(*) FILTER (WHERE status = 'delivered') as total_delivered,
    COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
    COALESCE(SUM(cost), 0) as total_cost,
    COUNT(*) FILTER (WHERE provider = 'whatsapp') as whatsapp_count,
    COUNT(*) FILTER (WHERE provider = 'sms') as sms_count
  FROM sms_logs
  WHERE created_at > now() - (p_days || ' days')::INTERVAL;
END;
$$;