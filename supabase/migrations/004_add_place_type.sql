-- Add type and is_active fields to places table
-- This migration adds support for categorizing places (popup_store, cafe, restaurant, etc.)
-- and marking them as active/inactive

-- Add type column to places table
ALTER TABLE places 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'popup_store' CHECK (type IN ('popup_store', 'cafe', 'restaurant', 'shop', 'other'));

-- Add is_active column to places table
ALTER TABLE places 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create index for type column for better query performance
CREATE INDEX IF NOT EXISTS idx_places_type ON places(type);

-- Create index for is_active column
CREATE INDEX IF NOT EXISTS idx_places_is_active ON places(is_active);

-- Update existing seed data to have type = 'popup_store' and is_active = true
-- (This will only update rows that don't have these values set)
UPDATE places 
SET type = 'popup_store', is_active = true 
WHERE type IS NULL OR is_active IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN places.type IS 'Type of place: popup_store, cafe, restaurant, shop, other';
COMMENT ON COLUMN places.is_active IS 'Whether this place is currently active and should be displayed';
