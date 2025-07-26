#!/usr/bin/env node

/**
 * Script to test fuzzy matching for agency names
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

async function testFuzzyMatching() {
  console.log('🔍 Testing fuzzy matching for agency names...\n');

  // External project client
  const externalSupabase = createClient(
    'https://tnduapjjyqhppclgnqsb.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZHVhcGpqeXFocHBjbGducXNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMTQ4ODcsImV4cCI6MjA2NDc5MDg4N30.4r-K4iFN0U3V9wZoWPLotFEvNVznVvxlAFLuFOvizDw'
  );

  // Test cases from our profile data
  const testCases = [
    'AMBALANGODA',       // Should match exactly
    'SATHIJA',           // Should fuzzy match "SATHIJA AGENCY"
    'INTHARA JAFFNA',    // Should fuzzy match "JAFFNA - INTHARA"
    'INTHARA HORANA',    // Should fuzzy match "HORANA - INTHARA"
    'OSHADA',            // Should fuzzy match "MR OSHADA"
    'NEXUS',             // Should fuzzy match "NEXUS MARKETING"
    'KANDY'              // Should not match anything
  ];

  try {
    // Get all external customer names
    const { data: allCustomers } = await externalSupabase
      .from('sales_targets')
      .select('customer_name')
      .not('customer_name', 'is', null);

    const uniqueCustomers = [...new Set(allCustomers?.map(c => c.customer_name) || [])];
    
    console.log('📋 External customer names:');
    uniqueCustomers.forEach((name, index) => {
      console.log(`   ${index + 1}. "${name}"`);
    });

    console.log('\n🎯 Testing fuzzy matching:');

    for (const testCase of testCases) {
      console.log(`\n   Testing: "${testCase}"`);
      
      // First try exact match
      const exactMatch = uniqueCustomers.find(name => name === testCase);
      if (exactMatch) {
        console.log(`   ✅ Exact match: "${exactMatch}"`);
        continue;
      }

      // Try fuzzy matching
      const normalizedTest = testCase.toLowerCase().trim();
      const fuzzyMatch = uniqueCustomers.find(customerName => {
        const normalizedCustomer = customerName.toLowerCase().trim();
        
        // Check basic string matches first
        if (normalizedCustomer.includes(normalizedTest) || 
            normalizedTest.includes(normalizedCustomer) ||
            normalizedCustomer.startsWith(normalizedTest) ||
            normalizedTest.startsWith(normalizedCustomer)) {
          return true;
        }
        
        // Handle word order differences like "INTHARA JAFFNA" vs "JAFFNA - INTHARA"
        const testWords = normalizedTest.split(/\s+/);
        const customerWords = normalizedCustomer.split(/[\s\-]+/);
        
        // Check if all words from test exist in customer (in any order)
        const allTestWordsFound = testWords.every(word => 
          customerWords.some(customerWord => 
            customerWord.includes(word) || word.includes(customerWord)
          )
        );
        
        return allTestWordsFound && testWords.length >= 2 && customerWords.length >= 2;
      });

      if (fuzzyMatch) {
        console.log(`   🎯 Fuzzy match: "${fuzzyMatch}"`);
        
        // Test getting data for this match
        const { data: targets } = await externalSupabase
          .from('sales_targets')
          .select('target_year, target_months, initial_total_value')
          .eq('customer_name', fuzzyMatch);
        
        console.log(`   📊 Found ${targets?.length || 0} targets for this agency`);
      } else {
        console.log(`   ❌ No match found`);
      }
    }

  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testFuzzyMatching().catch(console.error);