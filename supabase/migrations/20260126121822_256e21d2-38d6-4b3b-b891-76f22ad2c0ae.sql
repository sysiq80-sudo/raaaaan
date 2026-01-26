-- Add nas_wallet to the payment_method enum if it doesn't exist
DO $$
BEGIN
  -- Check if the enum type exists and add the value
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'nas_wallet' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_method')
  ) THEN
    ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'nas_wallet';
  END IF;
  
  -- Also add nass if it's not there (for consistency)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'nass' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_method')
  ) THEN
    ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'nass';
  END IF;
END
$$;