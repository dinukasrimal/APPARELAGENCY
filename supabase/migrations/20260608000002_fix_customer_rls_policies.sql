-- Fix customer RLS so authenticated users can manage customers for their agency.

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

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
SELECT
  auth_users.id,
  auth_users.email,
  COALESCE(auth_users.raw_user_meta_data->>'name', split_part(auth_users.email, '@', 1), 'Unknown User'),
  CASE
    WHEN auth_users.raw_user_meta_data->>'role' IN ('agency', 'superuser', 'agent')
      THEN (auth_users.raw_user_meta_data->>'role')::public.user_role
    ELSE 'agent'::public.user_role
  END,
  CASE
    WHEN COALESCE(auth_users.raw_user_meta_data->>'agency_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (auth_users.raw_user_meta_data->>'agency_id')::uuid
    ELSE NULL
  END,
  auth_users.raw_user_meta_data->>'agency_name',
  NOW(),
  NOW()
FROM auth.users auth_users
LEFT JOIN public.profiles profiles ON profiles.id = auth_users.id
WHERE profiles.id IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'Unknown User'),
    CASE
      WHEN NEW.raw_user_meta_data->>'role' IN ('agency', 'superuser', 'agent')
        THEN (NEW.raw_user_meta_data->>'role')::public.user_role
      ELSE 'agent'::public.user_role
    END,
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'agency_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (NEW.raw_user_meta_data->>'agency_id')::uuid
      ELSE NULL
    END,
    NEW.raw_user_meta_data->>'agency_name',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(public.profiles.name, EXCLUDED.name),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customers'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.customers', policy_record.policyname);
  END LOOP;
END;
$$;

CREATE POLICY "Users can view customers from their agency"
ON public.customers
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by = auth.uid()
    OR agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
  )
);

CREATE POLICY "Users can insert customers for their agency"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    created_by = auth.uid()
    OR agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
  )
);

CREATE POLICY "Users can update customers from their agency"
ON public.customers
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by = auth.uid()
    OR agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    created_by = auth.uid()
    OR agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
  )
);

CREATE POLICY "Users can delete customers from their agency"
ON public.customers
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by = auth.uid()
    OR agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
  )
);
