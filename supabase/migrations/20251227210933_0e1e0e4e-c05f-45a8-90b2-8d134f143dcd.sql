-- =============================================
-- نظام المحفظة الذكية المتكاملة
-- =============================================

-- 1. إضافة أعمدة رصيد المحفظة لجدول profiles (للركاب)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS wallet_balance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS wallet_enabled BOOLEAN DEFAULT true;

-- 2. إضافة أعمدة رصيد العمولة لجدول drivers
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS wallet_balance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_balance INTEGER DEFAULT 0;

-- 3. إنشاء جدول معاملات محفظة الراكب
CREATE TABLE IF NOT EXISTS public.rider_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('topup', 'ride_payment', 'refund', 'bonus', 'transfer_to_driver')),
  payment_method TEXT,
  reference_id TEXT,
  ride_id UUID REFERENCES public.rides(id),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. إنشاء جدول طلبات إضافة الرصيد
CREATE TABLE IF NOT EXISTS public.wallet_topup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type TEXT NOT NULL CHECK (user_type IN ('rider', 'driver')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL,
  payment_account TEXT,
  reference_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID
);

-- 5. إنشاء جدول حسابات الدفع (أرقام ran)
CREATE TABLE IF NOT EXISTS public.payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. تفعيل RLS
ALTER TABLE public.rider_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_topup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;

-- 7. سياسات RLS لمعاملات محفظة الراكب
CREATE POLICY "Users can view their own wallet transactions" 
ON public.rider_wallet_transactions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert wallet transactions" 
ON public.rider_wallet_transactions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can manage all wallet transactions" 
ON public.rider_wallet_transactions 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 8. سياسات RLS لطلبات الرصيد
CREATE POLICY "Users can view their own topup requests" 
ON public.wallet_topup_requests 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own topup requests" 
ON public.wallet_topup_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all topup requests" 
ON public.wallet_topup_requests 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 9. سياسات RLS لحسابات الدفع
CREATE POLICY "Anyone can view active payment accounts" 
ON public.payment_accounts 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage payment accounts" 
ON public.payment_accounts 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 10. Function لحساب رصيد محفظة الراكب
CREATE OR REPLACE FUNCTION public.get_rider_wallet_balance(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(wallet_balance, 0)
  FROM profiles
  WHERE user_id = p_user_id
$$;

-- 11. Function لخصم العمولة من رصيد السائق
CREATE OR REPLACE FUNCTION public.deduct_driver_commission(
  p_driver_id UUID, 
  p_amount INTEGER,
  p_ride_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Get current balance
  SELECT COALESCE(wallet_balance, 0) INTO v_current_balance
  FROM drivers WHERE id = p_driver_id;
  
  -- Check if enough balance
  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'رصيد غير كافي',
      'current_balance', v_current_balance,
      'required', p_amount
    );
  END IF;
  
  -- Deduct from balance
  v_new_balance := v_current_balance - p_amount;
  
  UPDATE drivers 
  SET wallet_balance = v_new_balance,
      commission_balance = COALESCE(commission_balance, 0) + p_amount,
      updated_at = now()
  WHERE id = p_driver_id;
  
  -- Record transaction
  INSERT INTO driver_wallet_transactions (driver_id, amount, type, description, ride_id)
  VALUES (p_driver_id, -p_amount, 'commission_deduction', 'خصم عمولة رحلة', p_ride_id);
  
  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'deducted', p_amount
  );
END;
$$;

-- 12. Function لتحويل من محفظة الراكب للسائق
CREATE OR REPLACE FUNCTION public.transfer_wallet_to_driver(
  p_rider_user_id UUID,
  p_driver_id UUID,
  p_amount INTEGER,
  p_ride_id UUID,
  p_commission_rate NUMERIC DEFAULT 0.15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rider_balance INTEGER;
  v_commission INTEGER;
  v_driver_share INTEGER;
BEGIN
  -- Get rider balance
  SELECT COALESCE(wallet_balance, 0) INTO v_rider_balance
  FROM profiles WHERE user_id = p_rider_user_id;
  
  -- Check if enough balance
  IF v_rider_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'رصيد الراكب غير كافي',
      'current_balance', v_rider_balance,
      'required', p_amount
    );
  END IF;
  
  -- Calculate commission and driver share
  v_commission := ROUND(p_amount * p_commission_rate);
  v_driver_share := p_amount - v_commission;
  
  -- Deduct from rider
  UPDATE profiles 
  SET wallet_balance = wallet_balance - p_amount,
      updated_at = now()
  WHERE user_id = p_rider_user_id;
  
  -- Record rider transaction
  INSERT INTO rider_wallet_transactions (user_id, amount, type, ride_id, description)
  VALUES (p_rider_user_id, -p_amount, 'ride_payment', p_ride_id, 'دفع أجرة رحلة');
  
  -- Add to driver wallet
  UPDATE drivers 
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_driver_share,
      updated_at = now()
  WHERE id = p_driver_id;
  
  -- Record driver transaction
  INSERT INTO driver_wallet_transactions (driver_id, amount, type, description, ride_id)
  VALUES (p_driver_id, v_driver_share, 'ride_earning', 'أرباح رحلة (دفع إلكتروني)', p_ride_id);
  
  -- Record company earnings
  INSERT INTO company_earnings (ride_id, driver_id, total_fare, commission_rate, commission_amount, driver_share)
  VALUES (p_ride_id, p_driver_id, p_amount, p_commission_rate, v_commission, v_driver_share);
  
  RETURN jsonb_build_object(
    'success', true,
    'total_amount', p_amount,
    'commission', v_commission,
    'driver_share', v_driver_share
  );
END;
$$;

-- 13. Function للموافقة على طلب الرصيد
CREATE OR REPLACE FUNCTION public.approve_topup_request(
  p_request_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_request RECORD;
BEGIN
  -- Get request details
  SELECT * INTO v_request
  FROM wallet_topup_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الطلب غير موجود أو تمت معالجته');
  END IF;
  
  -- Update request status
  UPDATE wallet_topup_requests
  SET status = 'approved',
      admin_notes = p_admin_notes,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  WHERE id = p_request_id;
  
  -- Add balance based on user type
  IF v_request.user_type = 'rider' THEN
    UPDATE profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_request.amount,
        updated_at = now()
    WHERE user_id = v_request.user_id;
    
    INSERT INTO rider_wallet_transactions (user_id, amount, type, payment_method, reference_id, description)
    VALUES (v_request.user_id, v_request.amount, 'topup', v_request.payment_method, v_request.reference_number, 'إضافة رصيد');
  ELSE
    UPDATE drivers
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_request.amount,
        updated_at = now()
    WHERE user_id = v_request.user_id;
    
    INSERT INTO driver_wallet_transactions (driver_id, amount, type, description)
    SELECT id, v_request.amount, 'topup', 'إضافة رصيد للعمولة'
    FROM drivers WHERE user_id = v_request.user_id;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'amount', v_request.amount);
END;
$$;

-- 14. Function لرفض طلب الرصيد
CREATE OR REPLACE FUNCTION public.reject_topup_request(
  p_request_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE wallet_topup_requests
  SET status = 'rejected',
      admin_notes = p_admin_notes,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  WHERE id = p_request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الطلب غير موجود أو تمت معالجته');
  END IF;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- 15. إضافة بيانات أولية لحسابات الدفع
INSERT INTO public.payment_accounts (payment_method, account_name, account_number, account_holder, instructions, display_order)
VALUES 
  ('zain_cash', 'زين كاش', '07801234567', 'شركة ران للنقل', 'قم بتحويل المبلغ ثم أدخل رقم العملية', 1),
  ('asia_hawala', 'آسيا حوالة', '07701234567', 'شركة ران للنقل', 'قم بتحويل المبلغ ثم أدخل رقم العملية', 2),
  ('fastpay', 'فاست باي', '07901234567', 'شركة ران للنقل', 'قم بتحويل المبلغ ثم أدخل رقم العملية', 3)
ON CONFLICT DO NOTHING;