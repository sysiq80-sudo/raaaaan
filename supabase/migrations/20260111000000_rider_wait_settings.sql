-- Migration: Rider Wait Settings System
-- Description: Create table to manage rider waiting screen settings from admin panel
-- Author: System
-- Date: 2026-01-11

-- Create rider_wait_settings table
CREATE TABLE IF NOT EXISTS public.rider_wait_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  max_wait_minutes INTEGER NOT NULL DEFAULT 10,
  search_messages JSONB NOT NULL DEFAULT '[
    {"text": "جاري البحث عن أفضل سائق لك...", "icon": "🔍"},
    {"text": "سائقونا في الطريق إليك...", "icon": "🚗"},
    {"text": "لحظات قليلة وسيتم إيجاد سائق...", "icon": "⏳"},
    {"text": "نبحث في منطقتك عن سائق متاح...", "icon": "📍"},
    {"text": "شكراً لصبرك، نحن نعمل على ذلك...", "icon": "💚"},
    {"text": "سيتم إعلامك فور قبول السائق...", "icon": "🔔"}
  ]'::jsonb,
  warning_message TEXT NOT NULL DEFAULT 'سيتم الإلغاء التلقائي قريباً',
  warning_threshold DECIMAL NOT NULL DEFAULT 0.8,
  auto_cancel_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_cancel_message TEXT NOT NULL DEFAULT 'لم يتم العثور على سائق متاح خلال الوقت المحدد',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Add comments
COMMENT ON TABLE public.rider_wait_settings IS 'Settings for rider waiting screen behavior and messages';
COMMENT ON COLUMN public.rider_wait_settings.max_wait_minutes IS 'Maximum wait time in minutes before auto-cancel';
COMMENT ON COLUMN public.rider_wait_settings.search_messages IS 'Array of encouraging messages shown during search';
COMMENT ON COLUMN public.rider_wait_settings.warning_message IS 'Message shown when approaching timeout';
COMMENT ON COLUMN public.rider_wait_settings.warning_threshold IS 'Percentage of max_wait_minutes to show warning (0.8 = 80%)';
COMMENT ON COLUMN public.rider_wait_settings.auto_cancel_enabled IS 'Whether to auto-cancel rides after timeout';
COMMENT ON COLUMN public.rider_wait_settings.auto_cancel_message IS 'Message shown when ride is auto-cancelled';

-- Insert default settings
INSERT INTO public.rider_wait_settings (id, max_wait_minutes, warning_threshold)
VALUES ('00000000-0000-0000-0000-000000000001', 10, 0.8)
ON CONFLICT (id) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rider_wait_settings_updated_at 
ON public.rider_wait_settings(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE public.rider_wait_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow admins to read settings
CREATE POLICY "Admins can read wait settings"
ON public.rider_wait_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Allow admins to update settings
CREATE POLICY "Admins can update wait settings"
ON public.rider_wait_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Allow all authenticated users to read settings (for rider app)
CREATE POLICY "All authenticated users can read wait settings"
ON public.rider_wait_settings
FOR SELECT
TO authenticated
USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_rider_wait_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS update_rider_wait_settings_timestamp ON public.rider_wait_settings;
CREATE TRIGGER update_rider_wait_settings_timestamp
  BEFORE UPDATE ON public.rider_wait_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_rider_wait_settings_timestamp();

-- Grant permissions
GRANT SELECT ON public.rider_wait_settings TO authenticated;
GRANT UPDATE ON public.rider_wait_settings TO authenticated;
