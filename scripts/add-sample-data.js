// Script to add sample external data for testing
import { createClient } from '@supabase/supabase-js';

// Using environment variables that should be loaded
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const sampleTargets = [
  {
    id: 'ext_target_nexus_2024_q1',
    customer_name: 'Nexus Marketing',
    target_year: 2024,
    target_months: 'Q1',
    base_year: 2023,
    target_data: {
      categories: [
        { category: 'Apparel', target: 500000, percentage: 50 },
        { category: 'Accessories', target: 300000, percentage: 30 },
        { category: 'Footwear', target: 200000, percentage: 20 }
      ]
    },
    initial_total_value: 800000,
    adjusted_total_value: 1000000,
    percentage_increase: 25.0,
    created_by: 'system'
  },
  {
    id: 'ext_target_nexus_2024_q2',
    customer_name: 'Nexus Marketing',
    target_year: 2024,
    target_months: 'Q2',
    base_year: 2023,
    target_data: {
      categories: [
        { category: 'Apparel', target: 600000, percentage: 50 },
        { category: 'Accessories', target: 360000, percentage: 30 },
        { category: 'Footwear', target: 240000, percentage: 20 }
      ]
    },
    initial_total_value: 960000,
    adjusted_total_value: 1200000,
    percentage_increase: 25.0,
    created_by: 'system'
  }
];

const sampleInvoices = [
  {
    id: 'ext_invoice_nexus_001',
    name: 'INV/2024/0001',
    partner_name: 'Nexus Marketing',
    date_order: '2024-01-15',
    amount_total: 150000,
    state: 'posted',
    order_lines: [
      { product_category: 'Apparel', product_name: 'Cotton T-Shirts', price_total: 75000 },
      { product_category: 'Accessories', product_name: 'Baseball Caps', price_total: 45000 },
      { product_category: 'Footwear', product_name: 'Canvas Sneakers', price_total: 30000 }
    ]
  },
  {
    id: 'ext_invoice_nexus_002',
    name: 'INV/2024/0025',
    partner_name: 'Nexus Marketing',
    date_order: '2024-02-20',
    amount_total: 225000,
    state: 'posted',
    order_lines: [
      { product_category: 'Apparel', product_name: 'Polo Shirts', price_total: 120000 },
      { product_category: 'Accessories', product_name: 'Wristbands', price_total: 65000 },
      { product_category: 'Footwear', product_name: 'Sports Shoes', price_total: 40000 }
    ]
  }
];

async function addSampleData() {
  try {
    console.log('Adding sample external sales targets...');
    const { data: targetsData, error: targetsError } = await supabase
      .from('external_sales_targets')
      .upsert(sampleTargets, { onConflict: 'id' });

    if (targetsError) {
      console.error('Error inserting targets:', targetsError);
    } else {
      console.log('✅ Sample targets added successfully');
    }

    console.log('Adding sample external invoices...');
    const { data: invoicesData, error: invoicesError } = await supabase
      .from('external_invoices')
      .upsert(sampleInvoices, { onConflict: 'id' });

    if (invoicesError) {
      console.error('Error inserting invoices:', invoicesError);
    } else {
      console.log('✅ Sample invoices added successfully');
    }

    // Test queries
    console.log('Testing queries...');
    const { data: testTargets, error: testError } = await supabase
      .from('external_sales_targets')
      .select('*')
      .eq('customer_name', 'Nexus Marketing');

    if (testError) {
      console.error('Error testing:', testError);
    } else {
      console.log(`✅ Found ${testTargets.length} targets for Nexus Marketing`);
    }

  } catch (error) {
    console.error('Script error:', error);
  }
}

addSampleData();