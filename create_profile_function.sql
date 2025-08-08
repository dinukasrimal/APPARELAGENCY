-- Create a function to safely create profiles without foreign key constraint issues
-- Run this in your Supabase SQL Editor

-- 1. First, let's check if profiles table has a default UUID generator
SELECT column_name, column_default, is_nullable, data_type
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'id';

-- 2. Create a function to safely insert profiles
CREATE OR REPLACE FUNCTION create_profile_with_uuid(
    profile_name TEXT,
    profile_email TEXT,
    profile_role user_role DEFAULT 'agent',
    profile_agency_id UUID DEFAULT NULL,
    profile_agency_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_profile_id UUID;
BEGIN
    -- Generate a new UUID
    new_profile_id := gen_random_uuid();
    
    -- Insert the profile
    INSERT INTO profiles (
        id,
        name,
        email,
        role,
        agency_id,
        agency_name,
        created_at
    ) VALUES (
        new_profile_id,
        profile_name,
        profile_email,
        profile_role,
        profile_agency_id,
        profile_agency_name,
        NOW()
    );
    
    RETURN new_profile_id;
    
EXCEPTION
    WHEN others THEN
        RAISE EXCEPTION 'Failed to create profile: %', SQLERRM;
END;
$$;

-- 3. Test the function
SELECT create_profile_with_uuid(
    'Test Profile Function',
    'test-func@example.com',
    'agent',
    NULL,
    NULL
) as created_profile_id;

-- Clean up test
DELETE FROM profiles WHERE email = 'test-func@example.com';

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION create_profile_with_uuid TO authenticated;

SELECT 'Profile creation function ready' as status;