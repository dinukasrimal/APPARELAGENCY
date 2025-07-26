# Data Migration Guide: External Tables Integration

This guide helps you migrate data from your other Supabase project to the current project's external tables.

## 📋 Prerequisites

1. ✅ Run database migrations in current project:
   ```bash
   supabase db push
   ```

2. ✅ Verify new tables exist:
   - `external_sales_targets`
   - `external_invoices`

## 🔄 Migration Methods

### Method 1: CSV Export/Import (Recommended)

#### Step 1: Export from Your Other Project

**Export sales_targets table:**
1. Go to your other Supabase project dashboard
2. Navigate to Table Editor → `sales_targets`
3. Click "Export" → "Export as CSV"
4. Save as `sales_targets_export.csv`

**Export invoices table:**
1. Navigate to Table Editor → `invoices`
2. Click "Export" → "Export as CSV"  
3. Save as `invoices_export.csv`

#### Step 2: Prepare CSV Files for Import

**For sales_targets_export.csv:**
- Ensure columns match: `id, customer_name, target_year, target_months, base_year, target_data, initial_total_value, adjusted_total_value, percentage_increase, created_by`
- Verify `customer_name` values match your agency names exactly

**For invoices_export.csv:**
- Ensure columns match: `id, name, partner_name, date_order, amount_total, state, order_lines`
- Verify `partner_name` values match your agency names exactly

#### Step 3: Import to Current Project

**Import sales_targets:**
1. Go to current project's Supabase dashboard
2. Navigate to Table Editor → `external_sales_targets`
3. Click "Insert" → "Import CSV"
4. Upload `sales_targets_export.csv`
5. Map columns correctly
6. Click "Import"

**Import invoices:**
1. Navigate to Table Editor → `external_invoices`
2. Click "Insert" → "Import CSV"
3. Upload `invoices_export.csv`
4. Map columns correctly
5. Click "Import"

### Method 2: SQL Script Migration

If CSV export/import doesn't work, use the SQL scripts provided:

1. **Copy data manually using SQL:**
   ```sql
   -- See scripts/data-migration.sql for examples
   ```

2. **Use Supabase SQL Editor:**
   - Run INSERT statements with your actual data
   - Use the template in `scripts/data-migration.sql`

## 🔍 Field Mapping Reference

### sales_targets → external_sales_targets

| Source Field | Target Field | Notes |
|--------------|--------------|-------|
| id | id | Direct mapping |
| customer_name | customer_name | **Must match agency names** |
| target_year | target_year | Direct mapping |
| target_months | target_months | Direct mapping |
| base | base_year | Renamed field |
| year | target_year | May be duplicate, use target_year |
| target | target_data | Store as JSON |
| data | target_data | Store as JSON |
| initial_total_value | initial_total_value | Direct mapping |
| adjusted_total_value | adjusted_total_value | Direct mapping |
| percentage_increase | percentage_increase | Direct mapping |
| created_at | created_at | Auto-generated if not provided |
| updated_at | updated_at | Auto-generated |
| created_by | created_by | Direct mapping |

### invoices → external_invoices

| Source Field | Target Field | Notes |
|--------------|--------------|-------|
| id | id | Direct mapping |
| name | name | Direct mapping |
| partner_name | partner_name | **Must match agency names** |
| date_order | date_order | Direct mapping |
| amount_total | amount_total | Direct mapping |
| state | state | Direct mapping |
| order_lines | order_lines | Store as JSON |

## ⚠️ Critical Requirements

### Agency Name Matching

The integration **depends on exact agency name matching**:

- `sales_targets.customer_name` = Agency Name
- `invoices.partner_name` = Agency Name

**Verify your agency names:**
```sql
-- Check existing agencies in current project
SELECT id, name FROM public.agencies ORDER BY name;
```

**Common issues:**
- Case sensitivity: "Agency A" ≠ "agency a" 
- Extra spaces: "Agency A " ≠ "Agency A"
- Different naming: "Agency A Ltd" ≠ "Agency A"

### Data Validation

After import, run validation queries:

```sql
-- Check import counts
SELECT COUNT(*) FROM external_sales_targets;
SELECT COUNT(*) FROM external_invoices;

-- Verify agency name matching
SELECT DISTINCT customer_name FROM external_sales_targets 
WHERE customer_name NOT IN (SELECT name FROM agencies);

SELECT DISTINCT partner_name FROM external_invoices 
WHERE partner_name NOT IN (SELECT name FROM agencies);
```

## 🧪 Testing the Integration

1. **Run migrations:**
   ```bash
   supabase db push
   ```

2. **Import your data** using Method 1 or 2

3. **Test the UI:**
   - Log in as agency user
   - Navigate to Targets section
   - Switch between data source tabs:
     - **Internal** - Original quarterly targets
     - **External** - Your imported sales targets
     - **Combined** - Merged view
   - Verify filtering works by agency

4. **Check console logs:**
   - Open browser dev tools
   - Look for debug messages:
     - "Fetching external targets for user..."
     - "External achievement date range..."
     - Agency name matching logs

## 🐛 Troubleshooting

### No External Data Showing

1. **Check RLS policies:**
   ```sql
   -- Test if data exists
   SELECT COUNT(*) FROM external_sales_targets;
   SELECT COUNT(*) FROM external_invoices;
   ```

2. **Verify agency name matching:**
   ```sql
   -- Check if current user's agency name matches external data
   SELECT 
     p.agency_id,
     a.name as agency_name,
     COUNT(st.id) as target_count
   FROM profiles p
   JOIN agencies a ON p.agency_id = a.id
   LEFT JOIN external_sales_targets st ON a.name = st.customer_name
   WHERE p.id = auth.uid()
   GROUP BY p.agency_id, a.name;
   ```

3. **Check console errors** in browser dev tools

### White Screen Issues

1. **Check component errors** in browser console
2. **Verify TypeScript compilation** - no type errors
3. **Test with superuser role** first

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Verify data import was successful  
3. Test agency name matching queries
4. Ensure RLS policies are working correctly

The integration should work seamlessly once data is properly imported with matching agency names! 🎯