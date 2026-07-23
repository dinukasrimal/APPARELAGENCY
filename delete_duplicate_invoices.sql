-- ============================================================================
-- REMOVE duplicate INVOICES (connection-retry duplicates) — SAFE, STAGED.
--
-- A duplicate = a later invoice with the same agency + customer name + total as
-- an earlier one, created within 30 minutes of it (the retry signal).
--
-- SAFETY: an invoice is deleted ONLY if nothing else depends on it. If a
-- duplicate has a payment (collection_allocations), a return, a GRN, or a
-- delivery attached, it is SKIPPED and listed for you to handle by hand — those
-- links mean money/stock moved against that specific invoice and must not be
-- orphaned.
--
-- NOTE: reference columns (grns.invoice_id etc.) are a mix of text and uuid
-- types, so every dependency check casts BOTH sides to text.
--
-- Run STEP 1, review both lists, THEN run STEP 2.
-- ============================================================================

-- ── STEP 1a: PREVIEW — invoices that WILL be deleted (clean duplicates) ──────
WITH ranked AS (
  SELECT id, invoice_number, trim(customer_name) AS customer, total, created_at,
    row_number() OVER (PARTITION BY agency_id, trim(customer_name), total ORDER BY created_at) AS rn,
    max(created_at) OVER (PARTITION BY agency_id, trim(customer_name), total)
      - min(created_at) OVER (PARTITION BY agency_id, trim(customer_name), total) AS span
  FROM invoices
),
dups AS (
  SELECT id, invoice_number, customer, total, created_at
  FROM ranked
  WHERE rn > 1 AND span <= INTERVAL '30 minutes'
)
SELECT d.*
FROM dups d
WHERE NOT EXISTS (SELECT 1 FROM collection_allocations ca WHERE ca.invoice_id::text = d.id::text)
  AND NOT EXISTS (SELECT 1 FROM grns g        WHERE g.invoice_id::text = d.id::text)
  AND NOT EXISTS (SELECT 1 FROM returns r     WHERE r.invoice_id::text = d.id::text)
  AND NOT EXISTS (SELECT 1 FROM deliveries dl WHERE dl.invoice_id::text = d.id::text)
  AND NOT EXISTS (
    SELECT 1 FROM return_items ri
    JOIN invoice_items ii ON ii.id::text = ri.invoice_item_id::text
    WHERE ii.invoice_id = d.id
  )
ORDER BY d.customer, d.total, d.created_at;

-- ── STEP 1b: PREVIEW — duplicates SKIPPED because something depends on them ──
-- Handle these manually (they have a payment / return / GRN / delivery linked).
WITH ranked AS (
  SELECT id, invoice_number, trim(customer_name) AS customer, total, created_at,
    row_number() OVER (PARTITION BY agency_id, trim(customer_name), total ORDER BY created_at) AS rn,
    max(created_at) OVER (PARTITION BY agency_id, trim(customer_name), total)
      - min(created_at) OVER (PARTITION BY agency_id, trim(customer_name), total) AS span
  FROM invoices
),
dups AS (
  SELECT id, invoice_number, customer, total, created_at
  FROM ranked
  WHERE rn > 1 AND span <= INTERVAL '30 minutes'
)
SELECT d.id, d.invoice_number, d.customer, d.total, d.created_at,
  EXISTS (SELECT 1 FROM collection_allocations ca WHERE ca.invoice_id::text = d.id::text) AS has_payment,
  EXISTS (SELECT 1 FROM returns r     WHERE r.invoice_id::text = d.id::text)             AS has_return,
  EXISTS (SELECT 1 FROM grns g        WHERE g.invoice_id::text = d.id::text)             AS has_grn,
  EXISTS (SELECT 1 FROM deliveries dl WHERE dl.invoice_id::text = d.id::text)           AS has_delivery
FROM dups d
WHERE EXISTS (SELECT 1 FROM collection_allocations ca WHERE ca.invoice_id::text = d.id::text)
   OR EXISTS (SELECT 1 FROM grns g        WHERE g.invoice_id::text = d.id::text)
   OR EXISTS (SELECT 1 FROM returns r     WHERE r.invoice_id::text = d.id::text)
   OR EXISTS (SELECT 1 FROM deliveries dl WHERE dl.invoice_id::text = d.id::text)
   OR EXISTS (
     SELECT 1 FROM return_items ri
     JOIN invoice_items ii ON ii.id::text = ri.invoice_item_id::text
     WHERE ii.invoice_id = d.id
   )
ORDER BY d.customer, d.total, d.created_at;


-- ── STEP 2: DELETE the clean duplicates (transaction) ───────────────────────
-- Run this whole block. It prints how many it removed. If wrong, run ROLLBACK;
BEGIN;

CREATE TEMP TABLE _dup_invoices ON COMMIT DROP AS
WITH ranked AS (
  SELECT id, agency_id, trim(customer_name) AS customer, total, created_at,
    row_number() OVER (PARTITION BY agency_id, trim(customer_name), total ORDER BY created_at) AS rn,
    max(created_at) OVER (PARTITION BY agency_id, trim(customer_name), total)
      - min(created_at) OVER (PARTITION BY agency_id, trim(customer_name), total) AS span
  FROM invoices
),
dups AS (
  SELECT id FROM ranked WHERE rn > 1 AND span <= INTERVAL '30 minutes'
)
SELECT d.id
FROM dups d
WHERE NOT EXISTS (SELECT 1 FROM collection_allocations ca WHERE ca.invoice_id::text = d.id::text)
  AND NOT EXISTS (SELECT 1 FROM grns g        WHERE g.invoice_id::text = d.id::text)
  AND NOT EXISTS (SELECT 1 FROM returns r     WHERE r.invoice_id::text = d.id::text)
  AND NOT EXISTS (SELECT 1 FROM deliveries dl WHERE dl.invoice_id::text = d.id::text)
  AND NOT EXISTS (
    SELECT 1 FROM return_items ri
    JOIN invoice_items ii ON ii.id::text = ri.invoice_item_id::text
    WHERE ii.invoice_id = d.id
  );

DO $$
DECLARE
  n_inv int;
  n_items int;
BEGIN
  SELECT count(*) INTO n_inv FROM _dup_invoices;

  DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM _dup_invoices);
  GET DIAGNOSTICS n_items = ROW_COUNT;

  DELETE FROM invoices WHERE id IN (SELECT id FROM _dup_invoices);

  RAISE NOTICE 'Deleted % duplicate invoices and % of their line items.', n_inv, n_items;
END $$;

COMMIT;

-- ── STEP 3: VERIFY — clean duplicates remaining should be 0 ─────────────────
WITH ranked AS (
  SELECT id, agency_id, trim(customer_name) AS customer, total, created_at,
    row_number() OVER (PARTITION BY agency_id, trim(customer_name), total ORDER BY created_at) AS rn,
    max(created_at) OVER (PARTITION BY agency_id, trim(customer_name), total)
      - min(created_at) OVER (PARTITION BY agency_id, trim(customer_name), total) AS span
  FROM invoices
),
dups AS (
  SELECT id FROM ranked WHERE rn > 1 AND span <= INTERVAL '30 minutes'
)
SELECT count(*) AS clean_duplicates_left
FROM dups d
WHERE NOT EXISTS (SELECT 1 FROM collection_allocations ca WHERE ca.invoice_id::text = d.id::text)
  AND NOT EXISTS (SELECT 1 FROM grns g        WHERE g.invoice_id::text = d.id::text)
  AND NOT EXISTS (SELECT 1 FROM returns r     WHERE r.invoice_id::text = d.id::text)
  AND NOT EXISTS (SELECT 1 FROM deliveries dl WHERE dl.invoice_id::text = d.id::text)
  AND NOT EXISTS (
    SELECT 1 FROM return_items ri
    JOIN invoice_items ii ON ii.id::text = ri.invoice_item_id::text
    WHERE ii.invoice_id = d.id
  );
