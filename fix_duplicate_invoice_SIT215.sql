-- Remove duplicate invoice SIT215 (second submit of SIT214 for Mc Fashion / Sithumini agency)
-- SIT214 is the original; SIT215 is the duplicate created by the double-click.
-- Run in Supabase SQL Editor. Review the SELECT first before running the DELETE block.

-- ── STEP 1: Confirm which invoices to keep / remove ─────────────────────────
SELECT
  id,
  invoice_number,
  customer_name,
  total,
  created_at
FROM invoices
WHERE invoice_number IN ('SIT214', 'SIT215')
ORDER BY created_at;

-- ── STEP 2: Remove invoice_items for SIT215 first (FK constraint) ─────────────
DELETE FROM invoice_items
WHERE invoice_id = (
  SELECT id FROM invoices WHERE invoice_number = 'SIT215' LIMIT 1
);

-- ── STEP 3: Remove the duplicate invoice itself ───────────────────────────────
DELETE FROM invoices
WHERE invoice_number = 'SIT215';

-- ── STEP 4: If PDF was uploaded for SIT215, it stays in storage but is now
--            unreferenced.  Optionally clean it up via the Supabase Storage UI
--            (bucket: invoice-pdfs, path: invoices/<id>.pdf).

-- ── STEP 5: Verify ───────────────────────────────────────────────────────────
SELECT invoice_number, customer_name, total, created_at
FROM invoices
WHERE invoice_number IN ('SIT214', 'SIT215')
ORDER BY created_at;
-- Should return only SIT214.
