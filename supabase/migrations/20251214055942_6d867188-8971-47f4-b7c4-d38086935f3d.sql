-- Add RLS policies for otp_verifications table
-- This table should be accessible only by the backend/edge functions using service role key
-- Regular users should not have direct access to OTP codes

-- Policy to prevent all direct access from regular users
-- OTP verification is handled through edge functions with service role
CREATE POLICY "OTP verifications are only accessible by service role"
ON public.otp_verifications
FOR ALL
USING (false)
WITH CHECK (false);