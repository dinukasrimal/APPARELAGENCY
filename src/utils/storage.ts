import { supabase } from '@/integrations/supabase/client';

export interface UploadOptions {
  bucket: string;
  path?: string;
  file: File | Blob;
  fileName?: string;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Uploads a file to Supabase Storage
 */
export async function uploadFile(options: UploadOptions): Promise<UploadResult> {
  try {
    const { bucket, path = '', file, fileName } = options;
    console.log('uploadFile called with:', { bucket, path, fileName, fileSize: file.size, fileType: file.type });
    
    // Generate unique filename if not provided
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const defaultFileName = `${timestamp}-${randomString}`;
    
    // Determine file extension
    let fileExtension = '';
    if (file instanceof File) {
      fileExtension = file.name.split('.').pop() || '';
    } else if (file.type) {
      // For Blob, extract extension from MIME type
      const mimeMap: { [key: string]: string } = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp'
      };
      fileExtension = mimeMap[file.type] || 'jpg';
    }
    
    const finalFileName = fileName || `${defaultFileName}.${fileExtension}`;
    const fullPath = path ? `${path}/${finalFileName}` : finalFileName;
    console.log('Final upload path:', fullPath);
    
    // Upload file to Supabase Storage
    console.log('Attempting upload to bucket:', bucket);
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fullPath, file);
    
    console.log('Upload response:', { data, error });
    
    if (error) {
      console.error('Storage upload error:', error);
      return {
        success: false,
        error: error.message
      };
    }
    
    // Get public URL
    console.log('Getting public URL for:', fullPath);
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fullPath);
    
    console.log('Public URL data:', urlData);
    
    return {
      success: true,
      url: urlData.publicUrl
    };
    
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Uploads a customer storefront photo
 */
export async function uploadCustomerPhoto(file: File | Blob, customerId?: string): Promise<UploadResult> {
  const path = customerId ? `customer-${customerId}` : 'general';
  
  return uploadFile({
    bucket: 'customer-photos',
    path,
    file
  });
}

/**
 * Uploads a non-productive visit storefront photo
 */
export async function uploadNonProductiveVisitPhoto(file: File | Blob, visitId?: string, userId?: string): Promise<UploadResult> {
  // Create organized folder structure: user-{userId}/visit-{visitId} or user-{userId}/general
  const userFolder = userId ? `user-${userId}` : 'general';
  const path = visitId ? `${userFolder}/visit-${visitId}` : `${userFolder}/general`;
  
  return uploadFile({
    bucket: 'non-productive-visit-photos',
    path,
    file
  });
}

/**
 * Converts base64 data URL to Blob
 */
export function base64ToBlob(base64: string, mimeType: string = 'image/jpeg'): Blob {
  const byteCharacters = atob(base64.split(',')[1]);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Uploads a base64 image to storage
 */
export async function uploadBase64Image(
  base64: string, 
  bucket: string, 
  path?: string, 
  fileName?: string
): Promise<UploadResult> {
  // Extract MIME type from base64 string
  const mimeMatch = base64.match(/data:([^;]+);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  
  // Convert base64 to blob
  const blob = base64ToBlob(base64, mimeType);
  
  return uploadFile({
    bucket,
    path,
    file: blob,
    fileName
  });
}

/**
 * Deletes a file from Supabase Storage
 */
export async function deleteFile(bucket: string, path: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);
    
    if (error) {
      console.error('Storage delete error:', error);
      return {
        success: false,
        error: error.message
      };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Delete error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}