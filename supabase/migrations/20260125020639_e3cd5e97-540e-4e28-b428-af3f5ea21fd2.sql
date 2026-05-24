-- Fix storage policies for driver-documents bucket
-- First, ensure the bucket exists and is properly configured
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-documents', 'driver-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Drivers can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Drivers can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Drivers can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view driver documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all driver documents" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_update" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_select" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_delete" ON storage.objects;

-- Create new policies for driver-documents bucket
-- Allow authenticated users to upload to their own folder (using their driver ID)
CREATE POLICY "driver_documents_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'driver-documents' AND
  (
    -- Allow drivers to upload to their own folder (driver.id as folder name)
    EXISTS (
      SELECT 1 FROM public.drivers d 
      WHERE d.user_id = auth.uid() 
      AND (storage.foldername(name))[1] = d.id::text
    )
    OR
    -- Allow admins to upload anywhere
    public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Allow authenticated users to update their own documents
CREATE POLICY "driver_documents_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'driver-documents' AND
  (
    EXISTS (
      SELECT 1 FROM public.drivers d 
      WHERE d.user_id = auth.uid() 
      AND (storage.foldername(name))[1] = d.id::text
    )
    OR
    public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Allow public read access for driver documents (needed for displaying images)
CREATE POLICY "driver_documents_select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'driver-documents');

-- Allow drivers to delete their own documents and admins to delete any
CREATE POLICY "driver_documents_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'driver-documents' AND
  (
    EXISTS (
      SELECT 1 FROM public.drivers d 
      WHERE d.user_id = auth.uid() 
      AND (storage.foldername(name))[1] = d.id::text
    )
    OR
    public.has_role(auth.uid(), 'admin'::app_role)
  )
);