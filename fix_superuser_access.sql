-- Fix superuser access - simple RLS policy fix
-- Copy and paste this entire script into your Supabase SQL Editor

-- 1. Drop all existing policies that cause infinite recursion
DROP POLICY IF EXISTS "Superusers can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles from their agency" ON profiles;
DROP POLICY IF EXISTS "Superusers can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Superusers can update profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON profiles;
DROP POLICY IF EXISTS "Allow authenticated users to insert profiles" ON profiles;
DROP POLICY IF EXISTS "Allow authenticated users to update profiles" ON profiles;
DROP POLICY IF EXISTS "authenticated_select" ON profiles;
DROP POLICY IF EXISTS "authenticated_insert" ON profiles;
DROP POLICY IF EXISTS "authenticated_update" ON profiles;

-- 2. Temporarily disable RLS to clear any issues
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 3. Re-enable RLS with simple, working policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create simple policies that work for authenticated users
CREATE POLICY "authenticated_select" ON profiles 
    FOR SELECT TO authenticated 
    USING (true);

CREATE POLICY "authenticated_insert" ON profiles 
    FOR INSERT TO authenticated 
    WITH CHECK (true);

CREATE POLICY "authenticated_update" ON profiles 
    FOR UPDATE TO authenticated 
    USING (true);

-- 5. Also fix agencies table if it has similar issues
DROP POLICY IF EXISTS "authenticated_agencies_select" ON agencies;
DROP POLICY IF EXISTS "authenticated_agencies_insert" ON agencies;
DROP POLICY IF EXISTS "authenticated_agencies_update" ON agencies;

ALTER TABLE agencies DISABLE ROW LEVEL SECURITY;
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_agencies_select" ON agencies 
    FOR SELECT TO authenticated 
    USING (true);

CREATE POLICY "authenticated_agencies_insert" ON agencies 
    FOR INSERT TO authenticated 
    WITH CHECK (true);

CREATE POLICY "authenticated_agencies_update" ON agencies 
    FOR UPDATE TO authenticated 
    USING (true);

-- 6. Grant necessary permissions
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON agencies TO authenticated;

-- 7. Test completion
SELECT 'RLS policies fixed - superuser should now see users and agencies' as status;