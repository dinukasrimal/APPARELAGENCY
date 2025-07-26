# Supabase Storage Setup Guide

## Creating the Product Images Storage Bucket

To enable image uploads for products, you need to create a storage bucket in your Supabase project.

### Step 1: Create Storage Bucket

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**
4. Enter bucket name: `product-images`
5. Make it **Public bucket** (check the box)
6. Click **Create bucket**

### Step 2: Set up Storage Policies

Run these SQL commands in your Supabase SQL Editor:

```sql
-- Enable RLS on the storage.objects table if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to upload product images
CREATE POLICY "Allow authenticated uploads for product images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Policy to allow public read access to product images
CREATE POLICY "Allow public downloads for product images" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'product-images');

-- Policy to allow authenticated users to update their uploaded images
CREATE POLICY "Allow authenticated updates for product images" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'product-images');

-- Policy to allow authenticated users to delete their uploaded images
CREATE POLICY "Allow authenticated deletes for product images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'product-images');
```

### Step 3: Verify Setup

1. Go to **Storage** > **product-images** bucket
2. Try uploading a test image
3. Check that the image URL is publicly accessible

### Troubleshooting

If uploads fail:
1. Check that the bucket exists and is public
2. Verify the storage policies are correctly applied
3. Ensure your Supabase project has storage enabled
4. Check browser console for specific error messages

### File Upload Limitations

- **Supported formats**: JPG, PNG, GIF, WebP
- **Maximum file size**: 5MB (configurable in Supabase settings)
- **File naming**: Automatic timestamp + random string for uniqueness

## Creating the Customer Photos Storage Bucket

To enable storefront photo uploads for customers, you need to create a separate storage bucket.

### Step 1: Create Customer Photos Storage Bucket

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**
4. Enter bucket name: `customer-photos`
5. Make it **Public bucket** (check the box)
6. Click **Create bucket**

### Step 2: Set up Customer Photos Storage Policies

Run these SQL commands in your Supabase SQL Editor:

```sql
-- Policy to allow authenticated users to upload customer photos
CREATE POLICY "Allow authenticated uploads for customer photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'customer-photos');

-- Policy to allow public read access to customer photos
CREATE POLICY "Allow public downloads for customer photos" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'customer-photos');

-- Policy to allow authenticated users to update customer photos
CREATE POLICY "Allow authenticated updates for customer photos" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'customer-photos');

-- Policy to allow authenticated users to delete customer photos
CREATE POLICY "Allow authenticated deletes for customer photos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'customer-photos');
```

### Step 3: Verify Customer Photos Setup

1. Go to **Storage** > **customer-photos** bucket
2. Try uploading a test image
3. Check that the image URL is publicly accessible

## Creating the Non-Productive Visit Photos Storage Bucket

To enable storefront photo uploads for non-productive visits, you need to create another storage bucket.

### Step 1: Create Non-Productive Visit Photos Storage Bucket

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**
4. Enter bucket name: `non-productive-visit-photos`
5. Make it **Public bucket** (check the box)
6. Click **Create bucket**

### Step 2: Set up Non-Productive Visit Photos Storage Policies

Run these SQL commands in your Supabase SQL Editor:

```sql
-- Policy to allow authenticated users to upload non-productive visit photos
CREATE POLICY "Allow authenticated uploads for non-productive visit photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'non-productive-visit-photos');

-- Policy to allow public read access to non-productive visit photos
CREATE POLICY "Allow public downloads for non-productive visit photos" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'non-productive-visit-photos');

-- Policy to allow authenticated users to update non-productive visit photos
CREATE POLICY "Allow authenticated updates for non-productive visit photos" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'non-productive-visit-photos');

-- Policy to allow authenticated users to delete non-productive visit photos
CREATE POLICY "Allow authenticated deletes for non-productive visit photos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'non-productive-visit-photos');
```

### Step 3: Verify Non-Productive Visit Photos Setup

1. Go to **Storage** > **non-productive-visit-photos** bucket
2. Try uploading a test image
3. Check that the image URL is publicly accessible