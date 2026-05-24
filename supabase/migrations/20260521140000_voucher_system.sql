-- ══════════════════════════════════════════════════════════════
-- 🎫 نظام كروت الشحن — Voucher/Scratch Card System
-- ══════════════════════════════════════════════════════════════

-- ═══ 1. جدول كروت الشحن ═══
CREATE TABLE IF NOT EXISTS voucher_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,           -- رمز الكارت (مثل RAAN-XXXX-XXXX)
  amount DECIMAL(12,2) NOT NULL,       -- المبلغ بالدينار
  status TEXT NOT NULL DEFAULT 'active',  -- active, redeemed, expired, disabled
  redeemed_by UUID REFERENCES auth.users(id),
  redeemed_at TIMESTAMPTZ,
  created_by UUID,                     -- الأدمن الذي أنشأ الكارت
  expires_at TIMESTAMPTZ,              -- تاريخ انتهاء الصلاحية (اختياري)
  batch_name TEXT,                     -- اسم الدفعة (لتتبع المبيعات)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_voucher_code ON voucher_codes(code);
CREATE INDEX IF NOT EXISTS idx_voucher_status ON voucher_codes(status);

-- RLS
ALTER TABLE voucher_codes ENABLE ROW LEVEL SECURITY;

-- الأدمن يقدر يشوف ويعدّل الكل
CREATE POLICY "admin_full_vouchers" ON voucher_codes
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin')
  );

-- المستخدم يقدر يشوف فقط كروته المستخدمة
CREATE POLICY "user_own_vouchers" ON voucher_codes
  FOR SELECT USING (redeemed_by = auth.uid());

-- ═══ 2. دالة استبدال الكارت — ذرية ═══
CREATE OR REPLACE FUNCTION redeem_voucher(
  p_code TEXT,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_voucher RECORD;
  v_current_balance DECIMAL(12,2);
  v_new_balance DECIMAL(12,2);
BEGIN
  -- تنظيف الكود (حذف المسافات والشرطات الزائدة)
  p_code := UPPER(TRIM(p_code));

  -- ═══ البحث عن الكارت مع قفل ═══
  SELECT * INTO v_voucher
  FROM voucher_codes
  WHERE code = p_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'الرمز غير صحيح أو غير موجود'
    );
  END IF;

  -- ═══ التحقق من الحالة ═══
  IF v_voucher.status = 'redeemed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'هذا الكارت مستخدم مسبقاً'
    );
  END IF;

  IF v_voucher.status != 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'هذا الكارت غير فعّال'
    );
  END IF;

  -- التحقق من الصلاحية
  IF v_voucher.expires_at IS NOT NULL AND v_voucher.expires_at < now() THEN
    UPDATE voucher_codes SET status = 'expired' WHERE id = v_voucher.id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'انتهت صلاحية هذا الكارت'
    );
  END IF;

  -- ═══ شحن المحفظة ═══
  SELECT wallet_balance INTO v_current_balance
  FROM profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'المستخدم غير موجود'
    );
  END IF;

  v_new_balance := COALESCE(v_current_balance, 0) + v_voucher.amount;

  UPDATE profiles
  SET wallet_balance = v_new_balance,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- ═══ تحديث الكارت ═══
  UPDATE voucher_codes
  SET status = 'redeemed',
      redeemed_by = p_user_id,
      redeemed_at = now(),
      updated_at = now()
  WHERE id = v_voucher.id;

  -- ═══ تسجيل في المعاملات ═══
  INSERT INTO rider_wallet_transactions (
    user_id,
    amount,
    type,
    status,
    payment_method,
    description,
    reference_id
  ) VALUES (
    p_user_id,
    v_voucher.amount,
    'topup',
    'completed',
    'voucher',
    format('شحن كارت — %s', p_code),
    v_voucher.id::TEXT
  );

  RETURN jsonb_build_object(
    'success', true,
    'amount', v_voucher.amount,
    'new_balance', v_new_balance,
    'code', p_code
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'حدث خطأ أثناء معالجة الكارت'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══ 3. كروت تجريبية (اختياري — احذفها في الإنتاج) ═══
INSERT INTO voucher_codes (code, amount, batch_name) VALUES
  ('RAAN-TEST-1000', 1000, 'test_batch'),
  ('RAAN-TEST-5000', 5000, 'test_batch'),
  ('RAAN-TEST-10K', 10000, 'test_batch'),
  ('RAAN-GIFT-25K', 25000, 'test_batch')
ON CONFLICT (code) DO NOTHING;

-- ═══ 4. دالة إصدار دفعة كروت شحن ═══
CREATE OR REPLACE FUNCTION generate_voucher_batch(
  p_count INTEGER,           -- عدد الكروت
  p_amount DECIMAL,          -- المبلغ لكل كارت
  p_batch_name TEXT DEFAULT NULL,  -- اسم الدفعة
  p_expires_days INTEGER DEFAULT NULL  -- صلاحية بالأيام (NULL = بلا حد)
)
RETURNS TABLE (code TEXT, amount DECIMAL) AS $$
DECLARE
  v_code TEXT;
  v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- بدون O/0/I/1 لتجنب اللبس
  v_i INTEGER;
  v_generated INTEGER := 0;
  v_part1 TEXT;
  v_part2 TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  -- حد أقصى 500 كارت بالدفعة
  IF p_count > 500 THEN
    RAISE EXCEPTION 'الحد الأقصى 500 كارت بالدفعة الواحدة';
  END IF;

  IF p_amount < 250 THEN
    RAISE EXCEPTION 'الحد الأدنى للمبلغ 250 دينار';
  END IF;

  -- حساب تاريخ الانتهاء
  IF p_expires_days IS NOT NULL THEN
    v_expires := now() + (p_expires_days || ' days')::interval;
  END IF;

  WHILE v_generated < p_count LOOP
    -- توليد كود فريد: RAAN-XXXX-XXXX
    v_part1 := '';
    v_part2 := '';
    FOR v_i IN 1..4 LOOP
      v_part1 := v_part1 || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
      v_part2 := v_part2 || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    END LOOP;
    v_code := 'RAAN-' || v_part1 || '-' || v_part2;

    -- تأكد من عدم التكرار
    IF NOT EXISTS (SELECT 1 FROM voucher_codes vc WHERE vc.code = v_code) THEN
      INSERT INTO voucher_codes (code, amount, batch_name, expires_at, created_by)
      VALUES (v_code, p_amount, COALESCE(p_batch_name, 'batch_' || to_char(now(), 'YYYYMMDD_HH24MI')), v_expires, auth.uid());

      code := v_code;
      amount := p_amount;
      RETURN NEXT;

      v_generated := v_generated + 1;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
