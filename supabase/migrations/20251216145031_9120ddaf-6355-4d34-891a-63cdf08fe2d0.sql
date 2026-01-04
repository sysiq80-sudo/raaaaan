-- Add gender column to drivers table
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female'));

-- Add comment
COMMENT ON COLUMN public.drivers.gender IS 'Driver gender: male or female';