#!/usr/bin/env node

/**
 * Simple Node.js script to test external Supabase connection
 * Run with: node scripts/test-external-connection.js
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

async function testExternalConnection() {
  console.log('🔍 Testing External Supabase Connection...\n');

  // Check environment variables
  const externalUrl = process.env.NEXT_PUBLIC_EXTERNAL_SUPABASE_URL;
  const externalKey = process.env.NEXT_PUBLIC_EXTERNAL_SUPABASE_ANON_KEY;

  console.log('📋 Configuration Check:');
  console.log(`   URL: ${externalUrl || '❌ Not set'}`);
  console.log(`   Key: ${externalKey ? '✅ Set' : '❌ Not set'}\n`);

  if (!externalUrl || !externalKey) {
    console.log('❌ External Supabase credentials not configured.');
    console.log('   Please add the following to your .env file:');
    console.log('   NEXT_PUBLIC_EXTERNAL_SUPABASE_URL=https://your-project.supabase.co');
    console.log('   NEXT_PUBLIC_EXTERNAL_SUPABASE_ANON_KEY=your_anon_key');
    return;
  }

  if (externalUrl === 'https://your-other-project.supabase.co' || 
      externalKey === 'your_other_project_anon_key_here') {
    console.log('❌ External Supabase credentials are using placeholder values.');
    console.log('   Please update your .env file with actual credentials.');
    return;
  }

  try {
    // Create client
    const externalSupabase = createClient(externalUrl, externalKey, {
      auth: { persistSession: false }
    });

    console.log('🔌 Testing connection...');

    // Test sales_targets table
    console.log('📊 Testing sales_targets table...');
    const { data: targetsData, error: targetsError, count: targetsCount } = await externalSupabase
      .from('sales_targets')
      .select('*', { count: 'exact', head: true });

    if (targetsError) {
      console.log(`   ❌ Error: ${targetsError.message}`);
    } else {
      console.log(`   ✅ Success: Found ${targetsCount || 0} sales targets`);
    }

    // Test invoices table
    console.log('🧾 Testing invoices table...');
    const { data: invoicesData, error: invoicesError, count: invoicesCount } = await externalSupabase
      .from('invoices')
      .select('*', { count: 'exact', head: true });

    if (invoicesError) {
      console.log(`   ❌ Error: ${invoicesError.message}`);
    } else {
      console.log(`   ✅ Success: Found ${invoicesCount || 0} invoices`);
    }

    // Test sample data retrieval
    if (!targetsError && targetsCount > 0) {
      console.log('\n📋 Sample sales targets:');
      const { data: sampleTargets } = await externalSupabase
        .from('sales_targets')
        .select('customer_name, target_year, target_months, initial_total_value')
        .limit(5);

      sampleTargets?.forEach((target, index) => {
        console.log(`   ${index + 1}. ${target.customer_name} - ${target.target_year} ${target.target_months} - Rs ${target.initial_total_value}`);
      });
      
      // Test agency-specific filtering
      console.log('\n🎯 Testing agency-specific data (SATHIJA AGENCY):');
      const { data: agencyTargets } = await externalSupabase
        .from('sales_targets')
        .select('customer_name, target_year, target_months, initial_total_value')
        .eq('customer_name', 'SATHIJA AGENCY');
      
      if (agencyTargets && agencyTargets.length > 0) {
        console.log(`   Found ${agencyTargets.length} targets for SATHIJA AGENCY:`);
        agencyTargets.forEach((target, index) => {
          console.log(`   ${index + 1}. ${target.target_year} ${target.target_months} - Rs ${target.initial_total_value}`);
        });
      } else {
        console.log('   No targets found for SATHIJA AGENCY');
      }
    }

    if (!invoicesError && invoicesCount > 0) {
      console.log('\n🧾 Sample invoices:');
      const { data: sampleInvoices } = await externalSupabase
        .from('invoices')
        .select('partner_name, date_order, amount_total')
        .limit(5);

      sampleInvoices?.forEach((invoice, index) => {
        console.log(`   ${index + 1}. ${invoice.partner_name} - ${invoice.date_order} - Rs ${invoice.amount_total}`);
      });
      
      // Test agency-specific invoices
      console.log('\n🎯 Testing agency-specific invoices (SATHIJA AGENCY):');
      const { data: agencyInvoices } = await externalSupabase
        .from('invoices')
        .select('partner_name, date_order, amount_total')
        .eq('partner_name', 'SATHIJA AGENCY')
        .limit(3);
      
      if (agencyInvoices && agencyInvoices.length > 0) {
        console.log(`   Found ${agencyInvoices.length} invoices for SATHIJA AGENCY:`);
        agencyInvoices.forEach((invoice, index) => {
          console.log(`   ${index + 1}. ${invoice.date_order} - Rs ${invoice.amount_total}`);
        });
      } else {
        console.log('   No invoices found for SATHIJA AGENCY');
      }
    }

    console.log('\n✅ External connection test completed successfully!');
    
    if (targetsCount === 0 || invoicesCount === 0) {
      console.log('\n⚠️  Note: Some tables appear to be empty. Make sure your external project has data.');
    }

  } catch (error) {
    console.log(`❌ Connection failed: ${error.message}`);
  }
}

// Run the test
testExternalConnection().catch(console.error);