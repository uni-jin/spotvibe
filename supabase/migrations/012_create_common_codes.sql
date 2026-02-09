-- Create common_codes table for managing system-wide configuration codes
-- This allows admins to manage categories, statuses, and other codes without code changes

CREATE TABLE IF NOT EXISTS common_codes (
  id SERIAL PRIMARY KEY,
  code_type TEXT NOT NULL, -- 'place_category', 'vibe_status', 'wait_time', 'region', etc.
  code_value TEXT NOT NULL, -- 'popup_store', 'verybusy', '10min', 'Seongsu', etc.
  code_label_ko TEXT NOT NULL, -- Korean label
  code_label_en TEXT, -- English label (optional)
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(code_type, code_value)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_common_codes_type ON common_codes(code_type);
CREATE INDEX IF NOT EXISTS idx_common_codes_active ON common_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_common_codes_order ON common_codes(code_type, display_order);

-- Enable RLS
ALTER TABLE common_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Everyone can read, only admins can modify
CREATE POLICY "Everyone can read common codes" ON common_codes
  FOR SELECT USING (true);

-- Admin modification will be checked in application layer
-- For now, allow authenticated users (admin check in app)
CREATE POLICY "Authenticated users can modify common codes" ON common_codes
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Insert initial place category codes
INSERT INTO common_codes (code_type, code_value, code_label_ko, code_label_en, display_order) VALUES
  ('place_category', 'popup_store', '팝업스토어', 'Pop-up Store', 1),
  ('place_category', 'restaurant', '식당', 'Restaurant', 2),
  ('place_category', 'shop', '쇼핑', 'Shopping', 3),
  ('place_category', 'other', '기타', 'Other', 4)
ON CONFLICT (code_type, code_value) DO NOTHING;

-- Insert initial vibe status codes
INSERT INTO common_codes (code_type, code_value, code_label_ko, code_label_en, display_order) VALUES
  ('vibe_status', 'verybusy', '🔥 Very Busy', 'Very Busy', 1),
  ('vibe_status', 'busy', '⏱️ Busy', 'Busy', 2),
  ('vibe_status', 'nowait', '✅ No Wait', 'No Wait', 3),
  ('vibe_status', 'quiet', '🟢 Quiet', 'Quiet', 4),
  ('vibe_status', 'soldout', '❌ Sold Out', 'Sold Out', 5)
ON CONFLICT (code_type, code_value) DO NOTHING;

-- Insert initial wait time codes
INSERT INTO common_codes (code_type, code_value, code_label_ko, code_label_en, display_order) VALUES
  ('wait_time', 'nowait', 'No Wait', 'No Wait', 1),
  ('wait_time', '10min', '10분', '10min', 2),
  ('wait_time', '20min', '20분', '20min', 3),
  ('wait_time', '30min', '30분', '30min', 4),
  ('wait_time', '40min+', '40분+', '40min+', 5),
  ('wait_time', 'quiet', 'Quiet', 'Quiet', 6)
ON CONFLICT (code_type, code_value) DO NOTHING;

-- Insert initial region codes
INSERT INTO common_codes (code_type, code_value, code_label_ko, code_label_en, display_order) VALUES
  ('region', 'Seongsu', '성수동', 'Seongsu', 1),
  ('region', 'Hongdae', '홍대', 'Hongdae', 2),
  ('region', 'Hannam', '한남', 'Hannam', 3),
  ('region', 'Gangnam', '강남', 'Gangnam', 4)
ON CONFLICT (code_type, code_value) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE common_codes IS 'System-wide configuration codes managed by admins (categories, statuses, regions, etc.)';
