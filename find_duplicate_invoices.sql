-- ============================================================================
-- FIND duplicate INVOICES — broad detection (READ-ONLY).
--
-- Unlike the earlier strict version, this does NOT depend on customer_id (often
-- NULL on direct invoices), does NOT require a 10-minute window, and trims
-- trailing spaces from the customer name. Any two invoices for the same agency +
-- same customer name + same total are surfaced.
-- ============================================================================

-- ── A. Grouped clusters — the quickest overview ─────────────────────────────
SELECT
  agency_id,
  trim(customer_name)                              AS customer,
  total,
  count(*)                                         AS copies,
  array_agg(invoice_number ORDER BY created_at)    AS invoice_numbers,
  array_agg(id            ORDER BY created_at)      AS invoice_ids,
  min(created_at)                                  AS first_at,
  max(created_at)                                  AS last_at,
  EXTRACT(EPOCH FROM (max(created_at) - min(created_at))) AS span_seconds
FROM invoices
GROUP BY agency_id, trim(customer_name), total
HAVING count(*) > 1
ORDER BY last_at DESC;

-- ── B. Row-by-row with KEEP / DUPLICATE verdict ─────────────────────────────
-- rn = 1 is the earliest (KEEP); rn > 1 are later copies (DUPLICATE).
WITH ranked AS (
  SELECT
    id, invoice_number, trim(customer_name) AS customer, total,
    created_at, sales_order_id,
    row_number() OVER (
      PARTITION BY agency_id, trim(customer_name), total
      ORDER BY created_at
    ) AS rn,
    count(*) OVER (
      PARTITION BY agency_id, trim(customer_name), total
    ) AS cluster_size
  FROM invoices
)
SELECT id, invoice_number, customer, total, created_at,
       sales_order_id, rn, cluster_size,
       CASE WHEN rn = 1 THEN 'KEEP' ELSE 'DUPLICATE' END AS verdict
FROM ranked
WHERE cluster_size > 1
ORDER BY customer, total, created_at;

-- ── C. Tighter view — only clusters created close together (likely retries) ──
-- Same as B but restricted to clusters whose copies are within 30 minutes,
-- which is the strong signal of a connection-retry rather than a genuine repeat
-- order to the same customer weeks apart.
WITH ranked AS (
  SELECT
    id, invoice_number, trim(customer_name) AS customer, total,
    created_at,
    row_number() OVER (
      PARTITION BY agency_id, trim(customer_name), total
      ORDER BY created_at
    ) AS rn,
    max(created_at) OVER (PARTITION BY agency_id, trim(customer_name), total)
      - min(created_at) OVER (PARTITION BY agency_id, trim(customer_name), total) AS span,
    count(*) OVER (PARTITION BY agency_id, trim(customer_name), total) AS cluster_size
  FROM invoices
)
SELECT id, invoice_number, customer, total, created_at,
       rn, cluster_size,
       CASE WHEN rn = 1 THEN 'KEEP' ELSE 'DUPLICATE' END AS verdict
FROM ranked
WHERE cluster_size > 1
  AND span <= INTERVAL '30 minutes'
ORDER BY customer, total, created_at;
