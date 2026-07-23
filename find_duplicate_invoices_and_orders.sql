-- ============================================================================
-- DETECT duplicate invoices and sales orders caused by network-retry submits.
-- Run each block in the Supabase SQL Editor. These are READ-ONLY (no deletes).
--
-- Definition of a duplicate: same agency + same customer + same total, created
-- by the same user within a 10-minute window. That is the signature of a lost
-- response being retried (the two rows get different invoice/order numbers, so
-- number uniqueness never catches them).
-- ============================================================================

-- ── 1a. Duplicate INVOICES (grouped clusters) ───────────────────────────────
SELECT
  agency_id,
  customer_id,
  customer_name,
  total,
  created_by,
  count(*)                              AS copies,
  array_agg(invoice_number ORDER BY created_at) AS invoice_numbers,
  array_agg(id            ORDER BY created_at)  AS invoice_ids,
  min(created_at)                       AS first_at,
  max(created_at)                       AS last_at,
  EXTRACT(EPOCH FROM (max(created_at) - min(created_at))) AS span_seconds
FROM invoices
GROUP BY
  agency_id, customer_id, customer_name, total, created_by,
  -- bucket by 10-minute window so near-simultaneous submits group together
  floor(EXTRACT(EPOCH FROM created_at) / 600)
HAVING count(*) > 1
ORDER BY last_at DESC;

-- ── 1b. Duplicate INVOICES (row-by-row, keep vs delete) ─────────────────────
-- The row with rn = 1 is the ORIGINAL (keep). rn > 1 are the duplicates.
WITH ranked AS (
  SELECT
    id, invoice_number, customer_name, total, created_by, created_at,
    row_number() OVER (
      PARTITION BY agency_id, customer_id, total, created_by,
                   floor(EXTRACT(EPOCH FROM created_at) / 600)
      ORDER BY created_at
    ) AS rn,
    count(*) OVER (
      PARTITION BY agency_id, customer_id, total, created_by,
                   floor(EXTRACT(EPOCH FROM created_at) / 600)
    ) AS cluster_size
  FROM invoices
)
SELECT id, invoice_number, customer_name, total, created_at,
       rn, cluster_size,
       CASE WHEN rn = 1 THEN 'KEEP' ELSE 'DUPLICATE' END AS verdict
FROM ranked
WHERE cluster_size > 1
ORDER BY customer_name, created_at;

-- ── 2a. Duplicate SALES ORDERS (grouped clusters) ───────────────────────────
SELECT
  agency_id,
  customer_id,
  customer_name,
  total,
  created_by,
  count(*)                              AS copies,
  array_agg(order_number ORDER BY created_at) AS order_numbers,
  array_agg(id           ORDER BY created_at) AS order_ids,
  min(created_at)                       AS first_at,
  max(created_at)                       AS last_at,
  EXTRACT(EPOCH FROM (max(created_at) - min(created_at))) AS span_seconds
FROM sales_orders
GROUP BY
  agency_id, customer_id, customer_name, total, created_by,
  floor(EXTRACT(EPOCH FROM created_at) / 600)
HAVING count(*) > 1
ORDER BY last_at DESC;

-- ── 2b. Duplicate SALES ORDERS (row-by-row, keep vs delete) ─────────────────
WITH ranked AS (
  SELECT
    id, order_number, customer_name, total, created_by, created_at,
    row_number() OVER (
      PARTITION BY agency_id, customer_id, total, created_by,
                   floor(EXTRACT(EPOCH FROM created_at) / 600)
      ORDER BY created_at
    ) AS rn,
    count(*) OVER (
      PARTITION BY agency_id, customer_id, total, created_by,
                   floor(EXTRACT(EPOCH FROM created_at) / 600)
    ) AS cluster_size
  FROM sales_orders
)
SELECT id, order_number, customer_name, total, created_at,
       rn, cluster_size,
       CASE WHEN rn = 1 THEN 'KEEP' ELSE 'DUPLICATE' END AS verdict
FROM ranked
WHERE cluster_size > 1
ORDER BY customer_name, created_at;
