-- Create app_settings table to store configuration and sync timestamps
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial settings
INSERT INTO app_settings (key, value, description) VALUES 
('last_external_sync', (NOW() - INTERVAL '24 hours')::TEXT, 'Timestamp of the last successful external invoice sync'),
('external_sync_enabled', 'true', 'Enable/disable automatic external invoice synchronization'),
('external_sync_interval_minutes', '10', 'Interval in minutes for external invoice sync'),
('min_product_match_score', '30', 'Minimum confidence score required for product matching')
ON CONFLICT (key) DO NOTHING;

-- Create an updated_at trigger for app_settings
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_app_settings_updated_at
    BEFORE UPDATE ON app_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies for app_settings (only admins can modify)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Allow superusers to read and modify settings
CREATE POLICY "Superusers can manage app settings" ON app_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'superuser'
    )
  );

-- Allow all authenticated users to read certain settings
CREATE POLICY "Users can read public settings" ON app_settings
  FOR SELECT USING (
    auth.role() = 'authenticated' 
    AND key IN ('external_sync_enabled', 'external_sync_interval_minutes')
  );

COMMENT ON TABLE app_settings IS 'Application-wide settings and configuration values';
COMMENT ON COLUMN app_settings.key IS 'Unique setting identifier';
COMMENT ON COLUMN app_settings.value IS 'Setting value (stored as text, parse as needed)';
COMMENT ON COLUMN app_settings.description IS 'Human-readable description of the setting';