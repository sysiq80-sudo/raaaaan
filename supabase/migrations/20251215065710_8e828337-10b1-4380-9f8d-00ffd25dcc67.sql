-- Add email column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email text;

-- Update existing profiles with emails from auth.users
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.user_id = au.id
AND p.email IS NULL;

-- Update the handle_new_user function to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name, email)
    VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.email);
    RETURN NEW;
END;
$$;