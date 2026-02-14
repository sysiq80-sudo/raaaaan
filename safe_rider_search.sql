-- Safe queries to search for rider without missing columns
-- Use these queries if there are missing columns

-- Search by phone only (safest)
SELECT
    id,
    user_id,
    full_name,
    phone,
    created_at,
    updated_at
FROM profiles
WHERE phone = '07734166402';

-- Search by name if known
-- SELECT * FROM profiles WHERE full_name LIKE '%rider name%';

-- Show all available columns in the table
SELECT
    column_name
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- Count riders with phone numbers
SELECT COUNT(*) as riders_with_phones
FROM profiles
WHERE phone IS NOT NULL AND phone != '';

-- Count all profiles
SELECT COUNT(*) as total_profiles
FROM profiles;