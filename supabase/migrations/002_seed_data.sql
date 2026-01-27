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
INSERT INTO places (region_id, name, name_en, status, wait_time, lat, lng) VALUES
  ('Seongsu', '디올 성수', 'Dior Seongsu', '🔥 Very Busy', '40min+', 37.5446, 127.0559),
  ('Seongsu', '아더 성수', 'Ader Error', '✅ No Wait', 'No Wait', 37.5450, 127.0565),
  ('Seongsu', '포인트오브뷰', 'Point of View', '⏱️ Busy', '20min', 37.5440, 127.0550),
  ('Seongsu', '성수동 카페거리', 'Seongsu Cafe Street', '🟢 Quiet', 'Quiet', 37.5445, 127.0560)
ON CONFLICT DO NOTHING;
