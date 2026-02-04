# UUID 타입 불일치 오류 수정 가이드

## 문제
Post Vibe 포스팅 시 `operator does not exist: uuid = text` 오류 발생

## 원인
- `profiles.id`는 `UUID` 타입
- `posts.user_id`는 `TEXT` 타입
- 통계 업데이트 함수에서 `WHERE id = NEW.user_id` 비교 시 타입 불일치 발생

## 해결 방법

### Supabase Dashboard에서 SQL 실행

Supabase Dashboard > SQL Editor로 이동하여 다음 SQL을 실행하세요:

```sql
-- Fix UUID and TEXT type mismatch in profile stats update functions
-- Fix update_user_stats_on_insert function
CREATE OR REPLACE FUNCTION public.update_user_stats_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if user_id is not null
  IF NEW.user_id IS NOT NULL THEN
    UPDATE profiles
    SET posts_count = (
      SELECT COUNT(*) FROM posts WHERE user_id = NEW.user_id
    ),
    places_visited_count = (
      SELECT COUNT(DISTINCT place_id) FROM posts WHERE user_id = NEW.user_id AND place_id IS NOT NULL
    ),
    updated_at = NOW()
    WHERE id::text = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix update_user_stats_on_delete function
CREATE OR REPLACE FUNCTION public.update_user_stats_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if user_id is not null
  IF OLD.user_id IS NOT NULL THEN
    UPDATE profiles
    SET posts_count = (
      SELECT COUNT(*) FROM posts WHERE user_id = OLD.user_id
    ),
    places_visited_count = (
      SELECT COUNT(DISTINCT place_id) FROM posts WHERE user_id = OLD.user_id AND place_id IS NOT NULL
    ),
    updated_at = NOW()
    WHERE id::text = OLD.user_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
```

## 설명

- `WHERE id::text = NEW.user_id`: `profiles.id` (UUID)를 TEXT로 캐스팅하여 `posts.user_id` (TEXT)와 비교
- `IF NEW.user_id IS NOT NULL`: user_id가 null인 경우 업데이트를 건너뜀
- 이렇게 하면 타입 불일치 오류가 해결됩니다

## 테스트

1. SQL 실행 후
2. Post Vibe로 새 포스트 작성
3. 오류 없이 저장되는지 확인
