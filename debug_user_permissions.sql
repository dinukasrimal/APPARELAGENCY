-- Debug script to check user permissions and RLS policies
-- Run this in your Supabase SQL Editor while logged in as superuser

-- 1. Check current user authentication
SELECT 
    auth.uid() as current_user_id,
    auth.jwt() as current_jwt;

-- 2. Check if current user exists in profiles table
SELECT 
    id,
    name,
    email,
    role,
    agency_id,
    agency_name,
    created_at
FROM profiles 
WHERE id = auth.uid();

-- 3. Check if RLS is enabled on profiles table
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'profiles';

-- 4. List all RLS policies on profiles table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles';

-- 5. Try to count all profiles (this should work for superuser)
SELECT COUNT(*) as total_profiles FROM profiles;

-- 6. Try to select a few profiles
SELECT 
    id,
    name,
    email,
    role,
    agency_name,
    created_at
FROM profiles 
ORDER BY created_at DESC 
LIMIT 5;

-- 7. Check if the user has the superuser role correctly set
SELECT 
    CASE 
        WHEN role = 'superuser' THEN 'User has superuser role ✓'
        ELSE 'User does NOT have superuser role ✗ (role: ' || role || ')'
    END as superuser_status
FROM profiles 
WHERE id = auth.uid();

-- 8. Test the RLS policy logic
SELECT 
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'superuser'
    ) as superuser_policy_check;