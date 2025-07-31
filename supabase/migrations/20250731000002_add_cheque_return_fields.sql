-- Migration to add return fields to collection_cheques table
-- This migration adds fields needed to track returned cheques

-- Add return tracking fields to collection_cheques table
ALTER TABLE public.collection_cheques 
ADD COLUMN IF NOT EXISTS return_reason TEXT,
ADD COLUMN IF NOT EXISTS returned_at TIMESTAMP WITH TIME ZONE;

-- Update the status check constraint to include 'returned' status
ALTER TABLE public.collection_cheques 
DROP CONSTRAINT IF EXISTS collection_cheques_status_check;

ALTER TABLE public.collection_cheques 
ADD CONSTRAINT collection_cheques_status_check 
CHECK (status IN ('pending', 'cleared', 'bounced', 'returned'));

-- Create index for faster queries on returned cheques
CREATE INDEX IF NOT EXISTS idx_collection_cheques_status ON public.collection_cheques(status);
CREATE INDEX IF NOT EXISTS idx_collection_cheques_returned_at ON public.collection_cheques(returned_at);

-- Comment on new columns
COMMENT ON COLUMN public.collection_cheques.return_reason IS 'Reason for cheque return (e.g., insufficient funds, account closed)';
COMMENT ON COLUMN public.collection_cheques.returned_at IS 'Timestamp when the cheque was marked as returned';