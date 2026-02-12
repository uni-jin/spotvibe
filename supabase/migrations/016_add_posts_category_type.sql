-- Map/Feed 카테고리 필터용: 포스트 작성 시 선택한 카테고리 저장
-- (예: popup_store, restaurant, other 등 common_codes.code_value와 매칭)
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS category_type TEXT DEFAULT 'other';

CREATE INDEX IF NOT EXISTS idx_posts_category_type ON posts(category_type);

COMMENT ON COLUMN posts.category_type IS '포스트 작성 시 선택한 장소 카테고리 (common_codes.code_value). 미설정/기타는 other.';
