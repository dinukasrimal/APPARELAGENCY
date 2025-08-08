-- Simple fix for user management - run this in Supabase SQL Editor
-- This creates basic working policies without complex functions

-- 1. Disable RLS temporarily to fix any issues
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 2. Re-enable RLS with simple policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Drop any existing conflicting policies
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON profiles;
DROP POLICY IF EXISTS "Allow authenticated users to insert profiles" ON profiles;
DROP POLICY IF EXISTS "Allow authenticated users to update profiles" ON profiles;
DROP POLICY IF EXISTS "Superusers full access" ON profiles;
DROP POLICY IF EXISTS "Users own profile access" ON profiles;
DROP POLICY IF EXISTS "Agency profiles view" ON profiles;

-- 4. Create simple working policies
CREATE POLICY "authenticated_select" ON profiles 
    FOR SELECT TO authenticated 
    USING (true);

CREATE POLICY "authenticated_insert" ON profiles 
    FOR INSERT TO authenticated 
    WITH CHECK (true);

CREATE POLICY "authenticated_update" ON profiles 
    FOR UPDATE TO authenticated 
    USING (true);

-- 5. Grant permissions
GRANT ALL ON profiles TO authenticated;

-- Done
SELECT 'Simple policies created successfully' as status;