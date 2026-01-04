-- Create component_templates table for storing reusable component templates
CREATE TABLE public.component_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  component_type TEXT NOT NULL,
  default_props JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_styles JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.component_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage component templates"
  ON public.component_templates
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active templates"
  ON public.component_templates
  FOR SELECT
  USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_component_templates_updated_at
  BEFORE UPDATE ON public.component_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default component templates
INSERT INTO public.component_templates (name, name_ar, category, component_type, default_props, default_styles) VALUES
('Search Bar', 'شريط البحث', 'input', 'search_bar', 
  '{"placeholder": "إلى أين تريد الذهاب؟", "showIcon": true}'::jsonb,
  '{"backgroundColor": "hsl(var(--background))", "borderRadius": "12px", "padding": "16px", "fontSize": "16px"}'::jsonb
),
('Booking Panel', 'لوحة الحجز', 'panel', 'booking_panel',
  '{"showVehicleSelector": true, "showPaymentMethod": true, "showEstimate": true}'::jsonb,
  '{"backgroundColor": "hsl(var(--card))", "borderRadius": "16px", "padding": "20px", "boxShadow": "0 4px 12px rgba(0,0,0,0.1)"}'::jsonb
),
('Vehicle Selector', 'اختيار السيارة', 'selector', 'vehicle_selector',
  '{"layout": "horizontal", "showPrice": true, "showETA": true}'::jsonb,
  '{"gap": "12px", "padding": "12px"}'::jsonb
),
('Driver Card', 'بطاقة السائق', 'card', 'driver_card',
  '{"showRating": true, "showVehicle": true, "showPhone": true}'::jsonb,
  '{"backgroundColor": "hsl(var(--card))", "borderRadius": "12px", "padding": "16px"}'::jsonb
),
('Map View', 'عرض الخريطة', 'map', 'map_view',
  '{"showControls": true, "showDriverMarkers": true, "zoomLevel": 15}'::jsonb,
  '{"height": "300px", "borderRadius": "12px"}'::jsonb
),
('Promo Banner', 'بانر العروض', 'banner', 'promo_banner',
  '{"autoPlay": true, "interval": 5000}'::jsonb,
  '{"height": "120px", "borderRadius": "12px", "margin": "16px 0"}'::jsonb
),
('Quick Places', 'أماكن سريعة', 'navigation', 'quick_places',
  '{"maxItems": 4, "showIcons": true}'::jsonb,
  '{"gap": "8px", "padding": "8px"}'::jsonb
),
('Bottom Navigation', 'التنقل السفلي', 'navigation', 'bottom_nav',
  '{"items": ["home", "rides", "payments", "settings"]}'::jsonb,
  '{"backgroundColor": "hsl(var(--background))", "height": "64px", "borderTop": "1px solid hsl(var(--border))"}'::jsonb
);