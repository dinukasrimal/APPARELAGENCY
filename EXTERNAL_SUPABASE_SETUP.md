# External Supabase Integration Setup Guide

This guide will help you configure the integration with your other Supabase project that contains the `invoices` and `sales_targets` tables.

## Prerequisites

1. Two Supabase projects:
   - **Main project**: The current apparel agency flow project
   - **External project**: Your other project containing invoices and sales_targets tables

## Step 1: Get External Project Credentials

1. Go to your external Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy the following values:
   - **Project URL** (e.g., `https://your-project-id.supabase.co`)
   - **Anon/Public Key** (the `anon` key)

## Step 2: Configure Environment Variables

Update your `.env` file with the external project credentials:

```env
# External Supabase Project Configuration
NEXT_PUBLIC_EXTERNAL_SUPABASE_URL=https://your-external-project-id.supabase.co
NEXT_PUBLIC_EXTERNAL_SUPABASE_ANON_KEY=your_external_project_anon_key_here
```

## Step 3: Required Table Structure

Your external project should have these tables with the following structure:

### `sales_targets` table
```sql
CREATE TABLE sales_targets (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,  -- This matches agency names
  target_year INTEGER NOT NULL,
  target_months TEXT NOT NULL,  -- e.g., "Q1", "Jan-Mar", etc.
  base NUMERIC,
  year INTEGER,
  target JSONB,
  data JSONB,
  initial_total_value NUMERIC NOT NULL DEFAULT 0,
  adjusted_total_value NUMERIC NOT NULL DEFAULT 0,
  percentage_increase NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT
);
```

### `invoices` table
```sql
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  name TEXT,
  partner_name TEXT NOT NULL,  -- This matches agency names
  date_order DATE NOT NULL,
  amount_total NUMERIC NOT NULL DEFAULT 0,
  state TEXT,
  order_lines JSONB
);
```

## Step 4: Configure Row Level Security (RLS)

If your external project has RLS enabled, you may need to create policies that allow read access:

```sql
-- Allow read access to sales_targets
CREATE POLICY "Allow read access to sales_targets" ON sales_targets
  FOR SELECT USING (true);

-- Allow read access to invoices
CREATE POLICY "Allow read access to invoices" ON invoices
  FOR SELECT USING (true);
```

## Step 5: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Log in as an agency user
3. Navigate to the **Targets** section in the sidebar
4. You should see:
   - **Internal Targets**: Targets from the main project
   - **External Targets**: Targets from your external project filtered by agency name
   - **Combined View**: Both internal and external data combined

## Step 6: Verify Data Filtering

The integration filters data based on agency names:
- **Sales Targets**: Where `customer_name` matches the current agency name
- **Invoices**: Where `partner_name` matches the current agency name

Make sure your agency names in both projects match exactly.

## Troubleshooting

### Connection Issues
- Check that environment variables are set correctly
- Verify the external project URL and API key
- Ensure the external project is accessible

### No Data Showing
- Verify agency names match between projects
- Check that the external tables contain data
- Look at browser console for error messages

### RLS Issues
- Make sure read policies are configured on external tables
- Consider temporarily disabling RLS for testing

## Data Flow

1. **Agency Login**: User logs in with agency credentials
2. **Agency Name Resolution**: System gets the agency name from the current user
3. **External Data Fetch**: System queries external project for:
   - Sales targets where `customer_name = agency_name`
   - Invoices where `partner_name = agency_name` (for achievement calculation)
4. **Achievement Calculation**: System calculates achievements based on invoice amounts within target date ranges
5. **Display**: Combined data is shown in the targets management interface

## Security Notes

- Only read access is required to the external project
- No data is written to the external project
- Authentication is handled separately for each project
- Data is filtered by agency name to ensure proper access control