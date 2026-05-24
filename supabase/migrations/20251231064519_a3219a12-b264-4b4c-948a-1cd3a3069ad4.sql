-- Enable RLS on review_tags table
ALTER TABLE public.review_tags ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read active review tags (they're public reference data)
CREATE POLICY "Anyone can view active review tags"
ON public.review_tags
FOR SELECT
USING (is_active = true);

-- Only admins can manage review tags
CREATE POLICY "Admins can manage review tags"
ON public.review_tags
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add comment
COMMENT ON TABLE public.review_tags IS 'Reference tags for ride reviews - public read access for active tags, admin-only write access';