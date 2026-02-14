-- Check what tables exist in the database
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check if there are any user-related tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%user%' OR table_name LIKE '%rider%' OR table_name LIKE '%driver%'
ORDER BY table_name;

-- Check auth schema
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'auth'
ORDER BY table_name;