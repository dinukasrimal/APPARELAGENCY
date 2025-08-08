-- Fix existing agencies by creating corresponding profiles
-- Run this in your Supabase SQL Editor

-- 1. First, let's see agencies without corresponding profiles
SELECT 
    a.id as agency_id,
    a.name as agency_name,
    a.email as agency_email,
    'Missing Profile' as status
FROM agencies a
LEFT JOIN profiles p ON p.agency_id = a.id AND p.role = 'agency'
WHERE p.id IS NULL;

-- 2. Create profiles for existing agencies that don't have manager profiles
INSERT INTO profiles (
    id,
    name,
    email,
    role,
    agency_id,
    agency_name,
    created_at
)
SELECT 
    gen_random_uuid() as id,
    a.name || ' Manager' as name,
    a.email as email,
    'agency' as role,
    a.id as agency_id,
    a.name as agency_name,
    NOW() as created_at
FROM agencies a
LEFT JOIN profiles p ON p.agency_id = a.id AND p.role = 'agency'
WHERE p.id IS NULL;

-- 3. Verify the fix - show all agencies with their manager profiles
SELECT 
    a.id as agency_id,
    a.name as agency_name,
    a.email as agency_email,
    p.id as profile_id,
    p.name as manager_name,
    p.role as manager_role,
    'Profile Created' as status
FROM agencies a
LEFT JOIN profiles p ON p.agency_id = a.id AND p.role = 'agency'
ORDER BY a.name;

-- 4. Count results
SELECT 
    'Agencies: ' || COUNT(*) as agency_count
FROM agencies
UNION ALL
SELECT 
    'Agency Profiles: ' || COUNT(*) as profile_count
FROM profiles 
WHERE role = 'agency';

SELECT 'Fix completed - all agencies should now have manager profiles' as result;