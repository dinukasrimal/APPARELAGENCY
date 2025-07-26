-- Add test data to external_sales_targets and external_invoices tables
-- This script populates the local external data tables with sample data for testing

-- First, let's check what agencies exist in the system
-- INSERT sample external sales targets
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
-- Q1 2024 targets
('ext-target-1', 'Demo Agency', 2024, 'Q1', 2023, 
    '{"categories": [
        {"category": "Electronics", "target": 2500000, "amount": 2500000},
        {"category": "Fashion", "target": 1500000, "amount": 1500000},
        {"category": "Home & Garden", "target": 1000000, "amount": 1000000}
    ]}', 
    4500000, 5000000, 11.11, 'admin'),

('ext-target-2', 'Demo Agency', 2024, 'Q2', 2023,
    '{"categories": [
        {"category": "Electronics", "target": 2800000, "amount": 2800000},
        {"category": "Fashion", "target": 1700000, "amount": 1700000},
        {"category": "Home & Garden", "target": 1200000, "amount": 1200000}
    ]}', 
    5200000, 5700000, 9.62, 'admin'),

('ext-target-3', 'Sample Agency Ltd', 2024, 'Q1', 2023,
    '{"categories": [
        {"category": "Electronics", "target": 1800000, "amount": 1800000},
        {"category": "Fashion", "target": 1200000, "amount": 1200000},
        {"category": "Sports", "target": 800000, "amount": 800000}
    ]}', 
    3500000, 3800000, 8.57, 'admin'),

-- Q3 2024 targets
('ext-target-4', 'Demo Agency', 2024, 'Q3', 2023,
    '{"categories": [
        {"category": "Electronics", "target": 3000000, "amount": 3000000},
        {"category": "Fashion", "target": 1800000, "amount": 1800000},
        {"category": "Home & Garden", "target": 1300000, "amount": 1300000}
    ]}', 
    5600000, 6100000, 8.93, 'admin');

-- INSERT sample external invoices
INSERT INTO public.external_invoices (
    id,
    name,
    partner_name,
    date_order,
    amount_total,
    state,
    order_lines
) VALUES 
-- Q1 2024 invoices
('ext-inv-1', 'INV-2024-001', 'Demo Agency', '2024-01-15', 450000, 'posted',
    '[
        {"product_category": "Electronics", "quantity": 5, "unit_price": 60000, "subtotal": 300000, "total_amount": 300000},
        {"product_category": "Fashion", "quantity": 10, "unit_price": 15000, "subtotal": 150000, "total_amount": 150000}
    ]'),

('ext-inv-2', 'INV-2024-002', 'Demo Agency', '2024-02-20', 680000, 'posted',
    '[
        {"product_category": "Electronics", "quantity": 8, "unit_price": 50000, "subtotal": 400000, "total_amount": 400000},
        {"product_category": "Home & Garden", "quantity": 14, "unit_price": 20000, "subtotal": 280000, "total_amount": 280000}
    ]'),

('ext-inv-3', 'INV-2024-003', 'Demo Agency', '2024-03-10', 520000, 'posted',
    '[
        {"product_category": "Fashion", "quantity": 20, "unit_price": 18000, "subtotal": 360000, "total_amount": 360000},
        {"product_category": "Home & Garden", "quantity": 8, "unit_price": 20000, "subtotal": 160000, "total_amount": 160000}
    ]'),

-- Q2 2024 invoices
('ext-inv-4', 'INV-2024-004', 'Demo Agency', '2024-04-25', 750000, 'posted',
    '[
        {"product_category": "Electronics", "quantity": 10, "unit_price": 55000, "subtotal": 550000, "total_amount": 550000},
        {"product_category": "Fashion", "quantity": 10, "unit_price": 20000, "subtotal": 200000, "total_amount": 200000}
    ]'),

('ext-inv-5', 'INV-2024-005', 'Demo Agency', '2024-05-18', 920000, 'posted',
    '[
        {"product_category": "Electronics", "quantity": 12, "unit_price": 60000, "subtotal": 720000, "total_amount": 720000},
        {"product_category": "Home & Garden", "quantity": 10, "unit_price": 20000, "subtotal": 200000, "total_amount": 200000}
    ]'),

-- Sample Agency Ltd invoices
('ext-inv-6', 'INV-2024-006', 'Sample Agency Ltd', '2024-01-08', 380000, 'posted',
    '[
        {"product_category": "Electronics", "quantity": 4, "unit_price": 70000, "subtotal": 280000, "total_amount": 280000},
        {"product_category": "Sports", "quantity": 5, "unit_price": 20000, "subtotal": 100000, "total_amount": 100000}
    ]'),

('ext-inv-7', 'INV-2024-007', 'Sample Agency Ltd', '2024-02-12', 640000, 'posted',
    '[
        {"product_category": "Fashion", "quantity": 16, "unit_price": 25000, "subtotal": 400000, "total_amount": 400000},
        {"product_category": "Electronics", "quantity": 4, "unit_price": 60000, "subtotal": 240000, "total_amount": 240000}
    ]');

-- Show what we inserted
SELECT 'Sales Targets Inserted:' as info;
SELECT customer_name, target_year, target_months, initial_total_value, adjusted_total_value 
FROM public.external_sales_targets 
ORDER BY customer_name, target_year, target_months;

SELECT 'Invoices Inserted:' as info;
SELECT partner_name, date_order, amount_total, 
       EXTRACT(QUARTER FROM date_order) as quarter,
       EXTRACT(YEAR FROM date_order) as year
FROM public.external_invoices 
ORDER BY partner_name, date_order;