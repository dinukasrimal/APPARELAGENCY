-- ============================================================================
-- REMOVE duplicate INVOICES — v2 (handles auto-created delivery shells).
--
-- Every invoice auto-creates a "delivery" row (often with the invoice's GPS
-- copied in) even before anything is delivered. That shell must NOT block
-- deleting a duplicate. A delivery only counts as REAL when it has a
-- delivered_at timestamp OR a delivered/completed status. GPS alone = shell.
--
-- A duplicate is SAFE to delete when it has:
--   • no REAL delivery, • no payment (collection_allocations),
--   • no return, • no GRN, • no return_items.
-- For safe duplicates we remove: the shell delivery row(s), the invoice_items,
-- and the invoice itself.
--
-- Duplicates WITH a real delivery / payment / return / GRN are left alone and
-- listed by STEP 1b for manual handling.
--
-- Run STEP 1a + 1b (highlight each, skipping the comment lines), review, then
-- run STEP 2.  Do NOT run the whole file at once.
-- ============================================================================

-- helper predicate, inlined everywhere:
--   REAL delivery = EXISTS delivery with delivered_at OR status delivered/completed

-- ── STEP 1a: PREVIEW — duplicates that WILL be deleted ──────────────────────
WITH ranked AS (
  SELECT id, invoice_number, agency_id, trim(customer_name) AS customer, total, created_at,
    row_number() OVER (PARTITION BY agency_id, trim(customer_name), total ORDER BY created_at) AS rn,
    max(created_at) OVER (PARTITION BY agency_id, trim(customer_name), total)
      - min(created_at) OVER (PARTITION BY agency_id, trim(customer_name), total) AS span
  FROM invoices
),
dups AS (
  SELECT id, invoice_number, customer, total, created_at
  FROM ranked WHERE rn > 1 AND span <= INTERVAL '30 minutes'
)
SELECT d.*
FROM dups d
WHERE NOT EXISTS (SELECT 1 FROM deliveries dl WHERE dl.invoice_id::text = d.id::text
                    AND (dl.delivered_at IS NOT NULL OR lower(coalesce(dl.status,'')) IN ('delivered','completed')))
  AND NOT EXISTS (SELECT 1 FROM collection_allocations ca WHERE ca.invoice_id::text = d.id::text)
  AND NOT EXISTS (SELECT 1 FROM returns r WHERE r.invoice_id::text = d.id::text)
  AND NOT EXISTS (SELECT 1 FROM grns g    WHERE g.invoice_id::text = d.id::text)
  AND NOT EXISTS (SELECT 1 FROM return_items ri JOIN invoice_items ii ON ii.id::text = ri.invoice_item_id::text
                    WHERE ii.invoice_id = d.id)
ORDER BY d.customer, d.total, d.created_at;

-- ── STEP 1b: PREVIEW — duplicates KEPT for manual handling (why) ────────────
WITH ranked AS (
  SELECT id, invoice_number, agency_id, trim(customer_name) AS customer, total, created_at,
    row_number() OVER (PARTITION BY agency_id, trim(customer_name), total ORDER BY created_at) AS rn,
    max(created_at) OVER (PARTITION BY agency_id, trim(customer_name), total)
      - min(created_at) OVER (PARTITION BY agency_id, trim(customer_name), total) AS span
  FROM invoices
),
dups AS (
  SELECT id, invoice_number, customer, total, created_at
  FROM ranked WHERE rn > 1 AND span <= INTERVAL '30 minutes'
)
SELECT d.id, d.invoice_number, d.customer, d.total, d.created_at,
  EXISTS (SELECT 1 FROM deliveries dl WHERE dl.invoice_id::text = d.id::text
            AND (dl.delivered_at IS NOT NULL OR lower(coalesce(dl.status,'')) IN ('delivered','completed'))) AS real_delivery,
  EXISTS (SELECT 1 FROM collection_allocations ca WHERE ca.invoice_id::text = d.id::text) AS has_payment,
  EXISTS (SELECT 1 FROM returns r WHERE r.invoice_id::text = d.id::text)                  AS has_return,
  EXISTS (SELECT 1 FROM grns g    WHERE g.invoice_id::text = d.id::text)                  AS has_grn
FROM dups d
WHERE EXISTS (SELECT 1 FROM deliveries dl WHERE dl.invoice_id::text = d.id::text
                AND (dl.delivered_at IS NOT NULL OR lower(coalesce(dl.status,'')) IN ('delivered','completed')))
   OR EXISTS (SELECT 1 FROM collection_allocations ca WHERE ca.invoice_id::text = d.id::text)
   OR EXISTS (SELECT 1 FROM returns r WHERE r.invoice_id::text = d.id::text)
   OR EXISTS (SELECT 1 FROM grns g    WHERE g.invoice_id::text = d.id::text)
   OR EXISTS (SELECT 1 FROM return_items ri JOIN invoice_items ii ON ii.id::text = ri.invoice_item_id::text WHERE ii.invoice_id = d.id)
ORDER BY d.customer, d.total, d.created_at;


-- ── STEP 2: DELETE safe duplicates + their shell deliveries (transaction) ───
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
WHERE NOT EXISTS (SELECT 1 FROM deliveries dl WHERE dl.invoice_id::text = d.id::text
                    AND (dl.delivered_at IS NOT NULL OR lower(coalesce(dl.status,'')) IN ('delivered','completed')))
  AND NOT EXISTS (SELECT 1 FROM collection_allocations ca WHERE ca.invoice_id::text = d.id::text)
  AND NOT EXISTS (SELECT 1 FROM returns r WHERE r.invoice_id::text = d.id::text)
  AND NOT EXISTS (SELECT 1 FROM grns g    WHERE g.invoice_id::text = d.id::text)
  AND NOT EXISTS (SELECT 1 FROM return_items ri JOIN invoice_items ii ON ii.id::text = ri.invoice_item_id::text
                    WHERE ii.invoice_id = d.id);

DO $$
DECLARE
  n_inv int; n_items int; n_deliv int;
BEGIN
  SELECT count(*) INTO n_inv FROM _dup_invoices;

  DELETE FROM deliveries    WHERE invoice_id::text IN (SELECT id::text FROM _dup_invoices);
  GET DIAGNOSTICS n_deliv = ROW_COUNT;

  DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM _dup_invoices);
  GET DIAGNOSTICS n_items = ROW_COUNT;

  DELETE FROM invoices      WHERE id IN (SELECT id FROM _dup_invoices);

  RAISE NOTICE 'Deleted % duplicate invoices, % line items, % shell deliveries.',
    n_inv, n_items, n_deliv;
END $$;

COMMIT;

-- ── STEP 3: VERIFY — safe-to-delete duplicates remaining should be 0 ────────
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
SELECT count(*) AS safe_duplicates_left
FROM dups d
WHERE NOT EXISTS (SELECT 1 FROM deliveries dl WHERE dl.invoice_id::text = d.id::text
                    AND (dl.delivered_at IS NOT NULL OR lower(coalesce(dl.status,'')) IN ('delivered','completed')))
  AND NOT EXISTS (SELECT 1 FROM collection_allocations ca WHERE ca.invoice_id::text = d.id::text)
  AND NOT EXISTS (SELECT 1 FROM returns r WHERE r.invoice_id::text = d.id::text)
  AND NOT EXISTS (SELECT 1 FROM grns g    WHERE g.invoice_id::text = d.id::text)
  AND NOT EXISTS (SELECT 1 FROM return_items ri JOIN invoice_items ii ON ii.id::text = ri.invoice_item_id::text
                    WHERE ii.invoice_id = d.id);
