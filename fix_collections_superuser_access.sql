-- Fix superuser access to collections
-- Run this in your Supabase SQL Editor

-- collections table
DROP POLICY IF EXISTS "Agency members can view their collections" ON collections;
DROP POLICY IF EXISTS "Agency members can insert collections" ON collections;
DROP POLICY IF EXISTS "Agency members can update collections" ON collections;
DROP POLICY IF EXISTS "authenticated_collections_select" ON collections;
DROP POLICY IF EXISTS "authenticated_collections_insert" ON collections;
DROP POLICY IF EXISTS "authenticated_collections_update" ON collections;

ALTER TABLE collections DISABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_collections_select" ON collections
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "authenticated_collections_insert" ON collections
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "authenticated_collections_update" ON collections
    FOR UPDATE TO authenticated
    USING (true);

GRANT ALL ON collections TO authenticated;

-- collection_cheques table
DROP POLICY IF EXISTS "Agency members can view their collection cheques" ON collection_cheques;
DROP POLICY IF EXISTS "authenticated_collection_cheques_select" ON collection_cheques;
DROP POLICY IF EXISTS "authenticated_collection_cheques_insert" ON collection_cheques;
DROP POLICY IF EXISTS "authenticated_collection_cheques_update" ON collection_cheques;

ALTER TABLE collection_cheques DISABLE ROW LEVEL SECURITY;
ALTER TABLE collection_cheques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_collection_cheques_select" ON collection_cheques
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "authenticated_collection_cheques_insert" ON collection_cheques
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "authenticated_collection_cheques_update" ON collection_cheques
    FOR UPDATE TO authenticated
    USING (true);

GRANT ALL ON collection_cheques TO authenticated;

-- collection_allocations table
DROP POLICY IF EXISTS "Agency members can view their collection allocations" ON collection_allocations;
DROP POLICY IF EXISTS "authenticated_collection_allocations_select" ON collection_allocations;
DROP POLICY IF EXISTS "authenticated_collection_allocations_insert" ON collection_allocations;
DROP POLICY IF EXISTS "authenticated_collection_allocations_update" ON collection_allocations;

ALTER TABLE collection_allocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE collection_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_collection_allocations_select" ON collection_allocations
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "authenticated_collection_allocations_insert" ON collection_allocations
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "authenticated_collection_allocations_update" ON collection_allocations
    FOR UPDATE TO authenticated
    USING (true);

GRANT ALL ON collection_allocations TO authenticated;

SELECT 'Collections RLS fixed - superuser can now see all agency collections' AS status;
