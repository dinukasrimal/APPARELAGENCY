#!/usr/bin/env node

/**
 * Script to add agencies to main project that match external project
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

async function addAgencies() {
  console.log('🏢 Adding agencies to main project...\n');

  // Main project client
  const mainSupabase = createClient(
    'https://ejpwmgluazqcczrpwjlo.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcHdtZ2x1YXpxY2N6cnB3amxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxMzMxMDgsImV4cCI6MjA2NDcwOTEwOH0.Y4St0B6j4xA7_Wg7P3FFr91Slubb2NO3yzxWb5dy22g'
  );

  // Agencies from external project
  const agenciesToAdd = [
    'JAFFNA - INTHARA',
    'KURUNEGALA - INTHARA', 
    'SATHIJA AGENCY',
    'AMBALANGODA',
    'SITHUMINI ENTERPRISES',
    'HORANA - INTHARA',
    'MR OSHADA',
    'NEXUS MARKETING',
    'MR.IMAS'
  ];

  try {
    console.log(`📝 Adding ${agenciesToAdd.length} agencies...`);

    // Add agencies one by one
    for (const agencyName of agenciesToAdd) {
      const { data, error } = await mainSupabase
        .from('agencies')
        .insert({
          name: agencyName,
          created_at: new Date().toISOString()
        })
        .select();

      if (error) {
        console.log(`❌ Error adding ${agencyName}:`, error.message);
      } else {
        console.log(`✅ Added: ${agencyName} (ID: ${data[0]?.id})`);
      }
    }

    // Verify insertion
    const { data: agencies, error: fetchError } = await mainSupabase
      .from('agencies')
      .select('id, name')
      .order('name');

    if (fetchError) {
      console.log('❌ Error fetching agencies:', fetchError.message);
    } else {
      console.log(`\n📋 Total agencies in main project: ${agencies?.length || 0}`);
      agencies?.forEach((agency, index) => {
        console.log(`   ${index + 1}. ${agency.name}`);
      });
    }

    console.log('\n✅ Agency setup completed!');
    console.log('🎯 Now you can test the external targets integration.');

  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

addAgencies().catch(console.error);