-- Create agency_pricing_settings table
-- Run this script in your Supabase SQL editor or database console

-- Create the table
CREATE TABLE IF NOT EXISTS agency_pricing_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  price_type TEXT NOT NULL CHECK (price_type IN ('selling_price', 'billing_price')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE(agency_id)
);

-- Create unique index on agency_id for better performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_pricing_settings_agency_id 
ON agency_pricing_settings(agency_id);

-- Enable Row Level Security (RLS)
ALTER TABLE agency_pricing_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for authenticated users
-- Note: If policy already exists, this will fail but that's okay
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'agency_pricing_settings' 
    AND policyname = 'Users can manage agency pricing settings'
  ) THEN
    CREATE POLICY "Users can manage agency pricing settings" ON agency_pricing_settings
      FOR ALL USING (true);
  END IF;
END $$;

-- Grant permissions to authenticated users
GRANT ALL ON agency_pricing_settings TO authenticated;
GRANT ALL ON agency_pricing_settings TO service_role;

-- Optional: Insert sample data (uncomment if needed)
-- INSERT INTO agency_pricing_settings (agency_id, price_type) 
-- SELECT id, 'billing_price' FROM agencies 
-- ON CONFLICT (agency_id) DO NOTHING;