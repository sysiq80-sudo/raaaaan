-- إنشاء جدول طلبات تعديل بيانات السائقين
CREATE TABLE public.driver_edit_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  current_value TEXT,
  requested_value TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- تمكين RLS
ALTER TABLE public.driver_edit_requests ENABLE ROW LEVEL SECURITY;

-- سياسات RLS
-- السائقون يمكنهم إنشاء طلبات لأنفسهم
CREATE POLICY "Drivers can create their own edit requests"
ON public.driver_edit_requests
FOR INSERT
WITH CHECK (
  driver_id IN (
    SELECT id FROM public.drivers WHERE user_id = auth.uid()
  )
);

-- السائقون يمكنهم عرض طلباتهم فقط
CREATE POLICY "Drivers can view their own edit requests"
ON public.driver_edit_requests
FOR SELECT
USING (
  driver_id IN (
    SELECT id FROM public.drivers WHERE user_id = auth.uid()
  )
);

-- المشرفون يمكنهم إدارة جميع الطلبات
CREATE POLICY "Admins can manage all edit requests"
ON public.driver_edit_requests
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger لتحديث updated_at
CREATE TRIGGER update_driver_edit_requests_updated_at
BEFORE UPDATE ON public.driver_edit_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index للبحث السريع
CREATE INDEX idx_driver_edit_requests_driver_id ON public.driver_edit_requests(driver_id);
CREATE INDEX idx_driver_edit_requests_status ON public.driver_edit_requests(status);