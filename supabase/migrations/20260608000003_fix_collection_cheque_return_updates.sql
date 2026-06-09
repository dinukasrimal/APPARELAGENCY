-- Allow cheque return lodgements to update and recover collection_cheques.

ALTER TABLE public.collection_cheques ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.collection_cheques
ADD COLUMN IF NOT EXISTS return_reason TEXT,
ADD COLUMN IF NOT EXISTS returned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS resolution_method TEXT,
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS replacement_for_cheque_id UUID REFERENCES public.collection_cheques(id) ON DELETE SET NULL;

ALTER TABLE public.collection_cheques
DROP CONSTRAINT IF EXISTS collection_cheques_status_check;

ALTER TABLE public.collection_cheques
ADD CONSTRAINT collection_cheques_status_check
CHECK (status IN ('pending', 'cleared', 'bounced', 'returned', 'held', 'resolved'));

DROP POLICY IF EXISTS "Users can view collection cheques for their agency" ON public.collection_cheques;
DROP POLICY IF EXISTS "Users can view cheques from their agency collections" ON public.collection_cheques;
DROP POLICY IF EXISTS "Users can insert collection cheques for their agency" ON public.collection_cheques;
DROP POLICY IF EXISTS "Users can insert cheques for their agency collections" ON public.collection_cheques;
DROP POLICY IF EXISTS "Users can update collection cheques for their agency" ON public.collection_cheques;
DROP POLICY IF EXISTS "Users can update cheques from their agency collections" ON public.collection_cheques;

CREATE POLICY "Users can view collection cheques for their agency"
ON public.collection_cheques
FOR SELECT
TO authenticated
USING (
  collection_id IN (
    SELECT collections.id
    FROM public.collections
    WHERE collections.agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
  )
);

CREATE POLICY "Users can insert collection cheques for their agency"
ON public.collection_cheques
FOR INSERT
TO authenticated
WITH CHECK (
  collection_id IN (
    SELECT collections.id
    FROM public.collections
    WHERE collections.agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
  )
);

CREATE POLICY "Users can update collection cheques for their agency"
ON public.collection_cheques
FOR UPDATE
TO authenticated
USING (
  collection_id IN (
    SELECT collections.id
    FROM public.collections
    WHERE collections.agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
  )
)
WITH CHECK (
  collection_id IN (
    SELECT collections.id
    FROM public.collections
    WHERE collections.agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
  )
);
