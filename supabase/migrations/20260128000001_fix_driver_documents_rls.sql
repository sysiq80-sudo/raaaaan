-- Fix RLS policies for driver-documents bucket to allow uploads during registration
-- Problem: The current policy expects driver.id as folder name, but the code uses user_id

-- Drop existing policies
DROP POLICY IF EXISTS "driver_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_update" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_select" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_delete" ON storage.objects;

-- Create new upload policy: Allow authenticated users to upload to their own user_id folder
CREATE POLICY "driver_documents_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'driver-documents' AND
  (
    -- Allow users to upload to their own user_id folder
    (storage.foldername(name))[1] = auth.uid()::text
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
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Allow public read access (needed for displaying images in admin panel)
CREATE POLICY "driver_documents_select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'driver-documents');

-- Allow users to delete their own documents
CREATE POLICY "driver_documents_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'driver-documents' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Also fix the drivers table RLS for SELECT during registration check
DROP POLICY IF EXISTS "drivers_read_own" ON drivers;
DROP POLICY IF EXISTS "Drivers can view their own data" ON drivers;

-- Allow drivers to read their own record by user_id
CREATE POLICY "drivers_read_own"
ON drivers FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR 
  public.has_role(auth.uid(), 'admin'::app_role)
);
