-- Allow superusers to DELETE / UPDATE agencies (needed for the "Delete Agency" button).
-- Run in Supabase SQL Editor.
-- User deletion goes through the create-user Edge Function (service role) and does NOT
-- need an RLS policy — only agency deletion (which runs client-side) does.

-- DELETE policy: only superusers may delete agencies
DROP POLICY IF EXISTS "Superusers can delete agencies" ON agencies;
CREATE POLICY "Superusers can delete agencies"
ON agencies
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'superuser'
  )
);

-- UPDATE policy on profiles: superusers may unassign users from a deleted agency.
-- (Skip if you already have a superuser UPDATE policy on profiles.)
DROP POLICY IF EXISTS "Superusers can update profiles" ON profiles;
CREATE POLICY "Superusers can update profiles"
ON profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'superuser'
  )
);
