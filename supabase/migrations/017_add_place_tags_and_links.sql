-- Add extra fields to places for Discover/Detail view
ALTER TABLE places
ADD COLUMN IF NOT EXISTS info_url TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS hashtags TEXT[];

COMMENT ON COLUMN places.info_url IS 'External info URL for the pop-up (opens in new tab only).';
COMMENT ON COLUMN places.phone IS 'Contact phone number for the place.';
COMMENT ON COLUMN places.hashtags IS 'Array of free-form hashtags for Discover cards.';

-- Tag master table: normalized tags with categories
CREATE TABLE IF NOT EXISTS place_tags (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,        -- admission, benefit, amenity, content, etc.
  code TEXT NOT NULL,            -- e.g. reservation_required, goods, pet_friendly
  label_en TEXT NOT NULL,        -- English label to show in UI
  label_ko TEXT,                 -- Optional Korean label
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_place_tags_category_code
  ON place_tags(category, code);

COMMENT ON TABLE place_tags IS 'Master tags for places, grouped by category.';

-- Mapping table: many-to-many between places and tags
CREATE TABLE IF NOT EXISTS place_tag_mappings (
  id SERIAL PRIMARY KEY,
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES place_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_place_tag_mappings_place_id
  ON place_tag_mappings(place_id);

CREATE INDEX IF NOT EXISTS idx_place_tag_mappings_tag_id
  ON place_tag_mappings(tag_id);

COMMENT ON TABLE place_tag_mappings IS 'Mapping between places and place_tags.';

