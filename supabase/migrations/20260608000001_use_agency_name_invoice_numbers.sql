-- Use compact invoice numbers based on the agency name.
-- Format: first 3 alphanumeric characters from agency name + per-agency sequence.
-- Example: Nexus Apparel -> NEX001, NEX002.

DROP INDEX IF EXISTS idx_invoices_invoice_number;
DROP INDEX IF EXISTS idx_invoices_agency_invoice_number;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;

CREATE OR REPLACE FUNCTION get_agency_invoice_prefix(agency_id UUID)
RETURNS TEXT AS $$
DECLARE
    agency_prefix TEXT;
BEGIN
    SELECT UPPER(LEFT(REGEXP_REPLACE(COALESCE(name, ''), '[^a-zA-Z0-9]', '', 'g'), 3))
    INTO agency_prefix
    FROM agencies
    WHERE id = agency_id;

    RETURN RPAD(COALESCE(NULLIF(agency_prefix, ''), 'INV'), 3, 'X');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_invoice_number(agency_id UUID)
RETURNS TEXT AS $$
DECLARE
    agency_code TEXT;
    next_number INTEGER;
    generated_invoice_number TEXT;
BEGIN
    agency_code := get_agency_invoice_prefix($1);

    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 4) AS INTEGER)), 0)
    INTO next_number
    FROM invoices
    WHERE invoices.agency_id = $1
      AND invoice_number ~ ('^' || agency_code || '[0-9]+$');

    generated_invoice_number := agency_code ||
        CASE
            WHEN next_number + 1 < 1000 THEN LPAD((next_number + 1)::TEXT, 3, '0')
            ELSE (next_number + 1)::TEXT
        END;

    RETURN generated_invoice_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invoice_number IS NULL THEN
        NEW.invoice_number := generate_invoice_number(NEW.agency_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

WITH numbered_invoices AS (
    SELECT
        invoices.id,
        get_agency_invoice_prefix(invoices.agency_id) ||
            CASE
                WHEN ROW_NUMBER() OVER (
                    PARTITION BY invoices.agency_id
                    ORDER BY invoices.created_at NULLS FIRST, invoices.id
                ) < 1000 THEN LPAD(
                    ROW_NUMBER() OVER (
                        PARTITION BY invoices.agency_id
                        ORDER BY invoices.created_at NULLS FIRST, invoices.id
                    )::TEXT,
                    3,
                    '0'
                )
                ELSE ROW_NUMBER() OVER (
                    PARTITION BY invoices.agency_id
                    ORDER BY invoices.created_at NULLS FIRST, invoices.id
                )::TEXT
            END AS new_invoice_number
    FROM invoices
)
UPDATE invoices
SET invoice_number = numbered_invoices.new_invoice_number
FROM numbered_invoices
WHERE invoices.id = numbered_invoices.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_agency_invoice_number
ON invoices(agency_id, invoice_number);
