-- ═══════════════════════════════════════════════════════════════════
-- Migration: الأرشفة الكاملة في جدول زمني فريد وتصحيح رصيد الراكب غير الكافي
-- التاريخ الفعلي الحالي: 2026-06-03 18:50:00
-- ═══════════════════════════════════════════════════════════════════

-- 1️⃣ إنشاء جدول الأرشيف المنسخ بنسخة زمنية فريدة ومطابقة 100% لبنية جدول المعاملات الحالي (شاملاً ledger)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deleted_rider_wallet_transactions_backup_20270603185000') THEN
    CREATE TABLE public.deleted_rider_wallet_transactions_backup_20270603185000 AS 
      SELECT * FROM public.rider_wallet_transactions LIMIT 0;
    
    ALTER TABLE public.deleted_rider_wallet_transactions_backup_20270603185000 
      ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT now();
  END IF;
END $$;

-- 2️⃣ نسخ المعاملات المكررة التاريخية (مع الحفاظ على المعاملة الأولى والأقدم فقط وحذف المكررات اللاحقة)
WITH duplicate_ids AS (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY ride_id, type 
             ORDER BY created_at ASC, id ASC
           ) as rn
    FROM public.rider_wallet_transactions
    WHERE ride_id IS NOT NULL AND type = 'ride_payment'
  ) t
  WHERE rn > 1
)
INSERT INTO public.deleted_rider_wallet_transactions_backup_20270603185000
SELECT *, now() as deleted_at
FROM public.rider_wallet_transactions
WHERE id IN (SELECT id FROM duplicate_ids);

-- 3️⃣ حذف التكرارات التاريخية الفعلية التي تم نسخها احتياطياً
DELETE FROM public.rider_wallet_transactions
WHERE id IN (SELECT id FROM public.deleted_rider_wallet_transactions_backup_20270603185000);

-- 3.5️⃣ إضافة قيد الـ Idempotency الفريد على مستوى جدول معاملات محفظة الراكب لمنع التكرار (بعد تنظيف التكرارات بالكامل)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'uq_rider_wallet_ride_payment'
  ) THEN
    ALTER TABLE public.rider_wallet_transactions
      ADD CONSTRAINT uq_rider_wallet_ride_payment UNIQUE (ride_id, type);
  END IF;
END $$;


-- 4️⃣ إعادة تعريف تريجر handle_rider_cancellation_penalty لمنع جعل رصيد الراكب سالباً عند عدم كفاية الرصيد
CREATE OR REPLACE FUNCTION public.handle_rider_cancellation_penalty()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_penalty        JSONB;
  v_penalty_amount INTEGER;
  v_driver_id      UUID;
  v_rider_user_id  UUID;
  v_distance_km    FLOAT;
  v_rider_balance  INTEGER;
BEGIN
  -- فحص الشروط الأساسية
  IF NEW.cancelled_by != 'rider'
     OR OLD.status::text NOT IN ('accepted', 'arrived')
     OR OLD.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_driver_id     := OLD.driver_id;
  v_rider_user_id := OLD.rider_id;

  -- حساب الغرامة بناء على الدالة المحدثة
  v_penalty := public.calculate_cancellation_penalty(NEW.id);

  -- إذا كانت الغرامة معطلة أو قيمتها صفر (مثال: enabled = false)، نخرج فورا دون خصم أو تعويض
  IF NOT (v_penalty->>'should_penalize')::BOOLEAN OR COALESCE((v_penalty->>'penalty_amount')::INTEGER, 0) = 0 THEN
    RAISE NOTICE 'Ride % cancelled by rider — no penalty applied (disabled in app_settings)', NEW.id;
    NEW.cancellation_fee := 0;
    NEW.cancellation_fee_paid := false;
    RETURN NEW;
  END IF;

  v_penalty_amount := (v_penalty->>'penalty_amount')::INTEGER;

  -- حساب المسافة وتسجيلها
  v_distance_km                  := (v_penalty->>'distance_to_pickup_km')::FLOAT;
  NEW.distance_to_pickup_at_cancel := v_distance_km;
  NEW.cancellation_fee           := v_penalty_amount;

  -- القفل الحصري: قفل صف محفظة الراكب المتأثر لمنع معاملات السحب المتزامنة والتضارب
  SELECT COALESCE(wallet_balance, 0) INTO v_rider_balance
  FROM profiles 
  WHERE user_id = v_rider_user_id
  FOR UPDATE;

  -- خصم من محفظة الراكب فقط إذا لم يتم الخصم مسبقاً (عبر الـ RPC) وبشرط كفاية الرصيد
  IF NOT COALESCE(OLD.cancellation_fee_paid, false) AND NOT COALESCE(NEW.cancellation_fee_paid, false) THEN
    IF v_rider_balance >= v_penalty_amount THEN
      INSERT INTO rider_wallet_transactions (
        user_id,
        amount,
        type,
        description,
        ride_id,
        status,
        balance_before,
        balance_after
      ) VALUES (
        v_rider_user_id,
        -v_penalty_amount,
        'ride_payment',
        format('غرامة إلغاء رحلة #%s — %s', LEFT(NEW.id::TEXT, 8), v_penalty->>'reason'),
        NEW.id,
        'completed',
        v_rider_balance,
        v_rider_balance - v_penalty_amount
      );

      UPDATE profiles
      SET wallet_balance = v_rider_balance - v_penalty_amount,
          updated_at     = now()
      WHERE user_id = v_rider_user_id;

      NEW.cancellation_fee_paid := true;
    ELSE
      -- 🛡️ الرصيد غير كافٍ: لا يتم خصم ولا إنشاء معاملة ولا جعل الرصيد سالباً
      NEW.cancellation_fee_paid := false;
      RAISE NOTICE 'Ride % cancelled by rider — insufficient balance (% IQD vs % IQD), penalty skipped', 
        NEW.id, v_rider_balance, v_penalty_amount;
    END IF;
  ELSE
    NEW.cancellation_fee_paid := true;
  END IF;

  -- إضافة تعويض لمحفظة السائق (فقط إذا كانت الغرامة مدفوعة بالكامل)
  IF v_penalty_amount > 0 AND NEW.cancellation_fee_paid = true THEN
    -- صمام الأمان المحدث: منع تكرار تعويض السائق لنفس الإلغاء بدقة باستخدام نوع العملية ونوع المكافأة و الـ metadata
    IF NOT EXISTS (
      SELECT 1 FROM wallet_transactions
      WHERE ride_id = NEW.id
        AND transaction_type = 'bonus'
        AND metadata->>'penalty_type' = 'rider_cancellation_compensation'
    ) THEN
      PERFORM public.create_wallet_transaction(
        v_driver_id,
        'bonus',
        v_penalty_amount::DECIMAL(12,2),
        NEW.id,
        format('تعويض إلغاء الراكب — %s', v_penalty->>'reason'),
        jsonb_build_object(
          'penalty_type',                  'rider_cancellation_compensation',
          'time_since_accept_seconds',      v_penalty->>'time_since_accept_seconds',
          'distance_to_pickup_km',          v_penalty->>'distance_to_pickup_km'
        )
      );

      -- إرسال الإشعارات للسائق والراكب عند تنفيذ المعاملة المالية الفعلية فقط (استخدام جداول الإشعارات المتخصصة)
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'driver_notifications') THEN
        INSERT INTO driver_notifications (
          driver_id, title, body, type, data, is_read, created_at
        ) VALUES (
          v_driver_id,
          'تم تعويضك عن الإلغاء 💰',
          format('تم إضافة %s دينار لمحفظتك كتعويض عن إلغاء الراكب', v_penalty_amount),
          'wallet_credit',
          jsonb_build_object('ride_id', NEW.id, 'amount', v_penalty_amount, 'reason', 'rider_cancellation_compensation'),
          false,
          now()
        );
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rider_notifications') THEN
        INSERT INTO rider_notifications (
          user_id, title, body, type, data, is_read, created_at
        ) VALUES (
          v_rider_user_id,
          'تم خصم غرامة إلغاء',
          format('تم خصم %s دينار من محفظتك — السائق كان في طريقه إليك', v_penalty_amount),
          'wallet_debit',
          jsonb_build_object('ride_id', NEW.id, 'amount', v_penalty_amount, 'reason', v_penalty->>'reason'),
          false,
          now()
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
