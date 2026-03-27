-- Create table for rider page layouts
CREATE TABLE public.rider_page_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  layout_type TEXT NOT NULL DEFAULT 'classic',
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  route_path TEXT NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rider_page_layouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active layouts"
ON public.rider_page_layouts
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage layouts"
ON public.rider_page_layouts
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Insert default layouts
INSERT INTO public.rider_page_layouts (name, display_name, description, layout_type, is_active, is_default, route_path, settings)
VALUES 
  ('unified', 'الواجهة الموحدة', 'واجهة حديثة مع خريطة كاملة وبحث مدمج', 'unified', true, true, '/rider', '{"showMap": true, "showDriversCount": true}'),
  ('classic', 'الواجهة الكلاسيكية', 'واجهة ترحيبية مع شاشة بحث منفصلة', 'classic', true, false, '/rider2', '{"showWelcome": true, "showSearch": true}');

-- Create trigger for updated_at
CREATE TRIGGER update_rider_page_layouts_updated_at
BEFORE UPDATE ON public.rider_page_layouts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one default layout
CREATE OR REPLACE FUNCTION ensure_single_default_layout()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.rider_page_layouts
    SET is_default = false
    WHERE id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER ensure_single_default_rider_layout
BEFORE INSERT OR UPDATE ON public.rider_page_layouts
FOR EACH ROW
WHEN (NEW.is_default = true)
EXECUTE FUNCTION ensure_single_default_layout();