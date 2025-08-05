// Simple test to check external inventory service
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bpttfrpyozxapdkbkuhb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwdHRmcnB5b3p4YXBka2JrdWhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzIyNTk4NzksImV4cCI6MjA0NzgzNTg3OX0.lUcpOu2c4BrnnOI4b_iN1Ue72yNQc7ZVSW5O8HJjjAA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testExternalInventory() {
  console.log('Testing external inventory access...');
  
  // Check if we can read from external_inventory_management
  const { data, error } = await supabase
    .from('external_inventory_management')
    .select('*')
    .limit(5);
    
  if (error) {
    console.error('Error reading external inventory:', error);
  } else {
    console.log('Sample external inventory records:', data);
  }
  
  // Check for the specific invoice
  const { data: invoiceTransactions, error: invoiceError } = await supabase
    .from('external_inventory_management')
    .select('*')
    .eq('transaction_id', '06406098-0d53-4936-acbe-21b5ae40d15e');
    
  if (invoiceError) {
    console.error('Error checking invoice transactions:', invoiceError);
  } else {
    console.log('Transactions for invoice 06406098-0d53-4936-acbe-21b5ae40d15e:', invoiceTransactions);
  }
}

testExternalInventory();