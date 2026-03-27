-- Add status field to profiles for suspension
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Add constraint for status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_status_check'
  ) THEN
    ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_status_check CHECK (status IN ('active', 'suspended', 'banned'));
  END IF;
END $$;

-- Add current_location field to profiles for live tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS current_location jsonb DEFAULT NULL;

-- Handle duplicate emails by clearing older ones (keep the latest)
UPDATE public.profiles p1
SET email = NULL
WHERE email IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p2 
    WHERE p2.email = p1.email 
    AND p2.created_at > p1.created_at
  );

-- Handle duplicate phones by clearing older ones
UPDATE public.profiles p1
SET phone = NULL
WHERE phone IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p2 
    WHERE p2.phone = p1.phone 
    AND p2.created_at > p1.created_at
  );

-- Now create unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique ON public.profiles (phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique ON public.profiles (email) WHERE email IS NOT NULL;

-- Add policy for admins to delete profiles
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" 
ON public.profiles 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add policy for admins to update any profile (for suspension)
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for profiles to track location changes
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;