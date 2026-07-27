-- ============================================================================
-- UNDO the damage from the 300-invoice Odoo backfill.
--
-- A stock adjustment stores a DELTA computed against the stock AT COUNT TIME.
-- The backfill re-added Odoo invoices that are DATED BEFORE an agency's
-- adjustment but were INSERTED AFTER it — those double-count and must be removed.
--
-- We remove ONLY newsyncodoo external-invoice rows that are:
--   • for an agency that has an approved adjustment,
--   • dated on/before that adjustment (transaction_date <= adjustment time), AND
--   • inserted AFTER the adjustment (created_at > adjustment time)  ← the bad run.
--
-- This keeps: pre-adjustment invoices that were already synced before the count
-- (correctly baked into the adjustment) and all genuine post-adjustment invoices
-- (e.g. 454–456).
--
-- STEP 1 previews what will be deleted. Run it, review, then run STEP 2.
-- ============================================================================

-- ── STEP 1: PREVIEW ─────────────────────────────────────────────────────────
WITH adj AS (
  SELECT agency_id, max(COALESCE(created_at, transaction_date)) AS adj_at
  FROM external_inventory_management
  WHERE transaction_type = 'adjustment' AND approval_status = 'approved'
  GROUP BY agency_id
)
SELECT eim.agency_id, count(*) AS rows_to_delete,
       min(eim.transaction_date) AS oldest_invoice,
       max(eim.transaction_date) AS newest_invoice,
       adj.adj_at AS adjustment_time
FROM external_inventory_management eim
JOIN adj ON adj.agency_id = eim.agency_id
WHERE eim.external_source = 'newsyncodoo'
  AND eim.transaction_type = 'external_invoice'
  AND eim.transaction_date <= adj.adj_at
  AND eim.created_at > adj.adj_at
GROUP BY eim.agency_id, adj.adj_at
ORDER BY rows_to_delete DESC;

-- ── STEP 2: DELETE (run after reviewing STEP 1) ─────────────────────────────
WITH adj AS (
  SELECT agency_id, max(COALESCE(created_at, transaction_date)) AS adj_at
  FROM external_inventory_management
  WHERE transaction_type = 'adjustment' AND approval_status = 'approved'
  GROUP BY agency_id
)
DELETE FROM external_inventory_management eim
USING adj
WHERE eim.agency_id = adj.agency_id
  AND eim.external_source = 'newsyncodoo'
  AND eim.transaction_type = 'external_invoice'
  AND eim.transaction_date <= adj.adj_at
  AND eim.created_at > adj.adj_at;
