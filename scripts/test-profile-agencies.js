#!/usr/bin/env node

/**
 * Script to test profile agency names and match with external project
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

async function testProfileAgencies() {
  console.log('🔍 Testing profile agency names and external matching...\n');

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
    // Check profiles table for agency names
    console.log('📋 Checking profiles table for agency information...');
    const { data: profiles, error: profilesError } = await mainSupabase
      .from('profiles')
      .select('id, name, role, agency_id, agency_name')
      .not('agency_name', 'is', null);

    if (profilesError) {
      console.log('❌ Error fetching profiles:', profilesError.message);
    } else {
      console.log(`✅ Found ${profiles?.length || 0} profiles with agency names:`);
      profiles?.forEach((profile, index) => {
        console.log(`   ${index + 1}. ${profile.name} (${profile.role}) - Agency: "${profile.agency_name}" (ID: ${profile.agency_id})`);
      });
    }

    // Get external project agency names
    console.log('\n🌐 Getting external project agency names...');
    const { data: externalAgencies } = await externalSupabase
      .from('sales_targets')
      .select('customer_name')
      .not('customer_name', 'is', null);

    const uniqueExternalAgencies = [...new Set(externalAgencies?.map(a => a.customer_name) || [])];
    console.log(`✅ Found ${uniqueExternalAgencies.length} unique external agencies:`);
    uniqueExternalAgencies.forEach((agency, index) => {
      console.log(`   ${index + 1}. "${agency}"`);
    });

    // Check for matches
    console.log('\n🔍 Checking for matches between profile and external agency names:');
    if (profiles && profiles.length > 0) {
      const matches = profiles.filter(profile => 
        uniqueExternalAgencies.includes(profile.agency_name)
      );

      if (matches.length > 0) {
        console.log(`✅ Found ${matches.length} matching agencies:`);
        matches.forEach((profile, index) => {
          console.log(`   ${index + 1}. Profile: "${profile.agency_name}" matches external agency`);
          console.log(`      User: ${profile.name} (${profile.role})`);
        });
        
        // Test external data for one of the matches
        if (matches.length > 0) {
          const testAgency = matches[0];
          console.log(`\n🎯 Testing external data for: "${testAgency.agency_name}"`);
          
          const { data: targets } = await externalSupabase
            .from('sales_targets')
            .select('*')
            .eq('customer_name', testAgency.agency_name);
          
          console.log(`   Sales targets: ${targets?.length || 0}`);
          targets?.forEach((target, index) => {
            console.log(`   ${index + 1}. ${target.target_year} ${target.target_months} - Rs ${target.initial_total_value}`);
          });
          
          const { data: invoices } = await externalSupabase
            .from('invoices')
            .select('*')
            .eq('partner_name', testAgency.agency_name)
            .limit(3);
          
          console.log(`   Recent invoices: ${invoices?.length || 0}`);
          invoices?.forEach((invoice, index) => {
            console.log(`   ${index + 1}. ${invoice.date_order} - Rs ${invoice.amount_total}`);
          });
        }
      } else {
        console.log('❌ No matching agency names found between profiles and external project');
        
        if (profiles.length > 0) {
          console.log('\n💡 Profile agency names:');
          profiles.forEach(p => console.log(`   - "${p.agency_name}"`));
        }
        
        console.log('\n💡 External agency names:');
        uniqueExternalAgencies.forEach(name => console.log(`   - "${name}"`));
      }
    } else {
      console.log('❌ No profiles with agency names found');
    }

  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testProfileAgencies().catch(console.error);