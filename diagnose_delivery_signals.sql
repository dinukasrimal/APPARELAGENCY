-- Sharper breakdown of the 99 duplicate invoices by delivery signal strength.
-- STRONG real-delivery signal = delivered_at set OR status delivered/completed.
-- WEAK signal = GPS present but NO delivered_at and status not delivered
--               (this is almost certainly a shell that merely copied the
--                invoice's GPS at creation time). READ-ONLY.
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

  -- STRONG: really delivered
  count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM deliveries dl WHERE dl.invoice_id::text = d.id::text
      AND (dl.delivered_at IS NOT NULL
           OR lower(coalesce(dl.status,'')) IN ('delivered','completed'))
  )) AS strong_real_delivery,

  -- WEAK: GPS only, not actually delivered (shell with copied coords)
  count(*) FILTER (WHERE
        EXISTS (SELECT 1 FROM deliveries dl WHERE dl.invoice_id::text = d.id::text
                  AND dl.delivery_latitude IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM deliveries dl WHERE dl.invoice_id::text = d.id::text
                  AND (dl.delivered_at IS NOT NULL
                       OR lower(coalesce(dl.status,'')) IN ('delivered','completed')))
  ) AS gps_only_shell,

  -- pure shell: a delivery row exists but no delivered_at, no status-delivered, no gps
  count(*) FILTER (WHERE
        EXISTS (SELECT 1 FROM deliveries dl WHERE dl.invoice_id::text = d.id::text)
    AND NOT EXISTS (SELECT 1 FROM deliveries dl WHERE dl.invoice_id::text = d.id::text
                  AND (dl.delivered_at IS NOT NULL
                       OR dl.delivery_latitude IS NOT NULL
                       OR lower(coalesce(dl.status,'')) IN ('delivered','completed')))
  ) AS pure_shell,

  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM collection_allocations ca WHERE ca.invoice_id::text = d.id::text)) AS with_payment
FROM dups d;
