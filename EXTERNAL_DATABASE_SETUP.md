# External Bot Project Invoices - Database Setup Instructions

## Overview
This setup creates a connection between your Supabase project and the external bot project database to sync invoice data.

## Files Created
1. `20250731000003_create_external_bot_project_invoices.sql` - Creates the target table
2. `20250731000004_setup_external_database_connection.sql` - Sets up the foreign data wrapper connection

## Setup Instructions

### Step 1: Update Connection Details
Before running the migrations, you need to update the following placeholders in `20250731000004_setup_external_database_connection.sql`:

```sql
-- Replace these with your actual external database credentials:
host 'your-external-database-host.com',
port '5432',
dbname 'your-external-database-name'

user 'your-external-username',
password 'your-external-password'
```

### Step 2: Run the Migrations
Execute the migrations in order:
1. First run `20250731000003_create_external_bot_project_invoices.sql`
2. Then run `20250731000004_setup_external_database_connection.sql`

### Step 3: Test the Connection
After setup, test the connection using:
```sql
SELECT * FROM test_external_connection();
```

### Step 4: Sync the Data
To sync invoice data from the external database:
```sql
SELECT * FROM sync_external_bot_invoices();
```

## Available Functions

### `sync_external_bot_invoices()`
- Syncs all invoice data from the external database
- Clears existing data and inserts fresh data
- Returns sync status and record count

### `test_external_connection()`
- Tests the connection to the external database
- Returns connection status and sample data
- Useful for troubleshooting

### `schedule_external_sync()`
- Wrapper function for scheduled synchronization
- Can be called by cron jobs or scheduled tasks

## Table Structure
The `external_bot_project_invoices` table includes:
- `id` - Primary key
- `invoice_number` - Invoice number from external system
- `customer_id` - Customer ID from external system
- `customer_name` - Customer name
- `invoice_date` - Invoice date
- `due_date` - Payment due date
- `subtotal` - Subtotal amount
- `tax_amount` - Tax amount
- `discount_amount` - Discount amount
- `total_amount` - Total invoice amount
- `status` - Invoice status
- `payment_status` - Payment status
- `notes` - Additional notes
- `agency_id` - Agency ID (if applicable)
- `sales_rep_id` - Sales representative ID
- `billing_address` - Billing address
- `shipping_address` - Shipping address
- `terms_conditions` - Terms and conditions
- `currency` - Currency (defaults to LKR)
- `created_at` - Record creation timestamp
- `updated_at` - Record update timestamp

## View Available
`external_bot_invoices_view` - Simplified view showing key invoice information

## Security
- Row Level Security (RLS) is enabled
- Appropriate policies are set for read/write access
- Functions have proper permission grants

## Troubleshooting

### Common Issues:
1. **Connection Error**: Check host, port, database name, username, and password
2. **Permission Error**: Ensure the external database user has SELECT permissions on the invoices table
3. **Extension Error**: The `postgres_fdw` extension requires superuser privileges

### Testing Commands:
```sql
-- Test basic connection
SELECT * FROM test_external_connection();

-- Check external table directly (after setup)
SELECT COUNT(*) FROM public.external_invoices_fdw;

-- View synced data
SELECT * FROM public.external_bot_invoices_view LIMIT 10;
```

## Scheduling Automatic Sync
To set up automatic synchronization, you can:
1. Use Supabase Edge Functions with cron
2. Set up a server-side cron job that calls the sync function
3. Use pg_cron extension (if available)

Example Edge Function call:
```javascript
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  
  const { data, error } = await supabase.rpc('sync_external_bot_invoices')
  
  if (error) {
    return res.status(500).json({ error: error.message })
  }
  
  return res.status(200).json({ success: true, data })
}
```