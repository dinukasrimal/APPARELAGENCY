#!/usr/bin/env node

/**
 * Final integration test to verify the fix works
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

async function testFinalIntegration() {
  console.log('🚀 Final integration test: Simulating user login and external targets loading...\n');

  // Main project client
  const mainSupabase = createClient(
    'https://ejpwmgluazqcczrpwjlo.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcHdtZ2x1YXpxY2N6cnB3amxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxMzMxMDgsImV4cCI6MjA2NDcwOTEwOH0.Y4St0B6j4xA7_Wg7P3FFr91Slubb2NO3yzxWb5dy22g'
  );

  // External project client
  const externalSupabase = createClient(
    'https://tnduapjjyqhppclgnqsb.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZHVhcGpqeXFocHBjbGducXNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMTQ4ODcsImV4cCI6MjA2NDc5MDg4N30.4r-K4iFN0U3V9wZoWPLotFEvNVznVvxlAFLuFOvizDw'
  );

  try {
    // Simulate the user login and profile loading process (Index.tsx)
    console.log('🔐 Step 1: Simulating user login and profile loading...');
    
    // Get a test agency user
    const { data: profiles } = await mainSupabase
      .from('profiles')
      .select('id, name, role, agency_id, agency_name')
      .eq('name', 'AMBALANGODA')  // Test with known working agency
      .eq('role', 'agency')
      .single();

    if (!profiles) {
      console.log('❌ Test user AMBALANGODA not found');
      return;
    }

    console.log(`✅ User profile loaded:`, {
      name: profiles.name,
      agencyId: profiles.agency_id,
      agencyName: profiles.agency_name
    });

    // Simulate the QuarterlyTargetsManagement component initialization
    console.log('\n📊 Step 2: Simulating QuarterlyTargetsManagement initialization...');
    
    // This is what happens now (direct agency name usage)
    const currentAgencyName = profiles.agency_name;
    console.log(`✅ Current agency name set to: "${currentAgencyName}"`);

    // Simulate the external data hook call
    console.log('\n🌐 Step 3: Simulating external data fetch...');
    
    if (!currentAgencyName) {
      console.log('❌ No agency name available');
      return;
    }

    // Test the external data service (same logic as useExternalSalesTargets)
    console.log(`🔍 Looking for external match for agency: "${currentAgencyName}"`);

    // Get all external customer names for fuzzy matching
    const { data: allCustomers } = await externalSupabase
      .from('sales_targets')
      .select('customer_name')
      .not('customer_name', 'is', null);

    const uniqueCustomers = [...new Set(allCustomers?.map(c => c.customer_name) || [])];
    
    // Try exact match first
    let matchingAgencyName = uniqueCustomers.find(name => name === currentAgencyName);
    
    if (!matchingAgencyName) {
      // Try fuzzy matching
      const normalizedProfile = currentAgencyName.toLowerCase().trim();
      matchingAgencyName = uniqueCustomers.find(customerName => {
        const normalizedCustomer = customerName.toLowerCase().trim();
        
        if (normalizedCustomer.includes(normalizedProfile) || 
            normalizedProfile.includes(normalizedCustomer) ||
            normalizedCustomer.startsWith(normalizedProfile) ||
            normalizedProfile.startsWith(normalizedCustomer)) {
          return true;
        }
        
        const profileWords = normalizedProfile.split(/\s+/);
        const customerWords = normalizedCustomer.split(/[\s\-]+/);
        
        const allProfileWordsFound = profileWords.every(word => 
          customerWords.some(customerWord => 
            customerWord.includes(word) || word.includes(customerWord)
          )
        );
        
        return allProfileWordsFound && profileWords.length >= 2 && customerWords.length >= 2;
      });
    }

    if (matchingAgencyName) {
      console.log(`✅ External match found: "${currentAgencyName}" -> "${matchingAgencyName}"`);
      
      // Fetch external targets
      const { data: targets, error } = await externalSupabase
        .from('sales_targets')
        .select('*')
        .eq('customer_name', matchingAgencyName)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('❌ Error fetching targets:', error.message);
      } else {
        console.log(`🎯 External targets found: ${targets?.length || 0}`);
        
        targets?.forEach((target, index) => {
          const months = target.target_months;
          let quarter = 'Q1';
          if (months.includes('07') || months.includes('08') || months.includes('09')) quarter = 'Q3';
          else if (months.includes('04') || months.includes('05') || months.includes('06')) quarter = 'Q2';
          else if (months.includes('10') || months.includes('11') || months.includes('12')) quarter = 'Q4';
          
          console.log(`   ${index + 1}. ${target.target_year} ${quarter} (${months}) - Rs ${target.initial_total_value.toLocaleString()}`);
        });

        // Test achievement calculation
        if (targets && targets.length > 0) {
          const firstTarget = targets[0];
          console.log('\n💰 Testing achievement calculation...');
          
          const { data: invoices } = await externalSupabase
            .from('invoices')
            .select('date_order, amount_total')
            .eq('partner_name', matchingAgencyName)
            .limit(5);

          console.log(`📊 Achievement invoices: ${invoices?.length || 0}`);
          const totalAchievement = invoices?.reduce((sum, inv) => sum + inv.amount_total, 0) || 0;
          console.log(`💵 Total achievement: Rs ${totalAchievement.toLocaleString()}`);
        }

        console.log('\n✅ SUCCESS: External targets integration is working!');
        console.log(`   - User "${profiles.name}" should see ${targets?.length || 0} external targets`);
        console.log(`   - Agency "${currentAgencyName}" matches external "${matchingAgencyName}"`);
        console.log(`   - Data flow: Profile -> Agency Name -> External Match -> Targets`);
      }
    } else {
      console.log(`❌ No external match found for: "${currentAgencyName}"`);
      console.log('Available external agencies:', uniqueCustomers);
    }

  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testFinalIntegration().catch(console.error);