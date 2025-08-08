-- Fix user creation issues
-- Run this in your Supabase SQL Editor

-- 1. Ensure profiles table has all necessary columns
-- Check current structure
\d profiles;

-- 2. Make sure we have the handle_new_user function with proper error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    -- Insert new profile with data from auth metadata
    INSERT INTO public.profiles (
        id,
        email,
        name,
        role,
        agency_id,
        agency_name,
        created_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'agent'::user_role),
        CASE 
            WHEN NEW.raw_user_meta_data->>'agency_id' != '' 
            THEN (NEW.raw_user_meta_data->>'agency_id')::uuid 
            ELSE NULL 
        END,
        NEW.raw_user_meta_data->>'agency_name',
        NOW()
    );
    
    RETURN NEW;
EXCEPTION
    WHEN others THEN
        -- Log the error but don't fail the auth creation
        RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- 3. Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- 4. Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
GRANT ALL ON auth.users TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, anon, authenticated, service_role;

-- 5. Create a test function that superusers can use to create users
CREATE OR REPLACE FUNCTION create_user_safely(
    user_email TEXT,
    user_name TEXT,
    user_role user_role DEFAULT 'agent',
    user_agency_id UUID DEFAULT NULL,
    user_agency_name TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result_message TEXT;
    new_user_id UUID;
BEGIN
    -- Check if calling user is superuser
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'superuser'
    ) THEN
        RETURN 'ERROR: Only superusers can create users';
    END IF;
    
    -- Generate UUID for new user
    new_user_id := gen_random_uuid();
    
    -- Create profile first
    INSERT INTO profiles (
        id,
        email,
        name,
        role,
        agency_id,
        agency_name,
        created_at
    ) VALUES (
        new_user_id,
        user_email,
        user_name,
        user_role,
        user_agency_id,
        user_agency_name,
        NOW()
    );
    
    result_message := 'SUCCESS: Profile created with ID ' || new_user_id::TEXT;
    RETURN result_message;
    
EXCEPTION
    WHEN others THEN
        RETURN 'ERROR: ' || SQLERRM;
END;
$$;

-- Test the setup
SELECT 'User creation setup completed' as status;