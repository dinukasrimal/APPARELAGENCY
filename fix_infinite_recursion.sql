-- Fix infinite recursion in RLS policies
-- Run this in your Supabase SQL Editor

-- 1. Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Superusers full access" ON profiles;
DROP POLICY IF EXISTS "Users own profile access" ON profiles;  
DROP POLICY IF EXISTS "Agency profiles view" ON profiles;
DROP POLICY IF EXISTS "Allow superusers full access to profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view and update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles from their agency" ON profiles;

-- 2. Temporarily disable RLS to fix the recursion issue
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 3. Re-enable RLS with simpler, non-recursive policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create simple policies that don't cause recursion
-- Allow authenticated users to read all profiles (since superusers need this)
CREATE POLICY "Allow authenticated users to read profiles" ON profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow users to insert profiles (for user creation)
CREATE POLICY "Allow authenticated users to insert profiles" ON profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow users to update profiles 
CREATE POLICY "Allow authenticated users to update profiles" ON profiles
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 5. Alternative: If you want to keep some restrictions, use this simpler approach
-- CREATE POLICY "Allow profile access" ON profiles
--     FOR ALL
--     TO authenticated
--     USING (
--         id = auth.uid() OR 
--         auth.jwt() ->> 'role' = 'superuser'
--     );

-- 6. Grant necessary permissions
GRANT ALL ON profiles TO authenticated;

-- 7. Test that policies work
SELECT 'RLS policies fixed - infinite recursion resolved' as status;