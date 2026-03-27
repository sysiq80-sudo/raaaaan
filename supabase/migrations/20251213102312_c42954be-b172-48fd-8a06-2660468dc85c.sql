-- Create app_settings table for storing application configuration
CREATE TABLE public.app_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage settings
CREATE POLICY "Admins can manage settings"
ON public.app_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Anyone can read settings (for app to function)
CREATE POLICY "Anyone can read settings"
ON public.app_settings
FOR SELECT
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.app_settings (key, value, description) VALUES
('general', '{"app_name": "رايد", "default_language": "ar", "maintenance_mode": false}', 'الإعدادات العامة'),
('notifications', '{"email": true, "sms": true, "push": true}', 'إعدادات الإشعارات'),
('rides', '{"max_search_radius": 5, "ride_timeout": 60, "cancellation_fee": 1000}', 'إعدادات الرحلات'),
('payments', '{"cash": true, "zain_cash": true, "asia_hawala": false, "qi_card": false}', 'طرق الدفع'),
('support', '{"email": "support@ride.iq", "phone": "+964 770 123 4567", "terms": "", "privacy": ""}', 'إعدادات الدعم');