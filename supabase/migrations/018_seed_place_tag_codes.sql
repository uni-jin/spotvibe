-- Seed common_codes for place tag categories (admission, benefit, amenity, content)
-- common_codes uses single code_label (015_unify_common_code_label.sql)

INSERT INTO common_codes (code_type, code_value, code_label, display_order) VALUES
  -- Admission
  ('place_tag_admission', 'reservation_required', '예약 필수', 1),
  ('place_tag_admission', 'walkin_wait', '현장 대기', 2),
  ('place_tag_admission', 'free_entry', '자유 입장', 3),

  -- Benefits
  ('place_tag_benefit', 'goods', '굿즈 증정', 1),
  ('place_tag_benefit', 'samples', '샘플 제공', 2),
  ('place_tag_benefit', 'lucky_draw', '럭키드로우', 3),

  -- Amenities
  ('place_tag_amenity', 'english_ok', '영어 가능', 1),
  ('place_tag_amenity', 'pet_friendly', '반려동물 동반', 2),
  ('place_tag_amenity', 'parking', '주차 가능', 3),

  -- Content
  ('place_tag_content', 'photo_zone', '포토존', 1),
  ('place_tag_content', 'experience', '체험', 2),
  ('place_tag_content', 'fnb', 'F&B 판매', 3)
ON CONFLICT (code_type, code_value) DO NOTHING;

