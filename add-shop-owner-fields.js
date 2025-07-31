// Script to add shop owner fields to customers table
import { createClient } from '@supabase/supabase-js';

// You'll need to replace these with your actual Supabase URL and key
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addShopOwnerFields() {
  try {
    console.log('Adding shop owner fields to customers table...');
    
    // First, let's check the current table structure
    const { data: columns } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'customers')
      .eq('table_schema', 'public');
    
    console.log('Current columns:', columns?.map(c => c.column_name));
    
    // Check if the columns already exist
    const hasShopOwnerName = columns?.some(c => c.column_name === 'shop_owner_name');
    const hasShopOwnerBirthday = columns?.some(c => c.column_name === 'shop_owner_birthday');
    
    if (hasShopOwnerName && hasShopOwnerBirthday) {
      console.log('Shop owner fields already exist!');
      return;
    }
    
    // Since we can't run DDL through regular client, we'll need to use SQL directly
    // This requires admin/service role key
    console.log('Note: You need to run the following SQL in your Supabase dashboard:');
    console.log(`
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS shop_owner_name TEXT,
ADD COLUMN IF NOT EXISTS shop_owner_birthday DATE;

COMMENT ON COLUMN public.customers.shop_owner_name IS 'Name of the shop owner';
COMMENT ON COLUMN public.customers.shop_owner_birthday IS 'Birthday of the shop owner';
    `);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

addShopOwnerFields();