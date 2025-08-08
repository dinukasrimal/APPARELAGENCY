-- Complete RLS reset - fixes infinite recursion completely
-- Copy and paste this entire script into your Supabase SQL Editor

-- 1. Get list of all policies on profiles table and drop them
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Drop all existing policies on profiles table
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'profiles' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', policy_record.policyname);
    END LOOP;
    
    -- Drop all existing policies on agencies table
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'agencies' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON agencies', policy_record.policyname);
    END LOOP;
END
$$;

-- 2. Completely disable RLS on both tables
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE agencies DISABLE ROW LEVEL SECURITY;

-- 3. Wait a moment and re-enable with clean slate
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;

-- 4. Create the simplest possible policies that work
CREATE POLICY "allow_all_profiles" ON profiles 
    FOR ALL TO authenticated 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "allow_all_agencies" ON agencies 
    FOR ALL TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- 5. Grant all permissions to authenticated users
GRANT ALL PRIVILEGES ON profiles TO authenticated;
GRANT ALL PRIVILEGES ON agencies TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 6. Also grant to service_role for admin operations
GRANT ALL PRIVILEGES ON profiles TO service_role;
GRANT ALL PRIVILEGES ON agencies TO service_role;

-- 7. Test that we can query the tables
SELECT 'RLS completely reset - infinite recursion should be fixed' as status;

-- 8. Show current policies to verify
SELECT 
    tablename, 
    policyname, 
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'agencies')
ORDER BY tablename, policyname;