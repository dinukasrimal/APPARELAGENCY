-- Fix database trigger issues causing 500 error during user creation
-- This addresses missing columns and RLS policy conflicts

-- 1. First, let's temporarily disable RLS for profiles during trigger execution
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 2. Drop existing trigger to recreate with fixes
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Create improved trigger function with all required columns
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    -- Insert new profile with all required columns including updated_at
    INSERT INTO public.profiles (
        id,
        email,
        name,
        role,
        agency_id,
        agency_name,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'agent'::user_role),
        CASE 
            WHEN NEW.raw_user_meta_data->>'agency_id' IS NOT NULL 
            AND NEW.raw_user_meta_data->>'agency_id' != '' 
            THEN (NEW.raw_user_meta_data->>'agency_id')::uuid 
            ELSE NULL 
        END,
        NEW.raw_user_meta_data->>'agency_name',
        NOW(),
        NOW()  -- Add missing updated_at column
    );
    
    RETURN NEW;
EXCEPTION
    WHEN others THEN
        -- Enhanced error logging
        RAISE WARNING 'Failed to create profile for user % (email: %): % - %', 
            NEW.id, NEW.email, SQLSTATE, SQLERRM;
        
        -- Don't fail the auth creation, but log the detailed error
        INSERT INTO public.user_creation_errors (user_id, email, error_message, created_at)
        VALUES (NEW.id, NEW.email, SQLERRM, NOW())
        ON CONFLICT DO NOTHING;
        
        RETURN NEW;
END;
$$;

-- 4. Create error logging table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_creation_errors (
    id SERIAL PRIMARY KEY,
    user_id UUID,
    email TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Recreate the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- 6. Re-enable RLS with simplified policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Superusers can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Superusers can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Superusers can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Superusers can delete profiles" ON profiles;

-- Create simplified, working RLS policies
CREATE POLICY "Enable read access for users to their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Enable read access for superusers to all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'superuser'
        )
    );

CREATE POLICY "Enable insert for service role and superusers" ON profiles
    FOR INSERT WITH CHECK (
        -- Allow service role (for triggers)
        auth.role() = 'service_role'
        OR 
        -- Allow superusers
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'superuser'
        )
    );

CREATE POLICY "Enable update for users on their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Enable update for superusers on all profiles" ON profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'superuser'
        )
    );

-- 7. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.user_creation_errors TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO postgres, service_role;
GRANT SELECT ON auth.users TO postgres, service_role;

-- 8. Test the setup
SELECT 'Trigger fix completed - ready for testing' as status;