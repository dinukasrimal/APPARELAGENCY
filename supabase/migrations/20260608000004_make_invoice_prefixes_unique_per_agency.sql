-- Make compact invoice prefixes unique when agencies share the same first 3 characters.
-- Normal case: Nexus Marketing -> NEX001.
-- Collision case: INTHARA JAFFNA / INTHARA KURUNEGALA -> IN1001 / IN2001.

CREATE OR REPLACE FUNCTION get_agency_invoice_prefix(agency_id UUID)
RETURNS TEXT AS $$
DECLARE
    agency_code TEXT;
BEGIN
    WITH agency_prefixes AS (
        SELECT
            id,
            name,
            RPAD(
                COALESCE(
                    NULLIF(UPPER(LEFT(REGEXP_REPLACE(COALESCE(name, ''), '[^a-zA-Z0-9]', '', 'g'), 3)), ''),
                    'INV'
                ),
                3,
                'X'
            ) AS base_prefix
        FROM agencies
    ),
    ranked_prefixes AS (
        SELECT
            id,
            base_prefix,
            COUNT(*) OVER (PARTITION BY base_prefix) AS peer_count,
            ROW_NUMBER() OVER (PARTITION BY base_prefix ORDER BY name, id) AS peer_rank
        FROM agency_prefixes
    )
    SELECT
        CASE
            WHEN peer_count <= 1 THEN base_prefix
            ELSE LEFT(base_prefix, 2) || SUBSTRING('123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' FROM LEAST(peer_rank, 35)::INTEGER FOR 1)
        END
    INTO agency_code
    FROM ranked_prefixes
    WHERE id = $1;

    RETURN COALESCE(agency_code, 'INV');
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_invoice_number_unique
ON invoices(invoice_number);

