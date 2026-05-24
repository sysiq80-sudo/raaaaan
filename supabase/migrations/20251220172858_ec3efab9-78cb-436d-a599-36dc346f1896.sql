-- Create admin notifications table
CREATE TABLE public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can view and manage notifications
CREATE POLICY "Admins can manage notifications"
ON public.admin_notifications
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert notifications
CREATE POLICY "System can insert notifications"
ON public.admin_notifications
FOR INSERT
WITH CHECK (true);

-- Create function to check if driver documents are complete
CREATE OR REPLACE FUNCTION public.check_driver_documents_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  docs_complete BOOLEAN;
  was_complete BOOLEAN;
BEGIN
  -- Check if ALL documents are now present
  docs_complete := (
    NEW.profile_image_url IS NOT NULL AND
    NEW.id_image_url IS NOT NULL AND
    NEW.id_image_back_url IS NOT NULL AND
    NEW.license_image_url IS NOT NULL AND
    NEW.license_image_back_url IS NOT NULL AND
    NEW.vehicle_image_url IS NOT NULL AND
    NEW.vehicle_model IS NOT NULL AND
    NEW.vehicle_plate IS NOT NULL
  );
  
  -- Check if documents were already complete before
  was_complete := (
    OLD.profile_image_url IS NOT NULL AND
    OLD.id_image_url IS NOT NULL AND
    OLD.id_image_back_url IS NOT NULL AND
    OLD.license_image_url IS NOT NULL AND
    OLD.license_image_back_url IS NOT NULL AND
    OLD.vehicle_image_url IS NOT NULL AND
    OLD.vehicle_model IS NOT NULL AND
    OLD.vehicle_plate IS NOT NULL
  );
  
  -- Only notify if documents just became complete (not already complete before)
  IF docs_complete AND NOT was_complete AND NEW.status = 'pending' THEN
    INSERT INTO admin_notifications (title, body, type, data)
    VALUES (
      '📋 طلب سائق جديد جاهز للمراجعة',
      'السائق ' || NEW.full_name || ' أكمل رفع جميع الوثائق المطلوبة وبانتظار الموافقة',
      'driver_application',
      jsonb_build_object(
        'driver_id', NEW.id,
        'driver_name', NEW.full_name,
        'phone', NEW.phone,
        'vehicle_type', NEW.vehicle_type
      )
    );
    
    RAISE LOG 'Admin notification created for driver % documents complete', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER on_driver_documents_complete
AFTER UPDATE ON public.drivers
FOR EACH ROW
EXECUTE FUNCTION public.check_driver_documents_complete();

-- Enable realtime for admin notifications
ALTER TABLE public.admin_notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;