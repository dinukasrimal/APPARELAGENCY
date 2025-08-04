# Instructions to Run the Stock IN Cleanup

## Steps to Execute the Cleanup

### 1. Connect to your Supabase database
- Go to your Supabase dashboard
- Navigate to SQL Editor
- Or use your preferred database client

### 2. Run the cleanup script
Execute the file: `restrict_stock_in_final.sql`

### 3. Expected Results

**Before cleanup, you might see:**
```
Current Stock IN Sources:
- external_invoice: 150 transactions, 500 total stock
- customer_return: 25 transactions, 75 total stock  
- adjustment: 30 transactions, 100 total stock
- grn: 40 transactions, 200 total stock ← UNWANTED
```

**After cleanup, you should see:**
```
Final Stock IN Summary:
- external_invoice: 150 transactions, 500 total stock ✅
- customer_return: 25 transactions, 75 total stock ✅  
- adjustment: 30 transactions, 100 total stock ✅
```

### 4. Verification Steps

After running the script, verify:

1. **Check the External Inventory UI** - products should only show stock from your 3 approved sources
2. **No more "OTHER" category issues** - categories should now come consistently from products table
3. **Adjustments still work** - you can still create and approve stock adjustments
4. **No GRN stock** - GRN transactions should no longer add inventory

### 5. Safety Features

✅ **Backup created**: `external_inventory_backup_final` table  
✅ **Constraints updated**: Database prevents future unwanted stock IN  
✅ **Categories fixed**: Uses products table for consistent categorization  
✅ **Adjustments preserved**: Full adjustment workflow maintained  

### 6. If something goes wrong

To rollback:
```sql
-- Restore from backup if needed
DELETE FROM external_inventory_management;
INSERT INTO external_inventory_management 
SELECT * FROM external_inventory_backup_final;
```

## Next Steps After Running

1. **Test the External Inventory Management UI** - should show clean categories
2. **Test sync functionality** - run a sync to see new invoices with proper categories  
3. **Test adjustments** - create a test adjustment to ensure approval workflow works
4. **Monitor for a few days** - make sure no unwanted stock appears

## Expected Benefits

- ✅ Clean category structure (no more "OTHER" or inconsistent categories)
- ✅ Only approved stock IN sources
- ✅ Faster sync (last 50 invoices + duplicate detection)  
- ✅ Categories from products table (consistent)
- ✅ All adjustment functionality preserved