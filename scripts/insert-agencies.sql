-- SQL script to insert agencies matching external project
-- Run this in your Supabase SQL Editor

INSERT INTO agencies (name, created_at) VALUES
('JAFFNA - INTHARA', NOW()),
('KURUNEGALA - INTHARA', NOW()),
('SATHIJA AGENCY', NOW()),
('AMBALANGODA', NOW()),
('SITHUMINI ENTERPRISES', NOW()),
('HORANA - INTHARA', NOW()),
('MR OSHADA', NOW()),
('NEXUS MARKETING', NOW()),
('MR.IMAS', NOW());

-- Verify the insertion
SELECT id, name, created_at FROM agencies ORDER BY name;