-- Add API support columns to payment_accounts table
ALTER TABLE public.payment_accounts 
ADD COLUMN IF NOT EXISTS api_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS api_provider text,
ADD COLUMN IF NOT EXISTS api_config jsonb DEFAULT '{}';

-- Create payment_integrations table for future payment gateway integrations
CREATE TABLE IF NOT EXISTS public.payment_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name text NOT NULL,
  provider_code text NOT NULL UNIQUE,
  is_active boolean DEFAULT false,
  api_base_url text,
  webhook_url text,
  config jsonb DEFAULT '{}',
  supported_currencies text[] DEFAULT ARRAY['IQD'],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_integrations ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access only (using existing admin check pattern)
CREATE POLICY "Admins can manage payment integrations" 
ON public.payment_integrations 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_payment_integrations_updated_at
BEFORE UPDATE ON public.payment_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add some default integrations (inactive by default)
INSERT INTO public.payment_integrations (provider_name, provider_code, is_active, api_base_url)
VALUES 
  ('زين كاش API', 'zain_cash', false, 'https://api.zaincash.iq'),
  ('آسيا حوالة API', 'asia_hawala', false, null),
  ('فاست باي', 'fastpay', false, 'https://api.fastpay.iq'),
  ('ماستر كارد', 'mastercard', false, 'https://api.mastercard.com')
ON CONFLICT (provider_code) DO NOTHING;

COMMENT ON TABLE public.payment_integrations IS 'Payment gateway integrations for automated payment processing';