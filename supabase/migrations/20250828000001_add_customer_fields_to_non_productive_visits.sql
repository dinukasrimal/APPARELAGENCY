-- Add missing customer fields to non_productive_visits table
-- This migration adds customer_id and customer_name columns that are being used in the application

ALTER TABLE non_productive_visits 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- Create index for better performance on customer_id lookups
CREATE INDEX IF NOT EXISTS idx_non_productive_visits_customer_id ON non_productive_visits(customer_id);

-- Grant necessary permissions (if needed)
GRANT ALL ON non_productive_visits TO authenticated;