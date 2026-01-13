-- Collections Module Database Tables
-- Run this SQL in your Supabase SQL Editor

-- 1. Create collections table
CREATE TABLE IF NOT EXISTS collections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'cheque', 'mixed')),
    cash_amount DECIMAL(10,2) DEFAULT 0,
    cash_discount DECIMAL(10,2) DEFAULT 0,
    cheque_amount DECIMAL(10,2) DEFAULT 0,
    cash_date DATE NOT NULL,
    notes TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'allocated', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- 2. Create collection_cheques table
CREATE TABLE IF NOT EXISTS collection_cheques (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    cheque_number TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    cheque_date DATE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'cleared', 'bounced')),
    cleared_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create collection_allocations table
CREATE TABLE IF NOT EXISTS collection_allocations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    allocated_amount DECIMAL(10,2) NOT NULL,
    allocated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    allocated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_collections_customer_id ON collections(customer_id);
CREATE INDEX IF NOT EXISTS idx_collections_agency_id ON collections(agency_id);
CREATE INDEX IF NOT EXISTS idx_collections_created_at ON collections(created_at);
CREATE INDEX IF NOT EXISTS idx_collections_status ON collections(status);

CREATE INDEX IF NOT EXISTS idx_collection_cheques_collection_id ON collection_cheques(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_cheques_status ON collection_cheques(status);

CREATE INDEX IF NOT EXISTS idx_collection_allocations_collection_id ON collection_allocations(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_allocations_invoice_id ON collection_allocations(invoice_id);

-- 5. Create RLS (Row Level Security) policies
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_cheques ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_allocations ENABLE ROW LEVEL SECURITY;

-- Collections policies
CREATE POLICY "Users can view collections from their agency" ON collections
    FOR SELECT USING (
        agency_id IN (
            SELECT agency_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert collections for their agency" ON collections
    FOR INSERT WITH CHECK (
        agency_id IN (
            SELECT agency_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update collections from their agency" ON collections
    FOR UPDATE USING (
        agency_id IN (
            SELECT agency_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Collection cheques policies
CREATE POLICY "Users can view cheques from their agency collections" ON collection_cheques
    FOR SELECT USING (
        collection_id IN (
            SELECT id FROM collections WHERE agency_id IN (
                SELECT agency_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert cheques for their agency collections" ON collection_cheques
    FOR INSERT WITH CHECK (
        collection_id IN (
            SELECT id FROM collections WHERE agency_id IN (
                SELECT agency_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update cheques from their agency collections" ON collection_cheques
    FOR UPDATE USING (
        collection_id IN (
            SELECT id FROM collections WHERE agency_id IN (
                SELECT agency_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

-- Collection allocations policies
CREATE POLICY "Users can view allocations from their agency collections" ON collection_allocations
    FOR SELECT USING (
        collection_id IN (
            SELECT id FROM collections WHERE agency_id IN (
                SELECT agency_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert allocations for their agency collections" ON collection_allocations
    FOR INSERT WITH CHECK (
        collection_id IN (
            SELECT id FROM collections WHERE agency_id IN (
                SELECT agency_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update allocations from their agency collections" ON collection_allocations
    FOR UPDATE USING (
        collection_id IN (
            SELECT id FROM collections WHERE agency_id IN (
                SELECT agency_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

-- 6. Create functions for data integrity
CREATE OR REPLACE FUNCTION validate_collection_amounts()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure total_amount equals cash_amount + cheque_amount + cash_discount
    IF NEW.total_amount != (NEW.cash_amount + NEW.cheque_amount + NEW.cash_discount) THEN
        RAISE EXCEPTION 'Total amount must equal cash amount plus cheque amount plus cash discount';
    END IF;
    
    -- Ensure payment method matches amounts
    IF NEW.payment_method = 'cash' AND NEW.cheque_amount > 0 THEN
        RAISE EXCEPTION 'Cash payment cannot have cheque amount';
    END IF;
    
    IF NEW.payment_method = 'cheque' AND NEW.cash_amount > 0 THEN
        RAISE EXCEPTION 'Cheque payment cannot have cash amount';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for collection validation
CREATE TRIGGER validate_collection_amounts_trigger
    BEFORE INSERT OR UPDATE ON collections
    FOR EACH ROW
    EXECUTE FUNCTION validate_collection_amounts();

-- 7. Create function to update collection status when allocations are complete
CREATE OR REPLACE FUNCTION update_collection_status()
RETURNS TRIGGER AS $$
DECLARE
    total_allocated DECIMAL(10,2);
    collection_total DECIMAL(10,2);
BEGIN
    -- Get total allocated amount for this collection
    SELECT COALESCE(SUM(allocated_amount), 0) INTO total_allocated
    FROM collection_allocations
    WHERE collection_id = NEW.collection_id;
    
    -- Get collection total amount
    SELECT total_amount INTO collection_total
    FROM collections
    WHERE id = NEW.collection_id;
    
    -- Update collection status based on allocation
    IF total_allocated >= collection_total THEN
        UPDATE collections 
        SET status = 'completed'
        WHERE id = NEW.collection_id;
    ELSIF total_allocated > 0 THEN
        UPDATE collections 
        SET status = 'allocated'
        WHERE id = NEW.collection_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic status updates
CREATE TRIGGER update_collection_status_trigger
    AFTER INSERT OR UPDATE OR DELETE ON collection_allocations
    FOR EACH ROW
    EXECUTE FUNCTION update_collection_status();

-- 8. Grant necessary permissions
GRANT ALL ON collections TO authenticated;
GRANT ALL ON collection_cheques TO authenticated;
GRANT ALL ON collection_allocations TO authenticated;

-- 9. Create views for easier querying
CREATE OR REPLACE VIEW collection_summary AS
SELECT 
    c.id,
    c.customer_id,
    c.customer_name,
    c.agency_id,
    c.total_amount,
    c.payment_method,
    c.cash_amount,
    c.cheque_amount,
    c.status,
    c.created_at,
    c.created_by,
    COUNT(cc.id) as cheque_count,
    COUNT(ca.id) as allocation_count,
    COALESCE(SUM(ca.allocated_amount), 0) as total_allocated
FROM collections c
LEFT JOIN collection_cheques cc ON c.id = cc.collection_id
LEFT JOIN collection_allocations ca ON c.id = ca.collection_id
GROUP BY c.id, c.customer_id, c.customer_name, c.agency_id, c.total_amount, 
         c.payment_method, c.cash_amount, c.cheque_amount, c.status, c.created_at, c.created_by;

-- Grant access to the view
GRANT SELECT ON collection_summary TO authenticated; 
