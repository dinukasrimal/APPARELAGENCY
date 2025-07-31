-- Migration: Populate internal_stock_movements with existing inventory transaction data
-- Purpose: Migrate historical data to new internal stock movements architecture
-- Date: 2025-01-30

-- IMPORTANT: Run this migration after the internal_stock_movements table is created
-- This script migrates existing inventory_transactions to the new internal_stock_movements table

DO $$
DECLARE
    migration_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    -- Log migration start
    RAISE NOTICE 'Starting migration of existing inventory transactions to internal_stock_movements table...';
    
    -- Insert existing inventory transactions as internal stock movements
    INSERT INTO internal_stock_movements (
        external_source,
        external_reference_id,
        external_document_number,
        agency_id,
        product_id,
        product_name,
        color,
        size,
        movement_type,
        quantity,
        unit_price,
        total_value,
        source_document_type,
        source_document_date,
        source_customer_name,
        source_notes,
        external_product_name,
        external_product_category,
        match_confidence,
        processed_to_inventory,
        inventory_transaction_id,
        sync_id,
        created_at,
        processed_at
    )
    SELECT 
        -- Map transaction types to external sources
        CASE 
            WHEN it.transaction_type = 'external_invoice' THEN 'odoo'
            WHEN it.transaction_type IN ('grn_acceptance', 'grn_creation') THEN 'grn'
            WHEN it.transaction_type IN ('customer_return', 'company_return') THEN 'returns'
            WHEN it.transaction_type LIKE '%adjustment%' THEN 'manual'
            WHEN it.transaction_type = 'invoice_creation' THEN 'internal_sales'
            ELSE 'legacy_migration'
        END as external_source,
        
        it.reference_id as external_reference_id,
        it.reference_name as external_document_number,
        it.agency_id,
        it.product_id,
        it.product_name,
        COALESCE(it.color, 'Default') as color,
        COALESCE(it.size, 'Default') as size,
        
        -- Determine movement type based on quantity sign
        CASE 
            WHEN it.quantity > 0 THEN 'stock_in'::VARCHAR
            ELSE 'stock_out'::VARCHAR
        END as movement_type,
        
        ABS(it.quantity) as quantity, -- Always store positive quantity
        
        -- Calculate unit price from total if available
        CASE 
            WHEN it.quantity != 0 AND it.total_value IS NOT NULL 
            THEN ABS(it.total_value / it.quantity)
            ELSE 0
        END as unit_price,
        
        COALESCE(ABS(it.total_value), 0) as total_value,
        it.transaction_type as source_document_type,
        
        -- Extract date from created_at
        it.created_at::DATE as source_document_date,
        
        -- Try to extract customer name from reference_name or notes
        CASE 
            WHEN it.reference_name ~* 'customer|invoice' 
            THEN REGEXP_REPLACE(it.reference_name, '^(Invoice|Order|Customer)\s*', '', 'i')
            ELSE NULL
        END as source_customer_name,
        
        COALESCE(it.notes, 'Migrated from legacy inventory_transactions') as source_notes,
        it.external_product_name,
        it.external_product_category,
        it.match_confidence,
        
        true as processed_to_inventory, -- Mark as processed since these are from inventory_transactions
        it.id as inventory_transaction_id,
        'legacy_migration' as sync_id,
        it.created_at,
        it.created_at as processed_at -- Same as created_at for migrated data
        
    FROM inventory_transactions it
    WHERE NOT EXISTS (
        -- Avoid duplicates if migration is run multiple times
        SELECT 1 FROM internal_stock_movements ism 
        WHERE ism.inventory_transaction_id = it.id
    )
    -- Only migrate transactions that represent actual stock movements
    AND it.transaction_type IN (
        'external_invoice', 
        'grn_acceptance', 
        'grn_creation',
        'customer_return', 
        'company_return',
        'invoice_creation',
        'manual_adjustment',
        'bulk_adjustment'
    )
    -- Exclude zero-quantity transactions
    AND it.quantity != 0;
    
    -- Get count of migrated records
    GET DIAGNOSTICS migration_count = ROW_COUNT;
    
    RAISE NOTICE 'Successfully migrated % inventory transactions to internal_stock_movements', migration_count;
    
    -- Update statistics
    IF migration_count > 0 THEN
        -- Analyze the table for better query performance
        ANALYZE internal_stock_movements;
        
        -- Log migration completion
        INSERT INTO sync_logs (
            sync_id,
            status,
            message,
            details,
            processed_count,
            error_count,
            created_at
        ) VALUES (
            'legacy_migration_' || EXTRACT(EPOCH FROM NOW())::BIGINT,
            'completed',
            'Legacy data migration completed successfully',
            jsonb_build_object(
                'migrated_transactions', migration_count,
                'migration_date', NOW(),
                'source_table', 'inventory_transactions',
                'target_table', 'internal_stock_movements'
            ),
            migration_count,
            0,
            NOW()
        );
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log migration error
        error_count := 1;
        RAISE WARNING 'Migration failed with error: %', SQLERRM;
        
        INSERT INTO sync_logs (
            sync_id,
            status,
            message,
            details,
            processed_count,
            error_count,
            created_at
        ) VALUES (
            'legacy_migration_error_' || EXTRACT(EPOCH FROM NOW())::BIGINT,
            'failed',
            'Legacy data migration failed',
            jsonb_build_object(
                'error_message', SQLERRM,
                'migration_date', NOW(),
                'source_table', 'inventory_transactions',
                'target_table', 'internal_stock_movements'
            ),
            0,
            1,
            NOW()
        );
        
        -- Re-raise the error
        RAISE;
END $$;

-- Create summary report of migrated data
DO $$
DECLARE
    summary_report TEXT;
BEGIN
    SELECT INTO summary_report
        FORMAT(
            E'Migration Summary Report:\n' ||
            'Total internal stock movements: %s\n' ||
            'Stock IN movements: %s\n' ||
            'Stock OUT movements: %s\n' ||
            'Unique products: %s\n' ||
            'Unique agencies: %s\n' ||
            'Date range: %s to %s\n' ||
            'External sources: %s',
            COUNT(*),
            COUNT(*) FILTER (WHERE movement_type = 'stock_in'),
            COUNT(*) FILTER (WHERE movement_type = 'stock_out'),
            COUNT(DISTINCT product_id) FILTER (WHERE product_id IS NOT NULL),
            COUNT(DISTINCT agency_id),
            MIN(created_at)::DATE,
            MAX(created_at)::DATE,
            STRING_AGG(DISTINCT external_source, ', ')
        )
    FROM internal_stock_movements
    WHERE sync_id = 'legacy_migration';
    
    RAISE NOTICE '%', summary_report;
END $$;

-- Verify data integrity
DO $$
DECLARE
    integrity_issues INTEGER := 0;
BEGIN
    -- Check for missing product IDs
    SELECT COUNT(*) INTO integrity_issues
    FROM internal_stock_movements 
    WHERE product_id IS NULL AND processed_to_inventory = true;
    
    IF integrity_issues > 0 THEN
        RAISE WARNING 'Found % internal stock movements with missing product_id', integrity_issues;
    END IF;
    
    -- Check for negative quantities
    SELECT COUNT(*) INTO integrity_issues
    FROM internal_stock_movements 
    WHERE quantity < 0;
    
    IF integrity_issues > 0 THEN
        RAISE WARNING 'Found % internal stock movements with negative quantities (should be positive)', integrity_issues;
    END IF;
    
    -- Check for movements without inventory transaction links
    SELECT COUNT(*) INTO integrity_issues
    FROM internal_stock_movements 
    WHERE processed_to_inventory = true AND inventory_transaction_id IS NULL;
    
    IF integrity_issues > 0 THEN
        RAISE WARNING 'Found % processed stock movements without inventory_transaction_id', integrity_issues;
    END IF;
    
    RAISE NOTICE 'Data integrity check completed';
END $$;

-- Comments
COMMENT ON TABLE internal_stock_movements IS 'Contains migrated inventory transactions and new internal stock movements from external sync';

-- Optional: Create indexes if they don't exist (should already be created from the table creation script)
-- This is just a safety check
CREATE INDEX IF NOT EXISTS idx_internal_stock_movements_migrated_data 
    ON internal_stock_movements(sync_id, processed_to_inventory) 
    WHERE sync_id = 'legacy_migration';

-- Final status message
DO $$
BEGIN
    RAISE NOTICE 'Internal stock movements migration completed successfully!';
    RAISE NOTICE 'The inventory module can now read exclusively from the internal_stock_movements table.';
    RAISE NOTICE 'External dependencies have been eliminated for stock movement data.';
END $$;