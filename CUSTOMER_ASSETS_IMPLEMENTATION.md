# Customer Assets Database Implementation

## Overview
This document outlines the implementation of the `customer_assets` table for the apparel agency flow application, which tracks assets given to customers by sales representatives.

## Current Database Structure Summary

### Database Platform: Supabase
- **Primary Keys**: UUID with `gen_random_uuid()` default
- **Security**: Row Level Security (RLS) enabled on all tables
- **Migrations**: Timestamp-based naming convention in `/supabase/migrations/`

### Key Existing Tables:
1. **customers** - Customer information with location support
2. **profiles** - User profiles with roles (agency, superuser, agent)
3. **agencies** - Agency information
4. **products** - Product catalog
5. **inventory_items** - Current stock levels
6. **invoices** - Sales invoices
7. **collections** - Payment collections
8. **sales_orders** - Sales orders

### Foreign Key Relationships:
- **customers.agency_id** → **agencies.id**
- **profiles.agency_id** → **agencies.id**
- Most tables have **created_by** → **profiles.id** relationships

## New Customer Assets Table Implementation

### Table Structure:
```sql
customer_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,                    -- FK to customers.id
    asset_type TEXT NOT NULL,                     -- Type of asset (Rack, Banner, etc.)
    description TEXT NOT NULL,                    -- Asset description
    photo_url TEXT NOT NULL,                      -- URL to asset photo
    latitude DECIMAL(10, 8),                      -- Optional GPS latitude
    longitude DECIMAL(11, 8),                     -- Optional GPS longitude
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    given_by TEXT NOT NULL                        -- Name of person who gave the asset
)
```

### Database Files Created/Modified:

#### 1. Migration File: `/supabase/migrations/20250718000000-create-customer-assets-table.sql`
- Creates the `customer_assets` table with proper structure
- Adds foreign key constraint to `customers` table with CASCADE delete
- Creates performance indexes on `customer_id`, `created_at`, and `asset_type`
- Enables Row Level Security (RLS)
- Creates RLS policies for agency-based access control

#### 2. TypeScript Types: `/src/integrations/supabase/types.ts`
- Added `customer_assets` table definition with Row, Insert, Update, and Relationships types
- Positioned alphabetically between `customers` and `discount_rules` tables
- Includes proper foreign key relationship definition

### Row Level Security (RLS) Policies:
1. **SELECT**: Users can view assets for customers in their agency or superusers can view all
2. **INSERT**: Users can create assets for customers in their agency or superusers can create anywhere
3. **UPDATE**: Users can update assets for customers in their agency or superusers can update anywhere
4. **DELETE**: Users can delete assets for customers in their agency or superusers can delete anywhere

## Existing Asset Component Status

### File: `/src/components/assets/Assets.tsx`
- **Status**: ✅ Already implemented and functional
- **Features**: 
  - Add new assets with photo capture
  - Location tracking (GPS coordinates)
  - Asset type selection (Rack, Banner, Display Stand, etc.)
  - Customer selection
  - Search and filtering capabilities
  - Responsive grid layout
- **Dependencies**: Uses InAppCamera component for photo capture

### Component Integration Points:
- **Dashboard**: Referenced in Sidebar component
- **Camera**: Uses InAppCamera for photo capture
- **Location Services**: Automatic GPS coordinate capture
- **Supabase**: Direct integration with customer_assets table

## Migration Instructions

### To Apply the Database Changes:

1. **Run the Migration**:
   ```bash
   supabase migration up
   ```

2. **Verify TypeScript Types**:
   ```bash
   npm run build
   ```

3. **Test the Assets Component**:
   - Navigate to the Assets section in the application
   - Verify you can add new assets
   - Test search and filtering functionality
   - Ensure RLS policies work correctly for different user roles

### Migration Rollback (if needed):
```sql
-- Drop the table and all related objects
DROP TABLE IF EXISTS public.customer_assets CASCADE;
```

## Security Considerations

1. **Access Control**: RLS policies ensure users can only access assets for customers in their agency
2. **Data Isolation**: Agency-based filtering prevents cross-agency data access
3. **Superuser Override**: Superusers can access all assets across agencies
4. **Audit Trail**: `created_at` and `given_by` fields provide audit information

## Performance Considerations

1. **Indexes**: Created on frequently queried columns:
   - `customer_id` for customer-based filtering
   - `created_at` for chronological sorting
   - `asset_type` for type-based filtering

2. **Foreign Key Constraints**: Ensures data integrity with CASCADE delete

## Usage Examples

### Adding a New Asset:
```typescript
const { data, error } = await supabase
  .from('customer_assets')
  .insert([
    {
      customer_id: 'uuid-here',
      asset_type: 'Rack',
      description: 'Metal display rack for clothing',
      photo_url: 'base64-or-url-here',
      latitude: 6.9271,
      longitude: 79.8612,
      given_by: 'John Doe'
    }
  ]);
```

### Querying Assets:
```typescript
const { data, error } = await supabase
  .from('customer_assets')
  .select(`
    *,
    customer:customers(id, name, storename, address, mobile, email)
  `)
  .order('created_at', { ascending: false });
```

## Future Enhancements

1. **Asset Status Tracking**: Add status field (active, returned, damaged)
2. **Asset Maintenance**: Add maintenance schedules and history
3. **Asset Valuation**: Add cost/value fields for financial tracking
4. **Asset Return Process**: Add return date and condition fields
5. **Asset Photos**: Support multiple photos per asset
6. **Asset QR Codes**: Generate QR codes for easy asset identification

## Conclusion

The customer_assets table implementation is now complete and ready for use. The existing Assets component is already functional and will work immediately after the migration is applied. The implementation follows the application's established patterns for security, performance, and maintainability.