-- ============================================================================
-- REMOVE duplicate INVOICES — v3 (keeps the REAL one, not just the earliest).
--
-- Problem with v2: it always kept the earliest invoice in a cluster. But often
-- the LATER copy is the one that was actually delivered / paid, while the
-- earlier copy is the undelivered shell. v2 then protected the real (later) one
-- and never deleted the shell — so both survived (e.g. A.M. SELECTION IMA021 +
-- IMA022).
--
-- v3 picks the KEEPER per cluster by importance:
--     1. a real delivery (delivered_at set OR status delivered/completed)
--     2. else a payment (collection_allocations)
--     3. else the earliest.
-- Every OTHER copy in the cluster is deleted — but only if that copy is itself
-- clean (no real delivery, no payment, no return, no GRN, no return_items).
-- Its auto-created shell delivery is removed with it.
--
-- Cluster = same agency + customer name + total, all within 30 minutes.
--
-- Run STEP 1 (preview), review, then STEP 2. Highlight each block WITHOUT the
-- leading comment lines. Do NOT run the whole file at once.
-- ============================================================================

-- Shared flags CTE is repeated inline in each statement below.

-- ── STEP 1: PREVIEW — per cluster, who is KEPT and who gets DELETED ──────────
WITH inv AS (
  SELECT i.id, i.invoice_number, i.agency_id, trim(i.customer_name) AS customer,
         i.total, i.created_at,
    EXISTS (SELECT 1 FROM deliveries dl WHERE dl.invoice_id::text = i.id::text
              AND (dl.delivered_at IS NOT NULL OR lower(coalesce(dl.status,'')) IN ('delivered','completed'))) AS real_delivery,
    EXISTS (SELECT 1 FROM collection_allocations ca WHERE ca.invoice_id::text = i.id::text) AS has_payment,
    EXISTS (SELECT 1 FROM returns r WHERE r.invoice_id::text = i.id::text) AS has_return,
    EXISTS (SELECT 1 FROM grns g    WHERE g.invoice_id::text = i.id::text) AS has_grn,
    EXISTS (SELECT 1 FROM return_items ri JOIN invoice_items ii ON ii.id::text = ri.invoice_item_id::text
              WHERE ii.invoice_id = i.id) AS has_return_item
  FROM invoices i
),
clustered AS (
  SELECT *,
    count(*)        OVER w AS cluster_size,
    max(created_at) OVER w - min(created_at) OVER w AS span,
    row_number() OVER (PARTITION BY agency_id, customer, total
                       ORDER BY real_delivery DESC, has_payment DESC, created_at ASC) AS keep_rank
  FROM inv
  WINDOW w AS (PARTITION BY agency_id, customer, total)
)
SELECT invoice_number, customer, total, created_at,
       real_delivery, has_payment,
       CASE
         WHEN keep_rank = 1 THEN 'KEEP'
         WHEN NOT (real_delivery OR has_payment OR has_return OR has_grn OR has_return_item) THEN 'DELETE'
         ELSE 'SKIP (needs manual — has its own delivery/payment)'
       END AS action
FROM clustered
WHERE cluster_size > 1 AND span <= INTERVAL '30 minutes'
ORDER BY customer, total, created_at;


-- ── STEP 2: DELETE the non-keeper clean copies + their shell deliveries ─────
BEGIN;

CREATE TEMP TABLE _dup_invoices ON COMMIT DROP AS
WITH inv AS (
  SELECT i.id, i.agency_id, trim(i.customer_name) AS customer, i.total, i.created_at,
    EXISTS (SELECT 1 FROM deliveries dl WHERE dl.invoice_id::text = i.id::text
              AND (dl.delivered_at IS NOT NULL OR lower(coalesce(dl.status,'')) IN ('delivered','completed'))) AS real_delivery,
    EXISTS (SELECT 1 FROM collection_allocations ca WHERE ca.invoice_id::text = i.id::text) AS has_payment,
    EXISTS (SELECT 1 FROM returns r WHERE r.invoice_id::text = i.id::text) AS has_return,
    EXISTS (SELECT 1 FROM grns g    WHERE g.invoice_id::text = i.id::text) AS has_grn,
    EXISTS (SELECT 1 FROM return_items ri JOIN invoice_items ii ON ii.id::text = ri.invoice_item_id::text
              WHERE ii.invoice_id = i.id) AS has_return_item
  FROM invoices i
),
clustered AS (
  SELECT *,
    count(*)        OVER w AS cluster_size,
    max(created_at) OVER w - min(created_at) OVER w AS span,
    row_number() OVER (PARTITION BY agency_id, customer, total
                       ORDER BY real_delivery DESC, has_payment DESC, created_at ASC) AS keep_rank
  FROM inv
  WINDOW w AS (PARTITION BY agency_id, customer, total)
)
SELECT id
FROM clustered
WHERE cluster_size > 1
  AND span <= INTERVAL '30 minutes'
  AND keep_rank > 1
  AND NOT (real_delivery OR has_payment OR has_return OR has_grn OR has_return_item);

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

-- ── STEP 3: VERIFY — deletable duplicates remaining should be 0 ─────────────
WITH inv AS (
  SELECT i.id, i.agency_id, trim(i.customer_name) AS customer, i.total, i.created_at,
    EXISTS (SELECT 1 FROM deliveries dl WHERE dl.invoice_id::text = i.id::text
              AND (dl.delivered_at IS NOT NULL OR lower(coalesce(dl.status,'')) IN ('delivered','completed'))) AS real_delivery,
    EXISTS (SELECT 1 FROM collection_allocations ca WHERE ca.invoice_id::text = i.id::text) AS has_payment,
    EXISTS (SELECT 1 FROM returns r WHERE r.invoice_id::text = i.id::text) AS has_return,
    EXISTS (SELECT 1 FROM grns g    WHERE g.invoice_id::text = i.id::text) AS has_grn,
    EXISTS (SELECT 1 FROM return_items ri JOIN invoice_items ii ON ii.id::text = ri.invoice_item_id::text
              WHERE ii.invoice_id = i.id) AS has_return_item
  FROM invoices i
),
clustered AS (
  SELECT *,
    count(*)        OVER w AS cluster_size,
    max(created_at) OVER w - min(created_at) OVER w AS span,
    row_number() OVER (PARTITION BY agency_id, customer, total
                       ORDER BY real_delivery DESC, has_payment DESC, created_at ASC) AS keep_rank
  FROM inv
  WINDOW w AS (PARTITION BY agency_id, customer, total)
)
SELECT count(*) AS deletable_duplicates_left
FROM clustered
WHERE cluster_size > 1 AND span <= INTERVAL '30 minutes'
  AND keep_rank > 1
  AND NOT (real_delivery OR has_payment OR has_return OR has_grn OR has_return_item);
