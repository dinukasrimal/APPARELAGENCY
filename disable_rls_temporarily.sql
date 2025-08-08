-- Temporary RLS disable - for testing only
-- This completely disables RLS to test if that's the issue

-- Disable RLS on profiles table
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Disable RLS on agencies table  
ALTER TABLE agencies DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON agencies TO authenticated;

SELECT 'RLS completely disabled - test if this fixes the issue' as status;