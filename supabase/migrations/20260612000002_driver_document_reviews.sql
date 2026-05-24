-- نظام مراجعة وثائق السائقين - مراجعة فردية لكل وثيقة
-- يعمل فوق النظام الحالي (URLs في جدول drivers + Storage bucket)

-- أنواع الوثائق المطلوبة
CREATE TYPE public.driver_document_type AS ENUM (
  'profile_image',
  'id_front',
  'id_back',
  'license_front',
  'license_back',
  'vehicle_image'
);

-- حالة مراجعة الوثيقة
CREATE TYPE public.document_review_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

-- جدول مراجعة الوثائق
CREATE TABLE public.driver_document_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  document_type public.driver_document_type NOT NULL,
  status public.document_review_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  expiry_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(driver_id, document_type)
);

-- فهارس
CREATE INDEX idx_doc_reviews_driver ON public.driver_document_reviews(driver_id);
CREATE INDEX idx_doc_reviews_status ON public.driver_document_reviews(status);

-- RLS
ALTER TABLE public.driver_document_reviews ENABLE ROW LEVEL SECURITY;

-- السائق يرى مراجعات وثائقه فقط
CREATE POLICY "drivers_view_own_reviews"
ON public.driver_document_reviews
FOR SELECT
USING (
  driver_id IN (
    SELECT id FROM public.drivers WHERE user_id = auth.uid()
  )
);

-- المدير يرى ويدير كل المراجعات
CREATE POLICY "admins_manage_reviews"
ON public.driver_document_reviews
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- النظام يمكنه إدراج المراجعات (للتريغر)
CREATE POLICY "system_insert_reviews"
ON public.driver_document_reviews
FOR INSERT
WITH CHECK (true);

-- updated_at trigger
CREATE TRIGGER update_doc_reviews_updated_at
  BEFORE UPDATE ON public.driver_document_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- دالة لإنشاء سجلات المراجعة عند رفع الوثائق
-- تُنشئ سجل pending تلقائياً عند تحديث URL الوثيقة
CREATE OR REPLACE FUNCTION public.sync_driver_document_reviews()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doc_map RECORD;
BEGIN
  -- مصفوفة ربط أعمدة URL بأنواع الوثائق
  FOR doc_map IN
    SELECT * FROM (VALUES
      ('profile_image_url', 'profile_image'::driver_document_type),
      ('id_image_url', 'id_front'::driver_document_type),
      ('id_image_back_url', 'id_back'::driver_document_type),
      ('license_image_url', 'license_front'::driver_document_type),
      ('license_image_back_url', 'license_back'::driver_document_type),
      ('vehicle_image_url', 'vehicle_image'::driver_document_type)
    ) AS t(url_col, doc_type)
  LOOP
    -- إذا تغيّر URL الوثيقة (رفع جديد أو تحديث)
    IF (
      (TG_OP = 'INSERT' AND (
        (doc_map.url_col = 'profile_image_url' AND NEW.profile_image_url IS NOT NULL) OR
        (doc_map.url_col = 'id_image_url' AND NEW.id_image_url IS NOT NULL) OR
        (doc_map.url_col = 'id_image_back_url' AND NEW.id_image_back_url IS NOT NULL) OR
        (doc_map.url_col = 'license_image_url' AND NEW.license_image_url IS NOT NULL) OR
        (doc_map.url_col = 'license_image_back_url' AND NEW.license_image_back_url IS NOT NULL) OR
        (doc_map.url_col = 'vehicle_image_url' AND NEW.vehicle_image_url IS NOT NULL)
      ))
      OR
      (TG_OP = 'UPDATE' AND (
        (doc_map.url_col = 'profile_image_url' AND NEW.profile_image_url IS DISTINCT FROM OLD.profile_image_url AND NEW.profile_image_url IS NOT NULL) OR
        (doc_map.url_col = 'id_image_url' AND NEW.id_image_url IS DISTINCT FROM OLD.id_image_url AND NEW.id_image_url IS NOT NULL) OR
        (doc_map.url_col = 'id_image_back_url' AND NEW.id_image_back_url IS DISTINCT FROM OLD.id_image_back_url AND NEW.id_image_back_url IS NOT NULL) OR
        (doc_map.url_col = 'license_image_url' AND NEW.license_image_url IS DISTINCT FROM OLD.license_image_url AND NEW.license_image_url IS NOT NULL) OR
        (doc_map.url_col = 'license_image_back_url' AND NEW.license_image_back_url IS DISTINCT FROM OLD.license_image_back_url AND NEW.license_image_back_url IS NOT NULL) OR
        (doc_map.url_col = 'vehicle_image_url' AND NEW.vehicle_image_url IS DISTINCT FROM OLD.vehicle_image_url AND NEW.vehicle_image_url IS NOT NULL)
      ))
    ) THEN
      INSERT INTO driver_document_reviews (driver_id, document_type, status)
      VALUES (NEW.id, doc_map.doc_type, 'pending')
      ON CONFLICT (driver_id, document_type)
      DO UPDATE SET
        status = 'pending',
        rejection_reason = NULL,
        reviewed_by = NULL,
        reviewed_at = NULL,
        updated_at = now();
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_doc_reviews_on_driver_update
  AFTER INSERT OR UPDATE ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_driver_document_reviews();

-- دالة مراجعة الوثيقة من المدير
CREATE OR REPLACE FUNCTION public.review_driver_document(
  p_driver_id UUID,
  p_document_type driver_document_type,
  p_status document_review_status,
  p_rejection_reason TEXT DEFAULT NULL,
  p_expiry_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_all_approved BOOLEAN;
  v_any_rejected BOOLEAN;
  v_driver_name TEXT;
BEGIN
  -- التحقق من صلاحية المدير
  v_admin_id := auth.uid();
  IF NOT has_role(v_admin_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  -- تحديث حالة المراجعة
  INSERT INTO driver_document_reviews (driver_id, document_type, status, rejection_reason, reviewed_by, reviewed_at, expiry_date)
  VALUES (p_driver_id, p_document_type, p_status, p_rejection_reason, v_admin_id, now(), p_expiry_date)
  ON CONFLICT (driver_id, document_type)
  DO UPDATE SET
    status = EXCLUDED.status,
    rejection_reason = EXCLUDED.rejection_reason,
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    expiry_date = COALESCE(EXCLUDED.expiry_date, driver_document_reviews.expiry_date),
    updated_at = now();

  -- التحقق: هل كل الوثائق معتمدة؟
  SELECT
    (COUNT(*) FILTER (WHERE status = 'approved') = 6),
    (COUNT(*) FILTER (WHERE status = 'rejected') > 0)
  INTO v_all_approved, v_any_rejected
  FROM driver_document_reviews
  WHERE driver_id = p_driver_id;

  -- الموافقة التلقائية عند اكتمال مراجعة كل الوثائق
  IF v_all_approved THEN
    UPDATE drivers SET status = 'approved' WHERE id = p_driver_id AND status = 'pending';

    SELECT full_name INTO v_driver_name FROM drivers WHERE id = p_driver_id;

    INSERT INTO admin_notifications (title, body, type, data)
    VALUES (
      '✅ تمت الموافقة التلقائية على سائق',
      'تمت الموافقة على السائق ' || COALESCE(v_driver_name, '') || ' بعد اعتماد جميع وثائقه',
      'driver_approved',
      jsonb_build_object('driver_id', p_driver_id, 'auto_approved', true)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'all_approved', v_all_approved,
    'any_rejected', v_any_rejected
  );
END;
$$;

-- Realtime
ALTER TABLE public.driver_document_reviews REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_document_reviews;

-- ملء السجلات الأولية للسائقين الموجودين الذين لديهم وثائق مرفوعة
INSERT INTO driver_document_reviews (driver_id, document_type, status)
SELECT d.id, doc.doc_type, 
  CASE WHEN d.status = 'approved' THEN 'approved'::document_review_status ELSE 'pending'::document_review_status END
FROM drivers d
CROSS JOIN (VALUES
  ('profile_image'::driver_document_type),
  ('id_front'::driver_document_type),
  ('id_back'::driver_document_type),
  ('license_front'::driver_document_type),
  ('license_back'::driver_document_type),
  ('vehicle_image'::driver_document_type)
) AS doc(doc_type)
WHERE (
  (doc.doc_type = 'profile_image' AND d.profile_image_url IS NOT NULL) OR
  (doc.doc_type = 'id_front' AND d.id_image_url IS NOT NULL) OR
  (doc.doc_type = 'id_back' AND d.id_image_back_url IS NOT NULL) OR
  (doc.doc_type = 'license_front' AND d.license_image_url IS NOT NULL) OR
  (doc.doc_type = 'license_back' AND d.license_image_back_url IS NOT NULL) OR
  (doc.doc_type = 'vehicle_image' AND d.vehicle_image_url IS NOT NULL)
)
ON CONFLICT (driver_id, document_type) DO NOTHING;
