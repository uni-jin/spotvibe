-- Create custom_place_names table for tracking user-entered place names
-- This table tracks places that users enter as "기타" (other) option

CREATE TABLE IF NOT EXISTS custom_place_names (
  id SERIAL PRIMARY KEY,
  place_name TEXT NOT NULL,
  category_type TEXT, -- 'popup_store', 'restaurant', 'shop', 'other'
  usage_count INTEGER DEFAULT 1,
  first_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(place_name, category_type)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_custom_place_names_category ON custom_place_names(category_type);
CREATE INDEX IF NOT EXISTS idx_custom_place_names_usage ON custom_place_names(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_custom_place_names_name ON custom_place_names(place_name);

-- Enable RLS
ALTER TABLE custom_place_names ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Everyone can read, authenticated users can insert/update
CREATE POLICY "Everyone can read custom place names" ON custom_place_names
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert custom place names" ON custom_place_names
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update custom place names" ON custom_place_names
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Add comment for documentation
COMMENT ON TABLE custom_place_names IS 'Tracks place names entered by users as "기타" option, with usage statistics';
