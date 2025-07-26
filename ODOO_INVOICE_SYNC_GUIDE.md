# Odoo Invoice Sync Setup Guide

This guide explains how to set up the Odoo invoice sync functionality to extract invoices from Odoo and store them in your Supabase database.

## Table of Contents

1. [Database Setup](#database-setup)
2. [Environment Configuration](#environment-configuration)
3. [Running the Migration](#running-the-migration)
4. [Using the Sync Components](#using-the-sync-components)
5. [Troubleshooting](#troubleshooting)

## Database Setup

### 1. Run the Migration

First, you need to run the database migration to create the required tables:

```bash
# Navigate to your project directory
cd /path/to/your/project

# Run the Supabase migration
npx supabase db push
```

This will create:
- `odoo_invoices` table - stores synced invoices from Odoo
- `odoo_invoice_items` table - stores invoice line items
- Proper indexes and RLS policies
- Triggers for automatic timestamp updates

### 2. Verify the Migration

After running the migration, you should see the new tables in your Supabase dashboard:

1. Go to your Supabase project dashboard
2. Navigate to **Table Editor**
3. You should see `odoo_invoices` and `odoo_invoice_items` tables

### 3. Update TypeScript Types

After the migration, regenerate your Supabase types:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts
```

Replace `YOUR_PROJECT_ID` with your actual Supabase project ID.

## Environment Configuration

### 1. Update Environment Variables

Add the following variables to your `.env` file:

```env
# Odoo API Configuration
VITE_ODOO_URL=https://your-odoo-instance.com
VITE_ODOO_DATABASE=your_database_name
VITE_ODOO_USERNAME=your_username@example.com
VITE_ODOO_PASSWORD=your_password
VITE_ODOO_API_KEY=your_api_key_here  # Optional

# For Supabase deployment, add these to your Supabase environment variables
```

### 2. Supabase Environment Variables

For production deployment, add these to your Supabase project:

1. Go to **Settings** > **Environment Variables**
2. Add the same Odoo variables with `VITE_` prefix

## Using the Sync Components

### 1. Import the Components

```tsx
import OdooInvoiceSync from '@/components/OdooInvoiceSync';
import OdooSyncedInvoices from '@/components/OdooSyncedInvoices';
```

### 2. Basic Usage

```tsx
import React from 'react';
import OdooInvoiceSync from '@/components/OdooInvoiceSync';
import OdooSyncedInvoices from '@/components/OdooSyncedInvoices';

export default function OdooPage() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">Odoo Invoice Management</h1>
      
      {/* Sync Component */}
      <OdooInvoiceSync />
      
      {/* Display Synced Invoices */}
      <OdooSyncedInvoices />
    </div>
  );
}
```

### 3. Using the Hooks Directly

```tsx
import { useOdooInvoiceSync, useOdooInvoices } from '@/hooks/useOdoo';

function MyComponent() {
  const { syncInvoices, isSyncing, syncResult } = useOdooInvoiceSync();
  const { invoices, fetchInvoices } = useOdooInvoices();

  const handleSync = async () => {
    const result = await syncInvoices(
      'your-agency-id', // Agency UUID
      '2024-01-01',     // Start date (optional)
      '2024-12-31',     // End date (optional)
      100               // Limit (optional)
    );
    
    if (result.success) {
      console.log(`Synced ${result.invoice_count} invoices`);
    }
  };

  return (
    <div>
      <button onClick={handleSync} disabled={isSyncing}>
        {isSyncing ? 'Syncing...' : 'Sync Invoices'}
      </button>
      
      {syncResult && (
        <div>
          <p>Status: {syncResult.success ? 'Success' : 'Failed'}</p>
          <p>Invoices: {syncResult.invoice_count}</p>
          <p>Errors: {syncResult.error_count}</p>
        </div>
      )}
    </div>
  );
}
```

## Database Schema

### odoo_invoices Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| odoo_id | INTEGER | Odoo invoice ID (unique) |
| odoo_name | TEXT | Odoo invoice name/number |
| partner_id | INTEGER | Odoo partner ID |
| partner_name | TEXT | Partner name |
| partner_email | TEXT | Partner email |
| partner_phone | TEXT | Partner phone |
| partner_address | TEXT | Partner address |
| invoice_date | DATE | Invoice date |
| due_date | DATE | Due date |
| amount_untaxed | NUMERIC | Untaxed amount |
| amount_tax | NUMERIC | Tax amount |
| amount_total | NUMERIC | Total amount |
| currency_id | INTEGER | Currency ID |
| currency_symbol | TEXT | Currency symbol |
| state | TEXT | Invoice state (draft, open, paid, cancelled) |
| payment_state | TEXT | Payment state (not_paid, paid, partial) |
| invoice_type | TEXT | Invoice type |
| reference | TEXT | External reference |
| notes | TEXT | Notes |
| terms_conditions | TEXT | Terms and conditions |
| agency_id | UUID | Agency ID (foreign key) |
| synced_at | TIMESTAMP | When synced |
| sync_status | TEXT | Sync status |
| error_message | TEXT | Error message if sync failed |

### odoo_invoice_items Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| odoo_invoice_id | UUID | Foreign key to odoo_invoices |
| odoo_product_id | INTEGER | Odoo product ID |
| product_name | TEXT | Product name |
| product_default_code | TEXT | Product code |
| description | TEXT | Line description |
| quantity | NUMERIC | Quantity |
| unit_price | NUMERIC | Unit price |
| price_subtotal | NUMERIC | Subtotal |
| price_tax | NUMERIC | Tax amount |
| price_total | NUMERIC | Total price |
| discount | NUMERIC | Discount percentage |
| uom_id | INTEGER | Unit of measure ID |
| uom_name | TEXT | Unit of measure name |
| sequence | INTEGER | Line sequence |

## API Reference

### OdooService Methods

#### Invoice Operations
- `getInvoices(limit?, offset?, domain?)` - Get invoices from Odoo
- `getInvoiceById(id)` - Get single invoice by ID
- `getInvoiceLines(invoiceId)` - Get invoice line items
- `getInvoicesByDateRange(startDate, endDate, limit?)` - Get invoices by date range

#### Sync Operations
- `syncInvoicesToSupabase(agencyId, startDate?, endDate?, limit?)` - Sync invoices to Supabase

### React Hooks

#### `useOdooInvoices(limit?)`
Returns invoice state and operations.

#### `useOdooInvoiceSync()`
Returns sync state and operations.

## Troubleshooting

### Common Issues

#### 1. Migration Errors
```
Error: relation "odoo_invoices" does not exist
```

**Solution:**
- Run `npx supabase db push` to apply migrations
- Check that the migration file exists in `supabase/migrations/`

#### 2. TypeScript Errors
```
Argument of type '"odoo_invoices"' is not assignable to parameter of type...
```

**Solution:**
- Regenerate Supabase types: `npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts`
- Restart your TypeScript server

#### 3. Authentication Errors
```
Error: Odoo API error: Invalid credentials
```

**Solution:**
- Check your Odoo credentials in `.env`
- Verify the user has API access permissions
- Test connection with Odoo client directly

#### 4. Sync Errors
```
Error: Failed to insert invoice
```

**Solution:**
- Check RLS policies are correct
- Verify agency_id is valid
- Check for duplicate odoo_id values

#### 5. CORS Issues
```
Error: HTTP error! status: 403
```

**Solution:**
- Configure CORS in your Odoo server
- Add your domain to allowed origins

### Debug Mode

Enable debug logging by adding to your `.env`:

```env
VITE_DEBUG_ODOO=true
```

### Testing the Setup

1. **Test Odoo Connection:**
```javascript
import odooService from '@/services/odoo.service';

// Test authentication
const success = await odooService.initialize();
console.log('Authentication:', success);
```

2. **Test Invoice Fetching:**
```javascript
// Get invoices from Odoo
const invoices = await odooService.getInvoices(10);
console.log('Invoices:', invoices);
```

3. **Test Sync:**
```javascript
// Sync invoices to Supabase
const result = await odooService.syncInvoicesToSupabase('your-agency-id', 10);
console.log('Sync result:', result);
```

## Security Considerations

1. **Environment Variables:** Never commit secrets to version control
2. **RLS Policies:** Ensure proper row-level security is in place
3. **API Permissions:** Limit Odoo user permissions to minimum required
4. **Data Validation:** Validate data before inserting into Supabase
5. **Error Handling:** Don't expose sensitive information in error messages

## Performance Tips

1. **Batch Processing:** Use limits when syncing large datasets
2. **Date Filtering:** Use date ranges to sync only recent invoices
3. **Indexes:** The migration includes proper indexes for performance
4. **Caching:** Consider caching frequently accessed data
5. **Pagination:** Use pagination for large invoice lists

## Support

For issues related to:
- **Database setup:** Check migration logs and Supabase dashboard
- **Odoo integration:** Verify credentials and API permissions
- **TypeScript errors:** Regenerate types and restart development server
- **Sync issues:** Check console logs and error messages 