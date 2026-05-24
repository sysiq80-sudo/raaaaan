-- ==========================================
-- 💰 نظام محفظة السائق المتطور
-- ==========================================
-- يوفر: رصيد فوري، سجل المعاملات، طلبات السحب، نظام عمولات

-- جدول المحفظة (واحدة لكل سائق)
CREATE TABLE IF NOT EXISTS driver_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  
  -- الأرصدة
  balance DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  pending_balance DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
  lifetime_earnings DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_withdrawn DECIMAL(12,2) NOT NULL DEFAULT 0,
  
  -- الإحصائيات
  total_rides_completed INTEGER NOT NULL DEFAULT 0,
  commission_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  tips_received DECIMAL(12,2) NOT NULL DEFAULT 0,
  
  -- الحسابات البنكية (JSON للمرونة)
  bank_accounts JSONB DEFAULT '[]'::jsonb,
  preferred_bank_account_id TEXT,
  
  -- الحالة
  is_suspended BOOLEAN DEFAULT false,
  suspension_reason TEXT,
  
  -- التواريخ
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(driver_id)
);

-- سجل معاملات المحفظة
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES driver_wallets(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  
  -- نوع المعاملة
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'ride_earning',      -- أرباح رحلة
    'commission',        -- خصم عمولة
    'tip',              -- بقشيش
    'withdrawal',       -- سحب
    'refund',           -- استرجاع
    'bonus',            -- مكافأة
    'penalty',          -- غرامة
    'adjustment'        -- تعديل إداري
  )),
  
  -- المبلغ (موجب للزيادة، سالب للخصم)
  amount DECIMAL(12,2) NOT NULL,
  balance_before DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  
  -- الارتباط بالرحلة (إن وجد)
  ride_id UUID REFERENCES rides(id) ON DELETE SET NULL,
  
  -- الوصف والبيانات الإضافية
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- الحالة
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN (
    'pending',
    'completed',
    'failed',
    'reversed'
  )),
  
  -- المعالجة
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- طلبات السحب
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES driver_wallets(id) ON DELETE CASCADE,
  
  -- المبلغ
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  
  -- طريقة السحب
  withdrawal_method TEXT NOT NULL CHECK (withdrawal_method IN (
    'bank_transfer',
    'zain_cash',
    'super_key',
    'nas_wallet',
    'manual'  -- للصرف اليدوي
  )),
  
  -- تفاصيل الحساب
  account_details JSONB NOT NULL,
  account_holder_name TEXT NOT NULL,
  
  -- الحالة
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',        -- قيد المراجعة
    'approved',       -- موافق عليه
    'processing',     -- قيد التنفيذ
    'completed',      -- تم التحويل
    'rejected',       -- مرفوض
    'cancelled'       -- ملغي
  )),
  
  -- المراجعة والمعالجة
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes TEXT,
  
  processed_at TIMESTAMPTZ,
  transaction_reference TEXT,  -- رقم العملية البنكية
  
  -- الإلغاء
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- إعدادات نظام المحفظة
CREATE TABLE IF NOT EXISTS wallet_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- الحد الأدنى للسحب
  min_withdrawal_amount DECIMAL(10,2) NOT NULL DEFAULT 10000,
  
  -- الحد الأقصى للسحب اليومي
  max_daily_withdrawal DECIMAL(12,2) NOT NULL DEFAULT 5000000,
  
  -- نسبة العمولة الافتراضية
  default_commission_rate DECIMAL(5,2) NOT NULL DEFAULT 15.00,
  
  -- رسوم السحب
  withdrawal_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  withdrawal_fee_fixed DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- أيام معالجة السحب
  withdrawal_processing_days INTEGER NOT NULL DEFAULT 3,
  
  -- تفعيل السحب التلقائي
  auto_withdrawal_enabled BOOLEAN DEFAULT false,
  auto_withdrawal_threshold DECIMAL(12,2),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- إدراج إعدادات افتراضية
INSERT INTO wallet_settings (min_withdrawal_amount, max_daily_withdrawal, default_commission_rate)
VALUES (10000, 5000000, 15.00)
ON CONFLICT DO NOTHING;

-- ==========================================
-- الفهارس
-- ==========================================

CREATE INDEX idx_driver_wallets_driver_id ON driver_wallets(driver_id);
CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_transactions_driver_id ON wallet_transactions(driver_id);
CREATE INDEX idx_wallet_transactions_ride_id ON wallet_transactions(ride_id) WHERE ride_id IS NOT NULL;
CREATE INDEX idx_wallet_transactions_type ON wallet_transactions(transaction_type);
CREATE INDEX idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);

CREATE INDEX idx_withdrawal_requests_driver_id ON withdrawal_requests(driver_id);
CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX idx_withdrawal_requests_created_at ON withdrawal_requests(created_at DESC);

-- ==========================================
-- Row Level Security
-- ==========================================

ALTER TABLE driver_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_settings ENABLE ROW LEVEL SECURITY;

-- driver_wallets: السائق يرى محفظته فقط
CREATE POLICY "drivers_own_wallet" ON driver_wallets
  FOR SELECT USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- wallet_transactions: السائق يرى معاملاته فقط
CREATE POLICY "drivers_own_transactions" ON wallet_transactions
  FOR SELECT USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- withdrawal_requests: السائق يدير طلباته
CREATE POLICY "drivers_own_withdrawals_select" ON withdrawal_requests
  FOR SELECT USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

CREATE POLICY "drivers_create_withdrawal" ON withdrawal_requests
  FOR INSERT WITH CHECK (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

CREATE POLICY "drivers_cancel_withdrawal" ON withdrawal_requests
  FOR UPDATE USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    AND status = 'pending'
  )
  WITH CHECK (status = 'cancelled');

-- wallet_settings: الكل يقرأ (للحدود)
CREATE POLICY "everyone_reads_settings" ON wallet_settings
  FOR SELECT USING (true);

-- TODO: إضافة سياسات Admin عند إنشاء جدول admin_users
-- CREATE POLICY "admin_manages_wallets" ON driver_wallets FOR ALL USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ==========================================
-- الدوال المساعدة
-- ==========================================

-- حذف الدوال القديمة إن وجدت
DROP FUNCTION IF EXISTS get_driver_wallet_balance(UUID);
DROP FUNCTION IF EXISTS create_wallet_transaction(UUID, TEXT, DECIMAL, UUID, TEXT, JSONB);
DROP FUNCTION IF EXISTS process_ride_earnings(UUID, UUID, DECIMAL, DECIMAL);

-- دالة: الحصول على رصيد السائق
CREATE OR REPLACE FUNCTION get_driver_wallet_balance(p_driver_id UUID)
RETURNS DECIMAL(12,2) AS $$
DECLARE
  v_balance DECIMAL(12,2);
BEGIN
  SELECT balance INTO v_balance
  FROM driver_wallets
  WHERE driver_id = p_driver_id;
  
  RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة: إنشاء معاملة محفظة
CREATE OR REPLACE FUNCTION create_wallet_transaction(
  p_driver_id UUID,
  p_transaction_type TEXT,
  p_amount DECIMAL(12,2),
  p_ride_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance DECIMAL(12,2);
  v_new_balance DECIMAL(12,2);
  v_transaction_id UUID;
BEGIN
  -- الحصول على المحفظة (أو إنشائها)
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM driver_wallets
  WHERE driver_id = p_driver_id;
  
  IF v_wallet_id IS NULL THEN
    INSERT INTO driver_wallets (driver_id)
    VALUES (p_driver_id)
    RETURNING id, balance INTO v_wallet_id, v_current_balance;
  END IF;
  
  -- حساب الرصيد الجديد
  v_new_balance := v_current_balance + p_amount;
  
  -- التأكد من عدم سالبية الرصيد
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'insufficient_balance: الرصيد غير كافٍ';
  END IF;
  
  -- إنشاء المعاملة
  INSERT INTO wallet_transactions (
    wallet_id,
    driver_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    ride_id,
    description,
    metadata,
    status,
    processed_at
  ) VALUES (
    v_wallet_id,
    p_driver_id,
    p_transaction_type,
    p_amount,
    v_current_balance,
    v_new_balance,
    p_ride_id,
    p_description,
    p_metadata,
    'completed',
    now()
  )
  RETURNING id INTO v_transaction_id;
  
  -- تحديث رصيد المحفظة
  UPDATE driver_wallets
  SET 
    balance = v_new_balance,
    lifetime_earnings = lifetime_earnings + GREATEST(p_amount, 0),
    updated_at = now()
  WHERE id = v_wallet_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة: معالجة أرباح الرحلة (مع transaction ACID)
CREATE OR REPLACE FUNCTION process_ride_earnings(
  p_ride_id UUID,
  p_driver_id UUID,
  p_total_fare DECIMAL(10,2),
  p_commission_rate DECIMAL(5,2) DEFAULT 15.00
)
RETURNS JSONB AS $$
DECLARE
  v_commission DECIMAL(10,2);
  v_driver_earning DECIMAL(10,2);
  v_earnings_tx_id UUID;
  v_commission_tx_id UUID;
  v_result JSONB;
BEGIN
  -- بدء transaction لضمان الذرية
  BEGIN
    -- حساب العمولة والأرباح
    v_commission := (p_total_fare * p_commission_rate / 100)::DECIMAL(10,2);
    v_driver_earning := (p_total_fare - v_commission)::DECIMAL(10,2);
    
    -- إضافة أرباح السائق
    v_earnings_tx_id := create_wallet_transaction(
      p_driver_id,
      'ride_earning',
      v_driver_earning,
      p_ride_id,
      'أرباح الرحلة',
      jsonb_build_object('total_fare', p_total_fare, 'commission_rate', p_commission_rate)
    );
    
    -- خصم العمولة (كمعاملة منفصلة للشفافية)
    v_commission_tx_id := create_wallet_transaction(
      p_driver_id,
      'commission',
      -v_commission,
      p_ride_id,
      format('عمولة المنصة (%s%%)', p_commission_rate),
      jsonb_build_object('commission_rate', p_commission_rate)
    );
    
    -- تحديث إحصائيات المحفظة
    UPDATE driver_wallets
    SET 
      total_rides_completed = total_rides_completed + 1,
      commission_paid = commission_paid + v_commission,
      updated_at = now()
    WHERE driver_id = p_driver_id;
    
    -- إرجاع النتائج
    v_result := jsonb_build_object(
      'success', true,
      'total_fare', p_total_fare,
      'commission', v_commission,
      'driver_earning', v_driver_earning,
      'earnings_transaction_id', v_earnings_tx_id,
      'commission_transaction_id', v_commission_tx_id
    );
    
    -- تأكيد الـ transaction
    COMMIT;
    RETURN v_result;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- إلغاء الـ transaction في حالة خطأ
      ROLLBACK;
      RAISE EXCEPTION 'Failed to process ride earnings: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- Triggers
-- ==========================================

-- تحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_wallet_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_driver_wallets_timestamp
  BEFORE UPDATE ON driver_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_timestamp();

CREATE TRIGGER update_withdrawal_requests_timestamp
  BEFORE UPDATE ON withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_timestamp();

-- ==========================================
-- التعليقات
-- ==========================================

COMMENT ON TABLE driver_wallets IS 'محافظ السائقين - رصيد وإحصائيات';
COMMENT ON TABLE wallet_transactions IS 'سجل معاملات المحفظة - شفافية كاملة';
COMMENT ON TABLE withdrawal_requests IS 'طلبات سحب الأرباح';
COMMENT ON TABLE wallet_settings IS 'إعدادات نظام المحفظة (حدود وقواعد)';

COMMENT ON FUNCTION get_driver_wallet_balance IS 'استعلام سريع عن رصيد السائق';
COMMENT ON FUNCTION create_wallet_transaction IS 'إنشاء معاملة محفظة آمنة مع تحديث الرصيد';
COMMENT ON FUNCTION process_ride_earnings IS 'معالجة أرباح الرحلة تلقائياً مع خصم العمولة';
