import { supabase } from '@/integrations/supabase/client';
import { uploadCustomerPhoto, uploadNonProductiveVisitPhoto, base64ToBlob } from './storage';

export interface MigrationResult {
  success: boolean;
  processed: number;
  errors: string[];
}

/**
 * Migrates base64 photos stored in the database to Supabase storage
 */
export async function migrateCustomerPhotos(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    processed: 0,
    errors: []
  };

  try {
    // Fetch all customers with base64 photos
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, storefront_photo')
      .like('storefront_photo', 'data:image/%');

    if (error) {
      result.errors.push(`Failed to fetch customers: ${error.message}`);
      return result;
    }

    if (!customers || customers.length === 0) {
      result.success = true;
      return result;
    }

    console.log(`Found ${customers.length} customers with base64 photos to migrate`);

    // Process each customer
    for (const customer of customers) {
      try {
        // Convert base64 to blob
        const photoBlob = base64ToBlob(customer.storefront_photo, 'image/jpeg');
        
        // Upload to storage
        const uploadResult = await uploadCustomerPhoto(photoBlob, customer.id);
        
        if (uploadResult.success && uploadResult.url) {
          // Update the database with the new URL
          const { error: updateError } = await supabase
            .from('customers')
            .update({ storefront_photo: uploadResult.url })
            .eq('id', customer.id);

          if (updateError) {
            result.errors.push(`Failed to update customer ${customer.id}: ${updateError.message}`);
          } else {
            result.processed++;
            console.log(`Migrated photo for customer ${customer.id}`);
          }
        } else {
          result.errors.push(`Failed to upload photo for customer ${customer.id}: ${uploadResult.error}`);
        }
      } catch (error) {
        result.errors.push(`Error processing customer ${customer.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    result.success = result.errors.length === 0;
    return result;

  } catch (error) {
    result.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Checks if a customer has a base64 photo that needs migration
 */
export function needsPhotoMigration(storefrontPhoto: string): boolean {
  return storefrontPhoto && storefrontPhoto.startsWith('data:image/');
}

/**
 * Migrates a single customer's photo
 */
export async function migrateSingleCustomerPhoto(customerId: string, base64Photo: string): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Convert base64 to blob
    const photoBlob = base64ToBlob(base64Photo, 'image/jpeg');
    
    // Upload to storage
    const uploadResult = await uploadCustomerPhoto(photoBlob, customerId);
    
    if (uploadResult.success && uploadResult.url) {
      // Update the database with the new URL
      const { error: updateError } = await supabase
        .from('customers')
        .update({ storefront_photo: uploadResult.url })
        .eq('id', customerId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      return { success: true, url: uploadResult.url };
    } else {
      return { success: false, error: uploadResult.error };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Migrates base64 photos stored in non_productive_visits table to Supabase storage
 */
export async function migrateNonProductiveVisitPhotos(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    processed: 0,
    errors: []
  };

  try {
    // Fetch all non-productive visits with base64 photos
    const { data: visits, error } = await supabase
      .from('non_productive_visits')
      .select('id, store_front_photo, user_id')
      .like('store_front_photo', 'data:image/%');

    if (error) {
      result.errors.push(`Failed to fetch non-productive visits: ${error.message}`);
      return result;
    }

    if (!visits || visits.length === 0) {
      result.success = true;
      return result;
    }

    console.log(`Found ${visits.length} non-productive visits with base64 photos to migrate`);

    // Process each visit
    for (const visit of visits) {
      try {
        // Convert base64 to blob
        const photoBlob = base64ToBlob(visit.store_front_photo, 'image/jpeg');
        
        // Upload to storage
        const uploadResult = await uploadNonProductiveVisitPhoto(photoBlob, visit.id, visit.user_id);
        
        if (uploadResult.success && uploadResult.url) {
          // Update the database with the new URL
          const { error: updateError } = await supabase
            .from('non_productive_visits')
            .update({ store_front_photo: uploadResult.url })
            .eq('id', visit.id);

          if (updateError) {
            result.errors.push(`Failed to update visit ${visit.id}: ${updateError.message}`);
          } else {
            result.processed++;
            console.log(`Migrated photo for non-productive visit ${visit.id}`);
          }
        } else {
          result.errors.push(`Failed to upload photo for visit ${visit.id}: ${uploadResult.error}`);
        }
      } catch (error) {
        result.errors.push(`Error processing visit ${visit.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    result.success = result.errors.length === 0;
    return result;

  } catch (error) {
    result.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Migrates a single non-productive visit's photo
 */
export async function migrateSingleNonProductiveVisitPhoto(visitId: string, base64Photo: string, userId: string): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Convert base64 to blob
    const photoBlob = base64ToBlob(base64Photo, 'image/jpeg');
    
    // Upload to storage
    const uploadResult = await uploadNonProductiveVisitPhoto(photoBlob, visitId, userId);
    
    if (uploadResult.success && uploadResult.url) {
      // Update the database with the new URL
      const { error: updateError } = await supabase
        .from('non_productive_visits')
        .update({ store_front_photo: uploadResult.url })
        .eq('id', visitId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      return { success: true, url: uploadResult.url };
    } else {
      return { success: false, error: uploadResult.error };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}