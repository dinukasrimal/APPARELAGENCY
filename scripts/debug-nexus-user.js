#!/usr/bin/env node

/**
 * Debug script specifically for NEXUS MARKETING user
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

async function debugNexusUser() {
  console.log('🔍 Debugging NEXUS MARKETING user specifically...\n');

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
    // Step 1: Find NEXUS MARKETING user profile
    console.log('👤 Step 1: Finding NEXUS MARKETING user profile...');
    
    const { data: nexusProfiles, error: profileError } = await mainSupabase
      .from('profiles')
      .select('*')
      .or('name.ilike.%nexus%,agency_name.ilike.%nexus%');

    if (profileError) {
      console.log('❌ Error fetching NEXUS profiles:', profileError.message);
      return;
    }

    console.log(`📋 Found ${nexusProfiles?.length || 0} profiles matching "nexus":`);
    nexusProfiles?.forEach((profile, index) => {
      console.log(`   ${index + 1}. Name: "${profile.name}", Agency: "${profile.agency_name}", Role: ${profile.role}, ID: ${profile.id}`);
    });

    if (!nexusProfiles || nexusProfiles.length === 0) {
      console.log('❌ No NEXUS profiles found');
      return;
    }

    // Focus on the agency user
    const nexusUser = nexusProfiles.find(p => p.role === 'agency') || nexusProfiles[0];
    console.log(`\n🎯 Testing with user: "${nexusUser.name}", Agency: "${nexusUser.agency_name}"`);

    // Step 2: Test the exact flow that happens in the app
    console.log('\n📱 Step 2: Simulating app login flow...');
    
    // This is what Index.tsx does - loads profile data
    const appUser = {
      id: nexusUser.id,
      name: nexusUser.name,
      email: nexusUser.email || 'test@example.com',
      role: nexusUser.role,
      agencyId: nexusUser.agency_id,
      agencyName: nexusUser.agency_name
    };
    
    console.log('📱 App user object:', appUser);

    // Step 3: Test what QuarterlyTargetsManagement does
    console.log('\n📊 Step 3: Simulating QuarterlyTargetsManagement...');
    
    const currentAgencyName = appUser.agencyName;
    console.log(`✅ currentAgencyName set to: "${currentAgencyName}"`);

    if (!currentAgencyName) {
      console.log('❌ No agency name in user profile!');
      return;
    }

    // Step 4: Test external data service call
    console.log('\n🌐 Step 4: Testing external data service...');
    
    // Get all external agencies first
    const { data: allCustomers } = await externalSupabase
      .from('sales_targets')
      .select('customer_name')
      .not('customer_name', 'is', null);

    const uniqueCustomers = [...new Set(allCustomers?.map(c => c.customer_name) || [])];
    console.log('📋 Available external agencies:', uniqueCustomers);

    // Test fuzzy matching logic
    console.log(`\n🔍 Testing fuzzy match for: "${currentAgencyName}"`);
    
    // Exact match first
    let matchingAgencyName = uniqueCustomers.find(name => name === currentAgencyName);
    console.log('Exact match result:', matchingAgencyName || 'None');

    if (!matchingAgencyName) {
      // Fuzzy matching
      const normalizedProfile = currentAgencyName.toLowerCase().trim();
      console.log(`Normalized profile name: "${normalizedProfile}"`);
      
      matchingAgencyName = uniqueCustomers.find(customerName => {
        const normalizedCustomer = customerName.toLowerCase().trim();
        console.log(`  Comparing with: "${normalizedCustomer}"`);
        
        const basicMatch = normalizedCustomer.includes(normalizedProfile) || 
                          normalizedProfile.includes(normalizedCustomer) ||
                          normalizedCustomer.startsWith(normalizedProfile) ||
                          normalizedProfile.startsWith(normalizedCustomer);
        
        if (basicMatch) {
          console.log(`    ✅ Basic match found with: "${customerName}"`);
          return true;
        }
        
        const profileWords = normalizedProfile.split(/\s+/);
        const customerWords = normalizedCustomer.split(/[\s\-]+/);
        
        const allProfileWordsFound = profileWords.every(word => 
          customerWords.some(customerWord => 
            customerWord.includes(word) || word.includes(customerWord)
          )
        );
        
        if (allProfileWordsFound && profileWords.length >= 2 && customerWords.length >= 2) {
          console.log(`    ✅ Word match found with: "${customerName}"`);
          return true;
        }
        
        return false;
      });
    }

    if (matchingAgencyName) {
      console.log(`\n✅ Final match: "${currentAgencyName}" -> "${matchingAgencyName}"`);
      
      // Test actual data fetch
      const { data: targets, error: targetsError } = await externalSupabase
        .from('sales_targets')
        .select('*')
        .eq('customer_name', matchingAgencyName);

      if (targetsError) {
        console.log('❌ Error fetching targets:', targetsError.message);
      } else {
        console.log(`🎯 Targets found: ${targets?.length || 0}`);
        targets?.forEach(target => {
          console.log(`   - ${target.target_year} ${target.target_months}: Rs ${target.initial_total_value.toLocaleString()}`);
        });
      }
    } else {
      console.log(`\n❌ No match found for: "${currentAgencyName}"`);
      console.log('🔍 Manual check - looking for partial matches:');
      uniqueCustomers.forEach(customer => {
        if (customer.toLowerCase().includes('nexus') || 'nexus'.includes(customer.toLowerCase())) {
          console.log(`   Potential match: "${customer}"`);
        }
      });
    }

  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

debugNexusUser().catch(console.error);