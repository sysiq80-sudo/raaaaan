-- Add new columns for driver documents and images
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS vehicle_image_url TEXT;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS license_image_back_url TEXT;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS id_image_back_url TEXT;

-- Add comment to describe the columns
COMMENT ON COLUMN public.drivers.vehicle_image_url IS 'Full side photo of the vehicle';
COMMENT ON COLUMN public.drivers.profile_image_url IS 'Clear selfie photo of the driver';
COMMENT ON COLUMN public.drivers.license_image_back_url IS 'Back side of driver license';
COMMENT ON COLUMN public.drivers.id_image_back_url IS 'Back side of unified ID card';