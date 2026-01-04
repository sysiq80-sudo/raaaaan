-- Add RLS policy for Admin to view all profiles
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- Add RLS policy for Admin to view all rides for stats (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'rides' 
        AND policyname = 'Admins can manage all rides'
    ) THEN
        CREATE POLICY "Admins can view all rides for stats" 
        ON public.rides 
        FOR SELECT 
        USING (public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;