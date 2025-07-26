#!/usr/bin/env node

/**
 * Script to check agencies in the main project
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

async function checkAgencies() {
  console.log('🏢 Checking agencies in main project...\n');

  // Main project client
  const mainSupabase = createClient(
    'https://ejpwmgluazqcczrpwjlo.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcHdtZ2x1YXpxY2N6cnB3amxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxMzMxMDgsImV4cCI6MjA2NDcwOTEwOH0.Y4St0B6j4xA7_Wg7P3FFr91Slubb2NO3yzxWb5dy22g'
  );

  try {
    // Check agencies table
    const { data: agencies, error: agenciesError } = await mainSupabase
      .from('agencies')
      .select('id, name')
      .order('name');

    if (agenciesError) {
      console.log('❌ Error fetching agencies:', agenciesError.message);
    } else {
      console.log(`📋 Found ${agencies?.length || 0} agencies in main project:`);
      agencies?.forEach((agency, index) => {
        console.log(`   ${index + 1}. ${agency.name} (ID: ${agency.id})`);
      });
    }

    // External project client  
    const externalSupabase = createClient(
      'https://tnduapjjyqhppclgnqsb.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZHVhcGpqeXFocHBjbGducXNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMTQ4ODcsImV4cCI6MjA2NDc5MDg4N30.4r-K4iFN0U3V9wZoWPLotFEvNVznVvxlAFLuFOvizDw'
    );

    // Get unique agency names from external project
    const { data: externalAgencies } = await externalSupabase
      .from('sales_targets')
      .select('customer_name')
      .not('customer_name', 'is', null);

    const uniqueExternalAgencies = [...new Set(externalAgencies?.map(a => a.customer_name) || [])];
    
    console.log(`\n🌐 Found ${uniqueExternalAgencies.length} unique agencies in external project:`);
    uniqueExternalAgencies.forEach((agency, index) => {
      console.log(`   ${index + 1}. ${agency}`);
    });

    // Check for matches
    console.log('\n🔍 Checking for matches between projects:');
    const matches = agencies?.filter(agency => 
      uniqueExternalAgencies.includes(agency.name)
    ) || [];

    if (matches.length > 0) {
      console.log(`✅ Found ${matches.length} matching agencies:`);
      matches.forEach((agency, index) => {
        console.log(`   ${index + 1}. ${agency.name}`);
      });
    } else {
      console.log('❌ No matching agency names found between projects');
      console.log('\n💡 You may need to:');
      console.log('   1. Add agencies to the main project that match external names');
      console.log('   2. Or update external agency names to match main project');
    }

  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

checkAgencies().catch(console.error);