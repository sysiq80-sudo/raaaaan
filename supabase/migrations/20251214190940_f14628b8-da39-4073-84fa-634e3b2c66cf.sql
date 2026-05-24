-- Insert default maps setting
INSERT INTO public.app_settings (key, value, description)
VALUES (
  'maps',
  '{"provider": "mapbox", "google_maps_configured": false}'::jsonb,
  'إعدادات مزود الخرائط - Mapbox أو Google Maps'
)
ON CONFLICT (key) DO NOTHING;