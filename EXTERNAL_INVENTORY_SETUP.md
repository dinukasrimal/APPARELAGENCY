# External Inventory Setup Guide

This guide explains how to set up the external inventory feature that treats external invoices as stock IN and internal invoices as stock OUT.

## Database Migration

**IMPORTANT**: You need to apply the database migration before using the external inventory features.

### Step 1: Apply the Migration

Run this SQL in your Supabase SQL editor:

```sql
-- Migration: Add external_invoice transaction type to inventory_transactions
-- This allows external invoices to be used as stock IN transactions

-- Drop the existing check constraint
ALTER TABLE public.inventory_transactions 
DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;

-- Add the new constraint with external_invoice included
ALTER TABLE public.inventory_transactions 
ADD CONSTRAINT inventory_transactions_transaction_type_check 
CHECK (transaction_type IN ('grn_acceptance', 'invoice_creation', 'customer_return', 'company_return', 'adjustment', 'external_invoice'));

-- Add a column to track external invoice line item details
ALTER TABLE public.inventory_transactions 
ADD COLUMN IF NOT EXISTS external_product_name TEXT,
ADD COLUMN IF NOT EXISTS external_product_category TEXT,
ADD COLUMN IF NOT EXISTS external_invoice_id TEXT;

-- Create index on external fields for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_external_invoice 
ON public.inventory_transactions(external_invoice_id) 
WHERE transaction_type = 'external_invoice';

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_external_category 
ON public.inventory_transactions(external_product_category) 
WHERE transaction_type = 'external_invoice';

-- Add comment for documentation
COMMENT ON COLUMN public.inventory_transactions.external_product_name IS 'Original product name from external invoice (for reference and matching)';
COMMENT ON COLUMN public.inventory_transactions.external_product_category IS 'Product category from external invoice';
COMMENT ON COLUMN public.inventory_transactions.external_invoice_id IS 'Reference to external invoice ID that created this transaction';
```

### Step 2: Verify Setup

After applying the migration, verify everything is working:

1. Go to the **Inventory** module in your application
2. You should see three tabs:
   - **Stock Overview**: Current inventory levels
   - **Stock Movements**: Recent transactions with external/internal indicators
   - **External vs Internal**: Detailed stock balance showing external stock IN vs internal stock OUT

## How It Works

### Stock IN (External Invoices)
- External invoices from your external database are processed as stock additions
- Products are automatically matched to your internal catalog using:
  - Product name similarity
  - Category matching
  - Size and color extraction
- Quantities from `qty_delivered` in external invoice `order_lines` are added to stock

### Stock OUT (Internal Invoices)
- Internal invoices continue to work as before
- When you create invoices in the system, they reduce stock
- All existing inventory transaction types are preserved

### Stock Balance Calculation
- **Current Stock**: Real-time stock levels maintained by triggers
- **Stock IN**: Sum of external invoices + GRN acceptance + customer returns
- **Stock OUT**: Sum of internal invoices + company returns + adjustments
- **Balance**: Stock IN - Stock OUT (should match current stock)
- **Variance**: Difference between current stock and calculated balance

## Using the Features

### Sync External Stock
1. Click **"Sync External Stock"** button in the inventory module
2. The system will:
   - Fetch external invoices for your user/agency
   - Match products to your internal catalog
   - Create inventory transactions for matched products
   - Skip already processed invoices

### View Stock Balance
1. Go to **"External vs Internal"** tab
2. See detailed breakdown of:
   - Stock IN from external sources
   - Stock OUT from internal sales
   - Calculated balance vs current stock
   - Variance analysis

### Monitor Stock Movements
1. Go to **"Stock Movements"** tab
2. View recent transactions with indicators for:
   - External vs Internal sources
   - Stock IN (green) vs Stock OUT (red)
   - Original external product names and categories

## Product Matching Logic

The system automatically matches external products to internal catalog using:

1. **Category Matching** (30% weight): Matches product categories
2. **Product Name Matching** (50% weight): 
   - Exact match (50 points)
   - Partial match (35 points)
   - Word-level matching (up to 25 points)
3. **Color Detection** (10% weight): Extracts color from product name
4. **Size Detection** (5% weight): Extracts size from product name

**Minimum Confidence**: 30% required for automatic matching

## Troubleshooting

### Products Not Matching
- Check that your internal product catalog has similar names to external products
- Ensure categories are consistent between systems
- Use the **"External vs Internal"** tab to see unmatched products
- Manually adjust product names in your catalog for better matching

### Stock Variances
- Small variances (±1-2 units) are normal due to timing differences
- Large variances may indicate:
  - Missing external invoice sync
  - Unmatched products
  - Manual stock adjustments not recorded

### Performance
- The system processes external invoices in batches
- Already processed invoices are automatically skipped
- Indexes are created for optimal query performance

## Data Flow

```
External Database (Stock IN)
    ↓
External Invoices → Product Matching → Inventory Transactions
    ↓
Automatic Stock Balance Update (via triggers)
    ↓
Current Stock Levels

Internal System (Stock OUT)
    ↓
Internal Invoices → Inventory Transactions → Stock Reduction
```

This creates a unified inventory system where external invoices provide stock replenishment and internal invoices track sales, giving you complete visibility into your stock movements and balances.