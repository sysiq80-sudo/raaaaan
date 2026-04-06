-- Create app_tasks table for Development & Tasks tracking
CREATE TABLE IF NOT EXISTS public.app_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.app_tasks ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated admins
CREATE POLICY "Admins can view tasks"
    ON public.app_tasks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

-- Allow write access for authenticated admins
CREATE POLICY "Admins can insert tasks"
    ON public.app_tasks
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

CREATE POLICY "Admins can update tasks"
    ON public.app_tasks
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

CREATE POLICY "Admins can delete tasks"
    ON public.app_tasks
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

-- Insert initial tasks
INSERT INTO public.app_tasks (title, description, status, priority) VALUES 
('فلترة المسافة محلياً للإشعارات الوهمية (Phantom Notifications)', 'تمت إضافة تحري المسافة محلياً داخل المتصفح لسائقي التكسي عبر useDriverNotifications.', 'done', 'critical'),
('التحديث الذري لقبول الرحلة (Atomic Acceptance)', 'إنشاء دالة accept_ride_atomic لحل مشكلة السباق (Race Condition) عند قبول الرحلات في نفس اللحظة.', 'done', 'high'),
('الانتقال إلى PostGIS للخرائط (Scalability)', 'استخدام PostGIS من أجل الاستعلامات الجغرافية داخل دوال Edge Functions لتقليص استهلاك الذاكرة في الإنتاج الفعلي الكثيف.', 'todo', 'high'),
('تنظيف قنوات اتصال Realtime لتوفير الذاكرة', 'ضرورة التحقق من دمار القنوات supabase.removeChannel في كل مكونات التطبيق لتلافي استنزاف الموارد في Production.', 'todo', 'medium'),
('إنشاء طابور الحفظ دون إنترنت (Offline Sync Queue)', 'استخدام Background Sync أو حلول Capacitor لتخزين طلبات الراكب أثناء انقطاع الإنترنت وإعادة إرسالها بمجرد عودته.', 'todo', 'medium');

-- CREATE ATOMIC RPC for driver acceptance
CREATE OR REPLACE FUNCTION public.accept_ride_atomic(
  target_ride_id UUID, 
  acc_driver_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_affected INT;
  v_ride RECORD;
BEGIN
  -- We update ONLY IF status is still pending. 
  -- This creates an atomic lock that prevents race conditions.
  UPDATE public.rides 
  SET 
    status = 'accepted', 
    driver_id = acc_driver_id,
    updated_at = NOW()
  WHERE 
    id = target_ride_id 
    AND status = 'pending'
  RETURNING * INTO v_ride;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    -- It was either not pending, or ride ID doesn't exist.
    RETURN json_build_object(
      'success', false,
      'message', 'الرحلة لم تعد متوفرة. قد يكون سائق آخر قد قبلها.'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'تم قبول الرحلة بنجاح.',
    'ride', row_to_json(v_ride)
  );
END;
$$;
