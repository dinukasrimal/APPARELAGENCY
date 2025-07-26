-- Collections Module - Simple Step-by-Step Setup
-- Run these commands one by one in your Supabase SQL Editor

-- Step 1: Create collections table
CREATE TABLE IF NOT EXISTS collections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'cheque', 'mixed')),
    cash_amount DECIMAL(10,2) DEFAULT 0,
    cheque_amount DECIMAL(10,2) DEFAULT 0,
    cash_date DATE NOT NULL,
    notes TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'allocated', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Step 2: Create collection_cheques table
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

-- Step 3: Create collection_allocations table
CREATE TABLE IF NOT EXISTS collection_allocations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    allocated_amount DECIMAL(10,2) NOT NULL,
    allocated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    allocated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_collections_customer_id ON collections(customer_id);
CREATE INDEX IF NOT EXISTS idx_collections_agency_id ON collections(agency_id);
CREATE INDEX IF NOT EXISTS idx_collections_created_at ON collections(created_at);
CREATE INDEX IF NOT EXISTS idx_collections_status ON collections(status);

CREATE INDEX IF NOT EXISTS idx_collection_cheques_collection_id ON collection_cheques(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_allocations_collection_id ON collection_allocations(collection_id);

-- Step 5: Enable RLS
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_cheques ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_allocations ENABLE ROW LEVEL SECURITY;

-- Step 6: Create basic RLS policies
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

-- Step 7: Grant permissions
GRANT ALL ON collections TO authenticated;
GRANT ALL ON collection_cheques TO authenticated;
GRANT ALL ON collection_allocations TO authenticated; 