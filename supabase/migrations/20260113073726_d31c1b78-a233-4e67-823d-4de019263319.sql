-- Reset the used_at for recent password_reset OTP so user can try again
UPDATE otp_verifications 
SET used_at = NULL 
WHERE phone = '9647734166402' 
  AND purpose = 'password_reset' 
  AND verified = true
  AND created_at > NOW() - INTERVAL '10 minutes';