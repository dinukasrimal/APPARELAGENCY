-- For the duplicate invoices, inspect the linked deliveries so we can tell an
-- auto-created "shell" (never actually delivered) from a real delivery. READ-ONLY.

-- 1) Distinct delivery statuses that exist at all (so we know the vocabulary)
SELECT status, count(*) AS n,
       count(delivered_at) AS with_delivered_at,
       count(delivery_latitude) AS with_gps
FROM deliveries
GROUP BY status
ORDER BY n DESC;

-- 2) For the 99 duplicate invoices specifically: break their deliveries down by
--    whether they look "completed" vs a pending shell, and whether a payment is
--    also attached to the same duplicate.
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
  count(*) AS total_duplicates,
  count(*) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM deliveries dl
      WHERE dl.invoice_id::text = d.id::text
        AND (dl.delivered_at IS NOT NULL OR dl.delivery_latitude IS NOT NULL
             OR lower(coalesce(dl.status,'')) IN ('delivered','completed'))
    )
  ) AS with_REAL_delivery,
  count(*) FILTER (
    WHERE EXISTS (SELECT 1 FROM deliveries dl WHERE dl.invoice_id::text = d.id::text)
      AND NOT EXISTS (
        SELECT 1 FROM deliveries dl
        WHERE dl.invoice_id::text = d.id::text
          AND (dl.delivered_at IS NOT NULL OR dl.delivery_latitude IS NOT NULL
               OR lower(coalesce(dl.status,'')) IN ('delivered','completed'))
      )
  ) AS with_only_shell_delivery,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM collection_allocations ca WHERE ca.invoice_id::text = d.id::text)) AS with_payment,
  count(*) FILTER (
    WHERE EXISTS (SELECT 1 FROM collection_allocations ca WHERE ca.invoice_id::text = d.id::text)
      AND EXISTS (
        SELECT 1 FROM deliveries dl
        WHERE dl.invoice_id::text = d.id::text
          AND (dl.delivered_at IS NOT NULL OR dl.delivery_latitude IS NOT NULL
               OR lower(coalesce(dl.status,'')) IN ('delivered','completed'))
      )
  ) AS with_payment_AND_real_delivery
FROM dups d;
