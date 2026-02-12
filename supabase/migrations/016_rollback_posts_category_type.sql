-- 016_add_posts_category_type.sql 롤백: category_type 컬럼 제거
-- 적용 전 상태로 되돌리고 싶을 때 Supabase SQL Editor에서 이 파일 내용 실행

DROP INDEX IF EXISTS idx_posts_category_type;

ALTER TABLE posts
DROP COLUMN IF EXISTS category_type;
