-- Fix the foreign key constraint issue for profiles table
-- Run this in your Supabase SQL Editor

-- 1. Check what foreign key constraints exist on profiles table
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
AND tc.table_name = 'profiles';

-- 2. Drop the foreign key constraint that's causing the issue
-- This constraint requires profiles.id to exist in auth.users
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- 3. Alternative: Make the constraint deferrable (less aggressive)
-- ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey 
--     FOREIGN KEY (id) REFERENCES auth.users(id) 
--     DEFERRABLE INITIALLY DEFERRED;

-- 4. Verify the constraint is removed
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    'After Fix' as status
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'profiles';

-- 5. Test that we can now insert a profile with a custom UUID
-- This should work after removing the constraint
INSERT INTO profiles (
    id,
    name,
    email,
    role,
    agency_id,
    agency_name,
    created_at
) VALUES (
    gen_random_uuid(),
    'Test Profile',
    'test-profile@example.com',
    'agent',
    NULL,
    NULL,
    NOW()
);

-- Clean up the test record
DELETE FROM profiles WHERE email = 'test-profile@example.com';

SELECT 'Foreign key constraint fix completed' as result;