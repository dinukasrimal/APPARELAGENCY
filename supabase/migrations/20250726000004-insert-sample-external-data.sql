-- Insert sample external sales targets for Nexus Marketing
INSERT INTO public.external_sales_targets (
    id,
    customer_name,
    target_year,
    target_months,
    base_year,
    target_data,
    initial_total_value,
    adjusted_total_value,
    percentage_increase,
    created_by
) VALUES 
(
    'ext_target_nexus_2024_q1',
    'Nexus Marketing',
    2024,
    'Q1',
    2023,
    '{"categories": [
        {"category": "Apparel", "target": 500000, "percentage": 50},
        {"category": "Accessories", "target": 300000, "percentage": 30},
        {"category": "Footwear", "target": 200000, "percentage": 20}
    ]}'::jsonb,
    800000,
    1000000,
    25.0,
    'system'
),
(
    'ext_target_nexus_2024_q2',
    'Nexus Marketing',
    2024,
    'Q2',
    2023,
    '{"categories": [
        {"category": "Apparel", "target": 600000, "percentage": 50},
        {"category": "Accessories", "target": 360000, "percentage": 30},
        {"category": "Footwear", "target": 240000, "percentage": 20}
    ]}'::jsonb,
    960000,
    1200000,
    25.0,
    'system'
),
(
    'ext_target_nexus_2024_q3',
    'Nexus Marketing',
    2024,
    'Q3',
    2023,
    '{"categories": [
        {"category": "Apparel", "target": 650000, "percentage": 50},
        {"category": "Accessories", "target": 390000, "percentage": 30},
        {"category": "Footwear", "target": 260000, "percentage": 20}
    ]}'::jsonb,
    1040000,
    1300000,
    25.0,
    'system'
),
(
    'ext_target_nexus_2024_q4',
    'Nexus Marketing',
    2024,
    'Q4',
    2023,
    '{"categories": [
        {"category": "Apparel", "target": 700000, "percentage": 50},
        {"category": "Accessories", "target": 420000, "percentage": 30},
        {"category": "Footwear", "target": 280000, "percentage": 20}
    ]}'::jsonb,
    1120000,
    1400000,
    25.0,
    'system'
);

-- Insert sample external invoices for Nexus Marketing
INSERT INTO public.external_invoices (
    id,
    name,
    partner_name,
    date_order,
    amount_total,
    state,
    order_lines
) VALUES 
(
    'ext_invoice_nexus_001',
    'INV/2024/0001',
    'Nexus Marketing',
    '2024-01-15',
    150000,
    'posted',
    '[
        {"product_category": "Apparel", "product_name": "Cotton T-Shirts", "price_total": 75000},
        {"product_category": "Accessories", "product_name": "Baseball Caps", "price_total": 45000},
        {"product_category": "Footwear", "product_name": "Canvas Sneakers", "price_total": 30000}
    ]'::jsonb
),
(
    'ext_invoice_nexus_002',
    'INV/2024/0025',
    'Nexus Marketing',
    '2024-02-20',
    225000,
    'posted',
    '[
        {"product_category": "Apparel", "product_name": "Polo Shirts", "price_total": 120000},
        {"product_category": "Accessories", "product_name": "Wristbands", "price_total": 65000},
        {"product_category": "Footwear", "product_name": "Sports Shoes", "price_total": 40000}
    ]'::jsonb
),
(
    'ext_invoice_nexus_003',
    'INV/2024/0047',
    'Nexus Marketing',
    '2024-03-10',
    180000,
    'posted',
    '[
        {"product_category": "Apparel", "product_name": "Hoodies", "price_total": 90000},
        {"product_category": "Accessories", "product_name": "Bags", "price_total": 54000},
        {"product_category": "Footwear", "product_name": "Sandals", "price_total": 36000}
    ]'::jsonb
),
(
    'ext_invoice_nexus_004',
    'INV/2024/0068',
    'Nexus Marketing',
    '2024-04-05',
    275000,
    'posted',
    '[
        {"product_category": "Apparel", "product_name": "Summer Collection", "price_total": 140000},
        {"product_category": "Accessories", "product_name": "Sunglasses", "price_total": 80000},
        {"product_category": "Footwear", "product_name": "Flip Flops", "price_total": 55000}
    ]'::jsonb
),
(
    'ext_invoice_nexus_005',
    'INV/2024/0089',
    'Nexus Marketing',
    '2024-05-15',
    320000,
    'posted',
    '[
        {"product_category": "Apparel", "product_name": "Business Shirts", "price_total": 160000},
        {"product_category": "Accessories", "product_name": "Ties", "price_total": 96000},
        {"product_category": "Footwear", "product_name": "Formal Shoes", "price_total": 64000}
    ]'::jsonb
),
(
    'ext_invoice_nexus_006',
    'INV/2024/0112',
    'Nexus Marketing',
    '2024-06-25',
    195000,
    'posted',
    '[
        {"product_category": "Apparel", "product_name": "Casual Wear", "price_total": 97500},
        {"product_category": "Accessories", "product_name": "Belts", "price_total": 58500},
        {"product_category": "Footwear", "product_name": "Loafers", "price_total": 39000}
    ]'::jsonb
),
(
    'ext_invoice_nexus_007',
    'INV/2024/0135',
    'Nexus Marketing',
    '2024-07-10',
    285000,
    'posted',
    '[
        {"product_category": "Apparel", "product_name": "Summer Dresses", "price_total": 142500},
        {"product_category": "Accessories", "product_name": "Jewelry", "price_total": 85500},
        {"product_category": "Footwear", "product_name": "High Heels", "price_total": 57000}
    ]'::jsonb
),
(
    'ext_invoice_nexus_008',
    'INV/2024/0158',
    'Nexus Marketing',
    '2024-08-20',
    310000,
    'posted',
    '[
        {"product_category": "Apparel", "product_name": "Back to School", "price_total": 155000},
        {"product_category": "Accessories", "product_name": "Backpacks", "price_total": 93000},
        {"product_category": "Footwear", "product_name": "School Shoes", "price_total": 62000}
    ]'::jsonb
),
(
    'ext_invoice_nexus_009',
    'INV/2024/0181',
    'Nexus Marketing',
    '2024-09-15',
    265000,
    'posted',
    '[
        {"product_category": "Apparel", "product_name": "Fall Collection", "price_total": 132500},
        {"product_category": "Accessories", "product_name": "Scarves", "price_total": 79500},
        {"product_category": "Footwear", "product_name": "Boots", "price_total": 53000}
    ]'::jsonb
);

-- Add a few more agencies for testing
INSERT INTO public.external_sales_targets (
    id,
    customer_name,
    target_year,
    target_months,
    target_data,
    initial_total_value,
    adjusted_total_value,
    percentage_increase,
    created_by
) VALUES 
(
    'ext_target_apex_2024_q1',
    'Apex Solutions',
    2024,
    'Q1',
    '{"categories": [{"category": "Apparel", "target": 400000}]}'::jsonb,
    400000,
    400000,
    0.0,
    'system'
),
(
    'ext_target_global_2024_q1',
    'Global Dynamics',
    2024,
    'Q1',
    '{"categories": [{"category": "Accessories", "target": 300000}]}'::jsonb,
    300000,
    300000,
    0.0,
    'system'
);