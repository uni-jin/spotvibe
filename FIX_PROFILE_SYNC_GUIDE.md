# 프로필 동기화 에러 수정 가이드

## 문제
OAuth 로그인 시 "Database error updating user" 에러 발생

## 원인
`sync_profile_from_auth()` 함수가 프로필이 존재하지 않을 때 `UPDATE`를 시도하여 에러 발생

## 해결 방법

### 1. Supabase Dashboard에서 SQL 실행

Supabase Dashboard > SQL Editor로 이동하여 다음 SQL을 실행하세요:

```sql
-- Fix profile sync function to handle missing profiles
DROP FUNCTION IF EXISTS public.sync_profile_from_auth() CASCADE;

CREATE OR REPLACE FUNCTION public.sync_profile_from_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update profile (upsert)
  INSERT INTO public.profiles (id, email, full_name, avatar_url, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER sync_profile_on_auth_update
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_from_auth();
```

### 2. 기존 사용자 프로필 생성 (선택사항)

이미 로그인을 시도한 사용자가 있다면, 프로필을 수동으로 생성할 수 있습니다:

```sql
-- 기존 auth.users에 프로필이 없는 경우 프로필 생성
INSERT INTO public.profiles (id, email, full_name, avatar_url)
SELECT 
  id,
  email,
  raw_user_meta_data->>'full_name' as full_name,
  raw_user_meta_data->>'avatar_url' as avatar_url
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
```

### 3. 테스트

1. 브라우저 캐시 삭제
2. 구글 로그인 시도
3. 에러가 해결되었는지 확인

## 설명

- `INSERT ... ON CONFLICT DO UPDATE` (UPSERT)를 사용하여 프로필이 없으면 생성하고, 있으면 업데이트합니다
- `COALESCE`를 사용하여 NULL 값 처리를 안전하게 합니다
- `SECURITY DEFINER`로 실행하여 권한 문제를 방지합니다
