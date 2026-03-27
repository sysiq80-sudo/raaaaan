-- Test saved_places functionality
-- Run this in Supabase SQL Editor

-- 1. Check if table exists and view structure
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM 
  information_schema.columns
WHERE 
  table_name = 'saved_places'
ORDER BY 
  ordinal_position;

-- 2. Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM 
  pg_policies
WHERE 
  tablename = 'saved_places';

-- 3. Check current user
SELECT auth.uid() as current_user_id;

-- 4. View all saved places for current user
SELECT * FROM saved_places WHERE user_id = auth.uid();

-- 5. Test insert (replace with actual user_id)
-- INSERT INTO saved_places (user_id, name, label, address, lat, lng, icon)
-- VALUES (
--   auth.uid(),
--   'منزلي',
--   'home',
--   'شارع الكندي، بغداد',
--   33.3152,
--   44.3661,
--   '🏠'
-- );

-- 6. Count saved places for current user
SELECT COUNT(*) as total_saved_places 
FROM saved_places 
WHERE user_id = auth.uid();
