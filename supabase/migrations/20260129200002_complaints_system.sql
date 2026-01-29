-- =====================================================
-- نظام الشكاوى المتكامل
-- تاريخ الإنشاء: 2026-01-29
-- الوصف: جداول الشكاوى، القرارات المالية، والأدلة
-- =====================================================

-- 1️⃣ جدول الشكاوى الرئيسي
CREATE TABLE IF NOT EXISTS ride_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  
  -- المُشتكي
  complainant_id UUID NOT NULL REFERENCES auth.users(id),
  complainant_type TEXT NOT NULL CHECK (complainant_type IN ('rider', 'driver')),
  
  -- تفاصيل الشكوى
  complaint_type TEXT NOT NULL CHECK (complaint_type IN (
    'ride_not_ended',      -- لم تنته الرحلة فعلياً
    'wrong_fare',          -- مبلغ خاطئ
    'inappropriate_behavior', -- سلوك غير لائق
    'wrong_route',         -- مسار غير صحيح
    'excessive_delay',     -- تأخير كبير
    'unjustified_cancellation', -- إلغاء تعسفي
    'fraud',               -- احتيال
    'other'                -- أخرى
  )),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- الأدلة
  evidence_urls TEXT[], -- روابط الصور/الملفات المرفوعة
  
  -- الأولوية والحالة
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'resolved', 'rejected')),
  
  -- المراجعة
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  -- القرار المالي
  financial_decision TEXT CHECK (financial_decision IN (
    'refund_to_rider',     -- إعادة كاملة للراكب
    'refund_to_driver',    -- إعادة للسائق
    'split_50_50',         -- تقسيم 50/50
    'no_refund'            -- عدم إعادة
  )),
  financial_decision_notes TEXT,
  financial_decision_executed BOOLEAN DEFAULT FALSE,
  financial_decision_executed_at TIMESTAMPTZ,
  
  -- التوقيت
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- فهارس للأداء
CREATE INDEX idx_complaints_ride_id ON ride_complaints(ride_id);
CREATE INDEX idx_complaints_complainant ON ride_complaints(complainant_id, created_at DESC);
CREATE INDEX idx_complaints_status ON ride_complaints(status, priority, created_at DESC);
CREATE INDEX idx_complaints_type ON ride_complaints(complaint_type, created_at DESC);
CREATE INDEX idx_complaints_priority ON ride_complaints(priority, created_at DESC) WHERE status != 'resolved';
-- الشكاوى المعلقة (بدون now() للسماح بالفهرس)
CREATE INDEX idx_complaints_pending ON ride_complaints(created_at DESC) WHERE status = 'pending';

-- RLS
ALTER TABLE ride_complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_complaints" ON ride_complaints
  FOR SELECT USING (
    complainant_id = auth.uid() OR
    -- الطرف الآخر يرى الشكوى
    EXISTS (
      SELECT 1 FROM rides
      WHERE rides.id = ride_complaints.ride_id
        AND (rides.rider_id = auth.uid() OR 
             rides.driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()))
    )
  );

CREATE POLICY "users_create_own_complaints" ON ride_complaints
  FOR INSERT WITH CHECK (complainant_id = auth.uid());

CREATE POLICY "admins_manage_complaints" ON ride_complaints
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE ride_complaints IS 'شكاوى الرحلات مع القرارات المالية';

-- =====================================================
-- 2️⃣ جدول ردود الشكاوى
-- =====================================================
CREATE TABLE IF NOT EXISTS complaint_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES ride_complaints(id) ON DELETE CASCADE,
  
  -- الرد
  responder_id UUID NOT NULL REFERENCES auth.users(id),
  responder_type TEXT NOT NULL CHECK (responder_type IN ('rider', 'driver', 'admin')),
  response_text TEXT NOT NULL,
  
  -- مرفقات إضافية
  attachments TEXT[],
  
  -- التوقيت
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_complaint_responses_complaint ON complaint_responses(complaint_id, created_at);
CREATE INDEX idx_complaint_responses_responder ON complaint_responses(responder_id, created_at DESC);

ALTER TABLE complaint_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_related_responses" ON complaint_responses
  FOR SELECT USING (
    responder_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM ride_complaints
      WHERE ride_complaints.id = complaint_responses.complaint_id
        AND (
          ride_complaints.complainant_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM rides
            WHERE rides.id = ride_complaints.ride_id
              AND (rides.rider_id = auth.uid() OR 
                   rides.driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()))
          )
        )
    )
  );

CREATE POLICY "users_create_responses" ON complaint_responses
  FOR INSERT WITH CHECK (responder_id = auth.uid());

CREATE POLICY "admins_manage_responses" ON complaint_responses
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE complaint_responses IS 'ردود الأطراف على الشكاوى';

-- =====================================================
-- 3️⃣ جدول القرارات المالية (audit log)
-- =====================================================
CREATE TABLE IF NOT EXISTS financial_decisions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID REFERENCES ride_complaints(id) ON DELETE SET NULL,
  ride_id UUID NOT NULL REFERENCES rides(id),
  
  -- القرار
  decision_type TEXT NOT NULL CHECK (decision_type IN (
    'refund_to_rider',
    'refund_to_driver', 
    'split_50_50',
    'no_refund'
  )),
  amount INTEGER NOT NULL,
  
  -- التفاصيل
  reason TEXT NOT NULL,
  decided_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- التنفيذ
  executed BOOLEAN DEFAULT FALSE,
  executed_at TIMESTAMPTZ,
  execution_details JSONB,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_financial_decisions_complaint ON financial_decisions_log(complaint_id);
CREATE INDEX idx_financial_decisions_ride ON financial_decisions_log(ride_id);
CREATE INDEX idx_financial_decisions_decided_by ON financial_decisions_log(decided_by, created_at DESC);
CREATE INDEX idx_financial_decisions_executed ON financial_decisions_log(executed, created_at DESC);

ALTER TABLE financial_decisions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_financial_decisions" ON financial_decisions_log
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users_view_own_decisions" ON financial_decisions_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rides
      WHERE rides.id = financial_decisions_log.ride_id
        AND (rides.rider_id = auth.uid() OR 
             rides.driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()))
    )
  );

COMMENT ON TABLE financial_decisions_log IS 'سجل كامل لجميع القرارات المالية';

-- =====================================================
-- 4️⃣ دالة لتحديد الأولوية التلقائية
-- =====================================================
CREATE OR REPLACE FUNCTION set_complaint_priority()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- تحديد الأولوية بناءً على النوع
  NEW.priority := CASE NEW.complaint_type
    WHEN 'fraud' THEN 'urgent'
    WHEN 'inappropriate_behavior' THEN 'high'
    WHEN 'unjustified_cancellation' THEN 'high'
    WHEN 'wrong_fare' THEN 'medium'
    WHEN 'ride_not_ended' THEN 'high'
    ELSE 'medium'
  END;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_complaint_priority ON ride_complaints;
CREATE TRIGGER trigger_set_complaint_priority
  BEFORE INSERT ON ride_complaints
  FOR EACH ROW
  EXECUTE FUNCTION set_complaint_priority();

-- =====================================================
-- 5️⃣ دالة لتنفيذ القرار المالي
-- =====================================================
CREATE OR REPLACE FUNCTION execute_financial_decision(
  p_complaint_id UUID,
  p_decision_type TEXT,
  p_reason TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ride_id UUID;
  v_rider_id UUID;
  v_driver_id UUID;
  v_final_fare INTEGER;
  v_amount INTEGER;
  v_result JSON;
BEGIN
  -- جلب معلومات الرحلة
  SELECT r.id, r.rider_id, r.driver_id, r.final_fare
  INTO v_ride_id, v_rider_id, v_driver_id, v_final_fare
  FROM ride_complaints c
  JOIN rides r ON r.id = c.ride_id
  WHERE c.id = p_complaint_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Complaint not found');
  END IF;
  
  -- تنفيذ القرار
  CASE p_decision_type
    WHEN 'refund_to_rider' THEN
      v_amount := v_final_fare;
      -- إعادة للراكب (إضافة للمحفظة)
      UPDATE profiles
      SET wallet_balance = COALESCE(wallet_balance, 0) + v_amount
      WHERE user_id = v_rider_id;
      
      -- خصم من السائق
      UPDATE driver_wallets
      SET balance = balance - v_amount
      WHERE driver_id = v_driver_id;
      
    WHEN 'refund_to_driver' THEN
      v_amount := v_final_fare;
      -- إعادة للسائق (إلغاء الخصم)
      UPDATE driver_wallets
      SET balance = balance + v_amount
      WHERE driver_id = v_driver_id;
      
    WHEN 'split_50_50' THEN
      v_amount := v_final_fare / 2;
      -- نصف للراكب
      UPDATE profiles
      SET wallet_balance = COALESCE(wallet_balance, 0) + v_amount
      WHERE user_id = v_rider_id;
      
      -- نصف للسائق
      UPDATE driver_wallets
      SET balance = balance + v_amount
      WHERE driver_id = v_driver_id;
      
    WHEN 'no_refund' THEN
      v_amount := 0;
      -- لا شيء
  END CASE;
  
  -- تسجيل القرار
  INSERT INTO financial_decisions_log (
    complaint_id,
    ride_id,
    decision_type,
    amount,
    reason,
    decided_by,
    executed,
    executed_at,
    execution_details
  ) VALUES (
    p_complaint_id,
    v_ride_id,
    p_decision_type,
    v_amount,
    p_reason,
    auth.uid(),
    true,
    now(),
    json_build_object(
      'rider_id', v_rider_id,
      'driver_id', v_driver_id,
      'original_fare', v_final_fare,
      'refund_amount', v_amount
    )
  );
  
  -- تحديث الشكوى
  UPDATE ride_complaints
  SET 
    financial_decision = p_decision_type,
    financial_decision_notes = p_reason,
    financial_decision_executed = true,
    financial_decision_executed_at = now(),
    status = 'resolved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_complaint_id;
  
  v_result := json_build_object(
    'success', true,
    'decision', p_decision_type,
    'amount', v_amount,
    'ride_id', v_ride_id
  );
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION execute_financial_decision(UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION execute_financial_decision IS 'تنفيذ القرار المالي للشكوى وتحديث المحافظ';

-- =====================================================
-- 6️⃣ View لإحصائيات الشكاوى
-- =====================================================
CREATE OR REPLACE VIEW complaints_stats AS
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'under_review') as under_review_count,
  COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
  COUNT(*) FILTER (WHERE status = 'pending' AND created_at < now() - INTERVAL '24 hours') as old_pending_count,
  COUNT(*) FILTER (WHERE priority = 'urgent' AND status != 'resolved') as urgent_count,
  COUNT(*) FILTER (WHERE priority = 'high' AND status != 'resolved') as high_priority_count
FROM ride_complaints;

GRANT SELECT ON complaints_stats TO authenticated;

COMMENT ON VIEW complaints_stats IS 'إحصائيات سريعة للشكاوى للوحة التحكم';

-- =====================================================
-- ✅ اكتمل إنشاء نظام الشكاوى
-- =====================================================
