-- Add icon column to channels table
ALTER TABLE public.channels 
ADD COLUMN icon text DEFAULT 'hash';