-- Debug agencies and user creation
-- Run this in your Supabase SQL Editor

-- 1. Check all agencies in the database
SELECT 
    id,
    name,
    address,
    phone,
    email,
    created_by,
    created_at
FROM agencies 
ORDER BY created_at DESC;

-- 2. Check profiles table structure
\d profiles;

-- 3. Check if there are any foreign key constraints between profiles and agencies
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name='profiles';

-- 4. Test creating a sample profile with agency
-- Replace 'your-agency-id' with actual agency ID from step 1
-- SELECT id FROM agencies LIMIT 1;

-- 5. Check current superuser profile
SELECT 
    id,
    name,
    email,
    role,
    agency_id,
    agency_name
FROM profiles 
WHERE role = 'superuser';

-- 6. Test if we can insert a profile (this should work if RLS is fixed)
-- Uncomment and replace with actual values:
/*
INSERT INTO profiles (
    id,
    name,
    email,
    role,
    agency_id,
    agency_name
) VALUES (
    gen_random_uuid(),
    'Test User',
    'test@example.com',
    'agency',
    (SELECT id FROM agencies LIMIT 1),
    (SELECT name FROM agencies LIMIT 1)
);
*/

SELECT 'Debug queries completed' as status;