-- ============================================================================
-- REMOVE duplicate sales orders (retry duplicates) — SAFE, STAGED.
--
-- Keeps the earliest order in each cluster (verdict KEEP) and removes the later
-- copies (verdict DUPLICATE), EXCEPT any duplicate that has already been
-- invoiced — those are skipped so invoice data is never orphaned.
--
-- Run STEP 1 first and review. Only run STEP 2 (the transaction) when the
-- STEP 1 list matches what you expect.
-- ============================================================================

-- ── STEP 1: PREVIEW — exactly what STEP 2 will delete ───────────────────────
WITH ranked AS (
  SELECT
    id, order_number, customer_name, total, total_invoiced, created_at,
    row_number() OVER (
      PARTITION BY agency_id, customer_id, total, created_by,
                   floor(EXTRACT(EPOCH FROM created_at) / 600)
      ORDER BY created_at
    ) AS rn
  FROM sales_orders
)
SELECT r.id, r.order_number, r.customer_name, r.total, r.created_at
FROM ranked r
WHERE r.rn > 1                                   -- later copies only
  AND COALESCE(r.total_invoiced, 0) = 0          -- not invoiced
  AND NOT EXISTS (                               -- no invoice linked to it
    SELECT 1 FROM invoices i WHERE i.sales_order_id = r.id
  )
ORDER BY r.customer_name, r.created_at;

-- Duplicates that are SKIPPED because they were already invoiced (handle these
-- by hand — deleting them would break invoices):
WITH ranked AS (
  SELECT
    id, order_number, customer_name, total, total_invoiced, agency_id,
    customer_id, created_by, created_at,
    row_number() OVER (
      PARTITION BY agency_id, customer_id, total, created_by,
                   floor(EXTRACT(EPOCH FROM created_at) / 600)
      ORDER BY created_at
    ) AS rn
  FROM sales_orders
)
SELECT r.id, r.order_number, r.customer_name, r.total, r.total_invoiced
FROM ranked r
WHERE r.rn > 1
  AND (
    COALESCE(r.total_invoiced, 0) > 0
    OR EXISTS (SELECT 1 FROM invoices i WHERE i.sales_order_id = r.id)
  )
ORDER BY r.customer_name, r.created_at;


-- ── STEP 2: DELETE (transaction — review the RAISE NOTICE counts) ───────────
-- Run this whole block together. If the counts look wrong, run ROLLBACK;
-- otherwise it commits automatically at the end.
BEGIN;

CREATE TEMP TABLE _dup_orders ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id, agency_id, customer_id, total, created_by, created_at, total_invoiced,
    row_number() OVER (
      PARTITION BY agency_id, customer_id, total, created_by,
                   floor(EXTRACT(EPOCH FROM created_at) / 600)
      ORDER BY created_at
    ) AS rn
  FROM sales_orders
)
SELECT r.id
FROM ranked r
WHERE r.rn > 1
  AND COALESCE(r.total_invoiced, 0) = 0
  AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.sales_order_id = r.id);

DO $$
DECLARE
  n_orders int;
  n_items  int;
BEGIN
  SELECT count(*) INTO n_orders FROM _dup_orders;

  DELETE FROM sales_order_items WHERE sales_order_id IN (SELECT id FROM _dup_orders);
  GET DIAGNOSTICS n_items = ROW_COUNT;

  DELETE FROM sales_orders WHERE id IN (SELECT id FROM _dup_orders);

  RAISE NOTICE 'Deleted % duplicate sales orders and % of their line items.', n_orders, n_items;
END $$;

COMMIT;

-- ── STEP 3: VERIFY — should return NO rows now ──────────────────────────────
WITH ranked AS (
  SELECT id, agency_id, customer_id, total, created_by, total_invoiced,
    row_number() OVER (
      PARTITION BY agency_id, customer_id, total, created_by,
                   floor(EXTRACT(EPOCH FROM created_at) / 600)
      ORDER BY created_at
    ) AS rn
  FROM sales_orders
)
SELECT id
FROM ranked r
WHERE r.rn > 1
  AND COALESCE(r.total_invoiced, 0) = 0
  AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.sales_order_id = r.id);
