-- Add shop owner fields to customers table
-- Migration: Add shop_owner_name and shop_owner_birthday fields

ALTER TABLE public.customers 
ADD COLUMN shop_owner_name TEXT,
ADD COLUMN shop_owner_birthday DATE;

-- Add comments for documentation
COMMENT ON COLUMN public.customers.shop_owner_name IS 'Name of the shop owner';
COMMENT ON COLUMN public.customers.shop_owner_birthday IS 'Birthday of the shop owner';