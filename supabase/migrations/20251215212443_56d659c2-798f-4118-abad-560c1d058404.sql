-- Phase 2.2: Fix Race Condition in ride acceptance
-- Use SELECT FOR UPDATE SKIP LOCKED to prevent multiple drivers accepting same ride

-- Create a secure function to accept a ride with proper locking
CREATE OR REPLACE FUNCTION public.accept_ride_safely(
  p_ride_id UUID,
  p_driver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ride rides%ROWTYPE;
  v_driver drivers%ROWTYPE;
BEGIN
  -- Check driver exists and is available
  SELECT * INTO v_driver
  FROM drivers
  WHERE id = p_driver_id
    AND user_id = auth.uid()
    AND status = 'approved'
    AND is_online = true
    AND is_available = true
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'السائق غير متاح أو غير مصرح');
  END IF;
  
  -- Try to lock and update the ride atomically
  -- SKIP LOCKED ensures other drivers trying simultaneously won't wait
  SELECT * INTO v_ride
  FROM rides
  WHERE id = p_ride_id
    AND status = 'pending'
    AND driver_id IS NULL
  FOR UPDATE SKIP LOCKED;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الرحلة تم قبولها من سائق آخر أو لم تعد متاحة');
  END IF;
  
  -- Update ride with driver
  UPDATE rides
  SET 
    driver_id = p_driver_id,
    status = 'accepted',
    matched_at = now(),
    updated_at = now()
  WHERE id = p_ride_id;
  
  -- Update driver availability
  UPDATE drivers
  SET is_available = false, updated_at = now()
  WHERE id = p_driver_id;
  
  -- Log the successful match
  INSERT INTO ride_matching_log (ride_id, driver_id, response, responded_at)
  VALUES (p_ride_id, p_driver_id, 'accepted', now())
  ON CONFLICT DO NOTHING;
  
  RETURN jsonb_build_object(
    'success', true, 
    'ride_id', p_ride_id,
    'driver_id', p_driver_id,
    'message', 'تم قبول الرحلة بنجاح'
  );
END;
$$;

-- Phase 4.1: Scheduled Rides feature
CREATE TABLE IF NOT EXISTS public.scheduled_rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL,
  pickup_location JSONB NOT NULL,
  pickup_address TEXT,
  dropoff_location JSONB NOT NULL,
  dropoff_address TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  vehicle_type vehicle_type DEFAULT 'economy',
  payment_method payment_method DEFAULT 'cash',
  estimated_fare INTEGER,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'processing', 'created', 'cancelled', 'expired')),
  ride_id UUID REFERENCES rides(id),
  reminder_sent BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_rides ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scheduled_rides
CREATE POLICY "Riders can view their own scheduled rides"
ON public.scheduled_rides
FOR SELECT
USING (auth.uid() = rider_id);

CREATE POLICY "Riders can create scheduled rides"
ON public.scheduled_rides
FOR INSERT
WITH CHECK (auth.uid() = rider_id);

CREATE POLICY "Riders can update their own scheduled rides"
ON public.scheduled_rides
FOR UPDATE
USING (auth.uid() = rider_id AND status IN ('scheduled', 'processing'));

CREATE POLICY "Riders can cancel their own scheduled rides"
ON public.scheduled_rides
FOR DELETE
USING (auth.uid() = rider_id AND status = 'scheduled');

CREATE POLICY "Admins can manage all scheduled rides"
ON public.scheduled_rides
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for efficient scheduled ride processing
CREATE INDEX IF NOT EXISTS idx_scheduled_rides_scheduled_at 
ON public.scheduled_rides(scheduled_at) 
WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_scheduled_rides_rider_id 
ON public.scheduled_rides(rider_id);

-- Trigger for updated_at
CREATE TRIGGER update_scheduled_rides_updated_at
BEFORE UPDATE ON public.scheduled_rides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();