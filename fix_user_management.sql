-- SQL script to fix user management database issues
-- Run this in your Supabase SQL Editor

-- 1. Enable RLS on profiles table if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing conflicting policies first
DROP POLICY IF EXISTS "Superusers can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles from their agency" ON profiles;
DROP POLICY IF EXISTS "Superusers can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Superusers can update profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- 3. Create comprehensive RLS policies for profiles table
-- Policy 1: Superusers can do everything
CREATE POLICY "Superusers full access" ON profiles
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'superuser'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'superuser'
        )
    );

-- Policy 2: Users can manage their own profile
CREATE POLICY "Users own profile access" ON profiles
    FOR ALL 
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Policy 3: Users can view profiles from their agency (SELECT only)
CREATE POLICY "Agency profiles view" ON profiles
    FOR SELECT 
    USING (
        agency_id = (
            SELECT agency_id FROM profiles 
            WHERE id = auth.uid()
        )
        AND (
            SELECT agency_id FROM profiles 
            WHERE id = auth.uid()
        ) IS NOT NULL
    );

-- 4. Create the missing update_user_role function
CREATE OR REPLACE FUNCTION update_user_role(
    target_user_id UUID,
    new_role TEXT,
    new_agency_id UUID DEFAULT NULL,
    new_agency_name TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if the calling user is a superuser
    IF (SELECT role FROM profiles WHERE id = auth.uid()) != 'superuser' THEN
        RAISE EXCEPTION 'Only superusers can update user roles';
    END IF;
    
    -- Update the user's role and agency information
    UPDATE profiles 
    SET 
        role = new_role::user_role,
        agency_id = new_agency_id,
        agency_name = new_agency_name,
        updated_at = NOW()
    WHERE id = target_user_id;
    
    -- Check if the update was successful
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;
END;
$$;

-- 5. Grant necessary permissions
GRANT ALL ON profiles TO authenticated;

-- Test the setup
SELECT 'Setup completed successfully' as status;

-- Check if profiles table structure is correct
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;