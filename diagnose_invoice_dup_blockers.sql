-- Why are duplicate invoices being skipped? Break the duplicates down by which
-- dependency is blocking their deletion. READ-ONLY.
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
SELECT
  count(*)                                                                              AS total_duplicates,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM collection_allocations ca WHERE ca.invoice_id::text = d.id::text)) AS with_payment,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM returns r     WHERE r.invoice_id::text = d.id::text))              AS with_return,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM grns g        WHERE g.invoice_id::text = d.id::text))              AS with_grn,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM deliveries dl WHERE dl.invoice_id::text = d.id::text))             AS with_delivery,
  count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM return_items ri JOIN invoice_items ii ON ii.id::text = ri.invoice_item_id::text
    WHERE ii.invoice_id = d.id))                                                        AS with_return_item,
  count(*) FILTER (WHERE
        NOT EXISTS (SELECT 1 FROM collection_allocations ca WHERE ca.invoice_id::text = d.id::text)
    AND NOT EXISTS (SELECT 1 FROM returns r     WHERE r.invoice_id::text = d.id::text)
    AND NOT EXISTS (SELECT 1 FROM grns g        WHERE g.invoice_id::text = d.id::text)
    AND NOT EXISTS (SELECT 1 FROM deliveries dl WHERE dl.invoice_id::text = d.id::text)
    AND NOT EXISTS (SELECT 1 FROM return_items ri JOIN invoice_items ii ON ii.id::text = ri.invoice_item_id::text WHERE ii.invoice_id = d.id)
  )                                                                                     AS fully_clean
FROM dups d;
