-- SQL script to create test users for agencies
-- Run this AFTER inserting agencies
-- Run this in your Supabase SQL Editor

-- First get agency IDs (you'll need to update these with actual IDs from your agencies table)
-- Replace the agency_id values below with actual UUIDs from your agencies table

-- Create test user for SATHIJA AGENCY (replace agency_id with actual ID)
INSERT INTO profiles (id, full_name, role, agency_id, created_at, updated_at) VALUES
(gen_random_uuid(), 'Test User - Sathija Agency', 'agency', (SELECT id FROM agencies WHERE name = 'SATHIJA AGENCY' LIMIT 1), NOW(), NOW());

-- Create test user for JAFFNA - INTHARA (replace agency_id with actual ID)  
INSERT INTO profiles (id, full_name, role, agency_id, created_at, updated_at) VALUES
(gen_random_uuid(), 'Test User - Jaffna Inthara', 'agency', (SELECT id FROM agencies WHERE name = 'JAFFNA - INTHARA' LIMIT 1), NOW(), NOW());

-- Create test user for AMBALANGODA (replace agency_id with actual ID)
INSERT INTO profiles (id, full_name, role, agency_id, created_at, updated_at) VALUES
(gen_random_uuid(), 'Test User - Ambalangoda', 'agency', (SELECT id FROM agencies WHERE name = 'AMBALANGODA' LIMIT 1), NOW(), NOW());

-- Verify the insertion
SELECT p.id, p.full_name, p.role, a.name as agency_name 
FROM profiles p
LEFT JOIN agencies a ON p.agency_id = a.id
WHERE p.role = 'agency'
ORDER BY a.name;