-- Create saved_places table for user favorite locations
CREATE TABLE public.saved_places (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  label TEXT NOT NULL, -- 'home', 'work', 'other'
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  icon TEXT DEFAULT '📍',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_places ENABLE ROW LEVEL SECURITY;

-- Users can view their own saved places
CREATE POLICY "Users can view their own saved places"
ON public.saved_places
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own saved places
CREATE POLICY "Users can insert their own saved places"
ON public.saved_places
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own saved places
CREATE POLICY "Users can update their own saved places"
ON public.saved_places
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own saved places
CREATE POLICY "Users can delete their own saved places"
ON public.saved_places
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_saved_places_user_id ON public.saved_places(user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_saved_places_updated_at
BEFORE UPDATE ON public.saved_places
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();