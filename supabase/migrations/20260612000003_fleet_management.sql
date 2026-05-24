-- ==========================================
-- نظام إدارة الأساطيل (Fleet Management)
-- ==========================================

-- جدول الأساطيل
CREATE TABLE public.fleets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_name TEXT,
  phone TEXT,
  email TEXT,
  commission_rate DECIMAL(5,2), -- NULL = استخدام النسبة الافتراضية للنظام
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_drivers INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- إضافة حقل fleet_id لجدول السائقين
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS fleet_id UUID REFERENCES public.fleets(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_drivers_fleet_id ON public.drivers(fleet_id);

-- ==========================================
-- Row Level Security
-- ==========================================

ALTER TABLE public.fleets ENABLE ROW LEVEL SECURITY;

-- الأدمن يدير كل الأساطيل
CREATE POLICY "admin_manages_fleets" ON public.fleets
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- السائق يرى أسطوله فقط
CREATE POLICY "drivers_see_own_fleet" ON public.fleets
  FOR SELECT USING (
    id IN (SELECT fleet_id FROM public.drivers WHERE user_id = auth.uid() AND fleet_id IS NOT NULL)
  );

-- ==========================================
-- دالة تحديث updated_at تلقائياً
-- ==========================================

CREATE OR REPLACE FUNCTION public.update_fleet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_fleet_updated_at
  BEFORE UPDATE ON public.fleets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fleet_updated_at();

-- ==========================================
-- إحصائيات الأسطول (View)
-- ==========================================

CREATE OR REPLACE VIEW public.fleet_stats
WITH (security_invoker = true)
AS
SELECT 
  f.id AS fleet_id,
  f.name,
  f.is_active,
  COUNT(d.id) AS total_drivers,
  COUNT(d.id) FILTER (WHERE d.is_online = true) AS online_drivers,
  COUNT(d.id) FILTER (WHERE d.status = 'approved') AS approved_drivers,
  COALESCE(SUM(d.total_rides), 0) AS total_rides,
  COALESCE(SUM(d.total_earnings), 0) AS total_earnings,
  COALESCE(AVG(d.rating), 0) AS avg_rating
FROM public.fleets f
LEFT JOIN public.drivers d ON d.fleet_id = f.id
GROUP BY f.id, f.name, f.is_active;

COMMENT ON VIEW public.fleet_stats IS 'Fleet statistics with driver counts - protected by RLS on fleets and drivers tables';
