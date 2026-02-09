-- Add display period fields to places table
-- These fields control when a place should be visible to users
-- Used for popup store contracts with specific display periods

-- Add display period columns
ALTER TABLE places 
ADD COLUMN IF NOT EXISTS display_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS display_end_date TIMESTAMP WITH TIME ZONE;

-- Create index for efficient date range queries
CREATE INDEX IF NOT EXISTS idx_places_display_dates 
ON places(display_start_date, display_end_date);

-- Create index for filtering active displays
CREATE INDEX IF NOT EXISTS idx_places_display_active 
ON places(is_active, display_start_date, display_end_date);

-- Add comments for documentation
COMMENT ON COLUMN places.display_start_date IS 'Start date/time when the place should be displayed to users (KST). NULL means no start limit.';
COMMENT ON COLUMN places.display_end_date IS 'End date/time when the place should be displayed to users (KST). NULL means no end limit.';
