-- Fix User Management: Add missing RLS policies and functions
-- This addresses the database error when creating new users

-- 1. Enable RLS on profiles table if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Create RLS policies for profiles table
-- Allow superusers to view all profiles
CREATE POLICY IF NOT EXISTS "Superusers can view all profiles" ON profiles
    FOR SELECT USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'superuser'
        OR id = auth.uid()
    );

-- Allow users to view profiles from their own agency
CREATE POLICY IF NOT EXISTS "Users can view profiles from their agency" ON profiles
    FOR SELECT USING (
        agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
        OR id = auth.uid()
        OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'superuser'
    );

-- Allow superusers to insert new profiles
CREATE POLICY IF NOT EXISTS "Superusers can insert profiles" ON profiles
    FOR INSERT WITH CHECK (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'superuser'
    );

-- Allow superusers to update profiles
CREATE POLICY IF NOT EXISTS "Superusers can update profiles" ON profiles
    FOR UPDATE USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'superuser'
    );

-- Allow users to update their own profile
CREATE POLICY IF NOT EXISTS "Users can update their own profile" ON profiles
    FOR UPDATE USING (
        id = auth.uid()
        OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'superuser'
    );

-- 3. Create the missing update_user_role function
CREATE OR REPLACE FUNCTION update_user_role(
    target_user_id UUID,
    new_role user_role,
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
        role = new_role,
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

-- 4. Create a function to handle automatic profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'agent')::user_role
    );
    RETURN NEW;
END;
$$;

-- 5. Create trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON auth.users TO authenticated;
GRANT ALL ON profiles TO authenticated;

-- 7. Create a helper function for superusers to create users with profiles
CREATE OR REPLACE FUNCTION create_user_with_profile(
    user_email TEXT,
    user_password TEXT,
    user_name TEXT,
    user_role user_role DEFAULT 'agent',
    user_agency_id UUID DEFAULT NULL,
    user_agency_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_user_id UUID;
BEGIN
    -- Check if the calling user is a superuser
    IF (SELECT role FROM profiles WHERE id = auth.uid()) != 'superuser' THEN
        RAISE EXCEPTION 'Only superusers can create users';
    END IF;
    
    -- Generate a new UUID for the user
    new_user_id := gen_random_uuid();
    
    -- Insert the profile record directly (auth.users will be handled by Supabase Auth)
    INSERT INTO profiles (id, email, name, role, agency_id, agency_name)
    VALUES (new_user_id, user_email, user_name, user_role, user_agency_id, user_agency_name);
    
    RETURN new_user_id;
END;
$$;