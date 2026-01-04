-- Create storage bucket for driver documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('driver-documents', 'driver-documents', false);

-- Admins can manage all driver documents
CREATE POLICY "Admins can manage driver documents" 
ON storage.objects
FOR ALL 
USING (bucket_id = 'driver-documents' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'driver-documents' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Drivers can view their own documents
CREATE POLICY "Drivers can view their own documents" 
ON storage.objects
FOR SELECT 
USING (bucket_id = 'driver-documents' AND (storage.foldername(name))[1] = auth.uid()::text);