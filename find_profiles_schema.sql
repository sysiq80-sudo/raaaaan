-- Find which schema contains profiles table
SELECT 
    table_schema,
    table_name,
    table_type
FROM information_schema.tables
WHERE table_name = 'profiles';

-- Show all columns in profiles table (any schema)
SELECT 
    table_schema,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY table_schema, ordinal_position;

-- Search for rider by phone (without schema prefix)
SELECT 
    id,
    user_id,
    full_name,
    phone,
    email,
    status,
    created_at
FROM profiles 
WHERE phone = '07734166402';

-- Count all profiles
SELECT COUNT(*) as total_profiles FROM profiles;

-- Count profiles with phone numbers
SELECT COUNT(*) as profiles_with_phone 
FROM profiles 
WHERE phone IS NOT NULL AND phone != '';