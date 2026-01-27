-- Seed Data for SpotVibe
-- 초기 데이터 삽입

-- Insert Regions
INSERT INTO regions (id, name, active) VALUES
  ('Seongsu', 'Seongsu', true),
  ('Hongdae', 'Hongdae', false),
  ('Hannam', 'Hannam', false),
  ('Gangnam', 'Gangnam', false)
ON CONFLICT (id) DO NOTHING;

-- Insert Places (Hot Spots)
-- Note: type and is_active will be set by migration 004_add_place_type.sql
-- For now, we'll insert with default values
INSERT INTO places (region_id, name, name_en, status, wait_time, lat, lng, type, is_active) VALUES
  ('Seongsu', '디올 성수', 'Dior Seongsu', '🔥 Very Busy', '40min+', 37.5446, 127.0559, 'popup_store', true),
  ('Seongsu', '아더 성수', 'Ader Error', '✅ No Wait', 'No Wait', 37.5450, 127.0565, 'popup_store', true),
  ('Seongsu', '포인트오브뷰', 'Point of View', '⏱️ Busy', '20min', 37.5440, 127.0550, 'popup_store', true),
  ('Seongsu', '성수동 카페거리', 'Seongsu Cafe Street', '🟢 Quiet', 'Quiet', 37.5445, 127.0560, 'cafe', false)
ON CONFLICT DO NOTHING;
