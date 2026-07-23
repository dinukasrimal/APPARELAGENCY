-- ============================================================================
-- PREVENT duplicate invoices / sales orders from network-retry submissions.
--
-- Root cause: the client sends a create request, the server commits it, but the
-- response is lost to a dropped connection. The app (or user) retries, and a
-- SECOND row is created. Because invoice/order numbers are assigned as max+1 at
-- insert time, the two rows get DIFFERENT numbers, so a unique number constraint
-- can never catch them (this is exactly how SIT214 / SIT215 happened).
--
-- Fix: a client-generated idempotency key that stays the SAME across retries of
-- the same logical submission, plus a UNIQUE constraint. The retry then hits the
-- constraint instead of creating a duplicate, and the client treats it as
-- "already created" (see idempotentInsert.ts).
--
-- The column is nullable so old rows and any un-migrated code paths keep working
-- (Postgres allows multiple NULLs under a UNIQUE constraint).
-- ============================================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

-- UNIQUE indexes named predictably so the client can recognise the violation.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_client_request_id_key
  ON public.invoices (client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sales_orders_client_request_id_key
  ON public.sales_orders (client_request_id)
  WHERE client_request_id IS NOT NULL;
