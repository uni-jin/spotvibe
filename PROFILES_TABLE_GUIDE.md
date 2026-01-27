# Profiles 테이블 가이드

## 왜 별도의 Profiles 테이블이 필요한가?

### 1. **확장성 (Scalability)**
- 나중에 추가할 수 있는 정보들:
  - 사용자 소개 (bio)
  - 알림 설정 (notification preferences)
  - 테마 설정 (dark/light mode)
  - 언어 설정
  - 즐겨찾는 장소
  - 팔로워/팔로잉 기능
  - 사용자 레벨/뱃지 시스템

### 2. **성능 최적화 (Performance)**
- 현재: 매번 `posts` 테이블을 전체 스캔하여 통계 계산
- 개선: `profiles` 테이블에 통계를 캐싱하여 즉시 조회 가능
- 예: `posts_count`, `places_visited_count` 필드로 빠른 조회

### 3. **데이터 정규화 (Data Normalization)**
- `auth.users`: Supabase가 관리하는 인증 전용 테이블 (수정 제한)
- `profiles`: 애플리케이션 레벨에서 관리하는 사용자 정보
- 분리함으로써 각각의 목적에 맞게 관리 가능

### 4. **RLS (Row Level Security) 정책 적용 용이**
- 프로필 공개/비공개 설정
- 사용자별 권한 관리
- 데이터 접근 제어

## 마이그레이션 실행 방법

### 1. Supabase Dashboard에서 실행

1. Supabase Dashboard 접속
2. **SQL Editor** 메뉴로 이동
3. `003_create_profiles_table.sql` 파일 내용을 복사하여 실행
4. 성공 메시지 확인

### 2. 기존 사용자 프로필 생성 (선택사항)

기존에 가입한 사용자들의 프로필을 생성하려면:

```sql
-- 기존 auth.users에 대한 프로필 생성
INSERT INTO profiles (id, email, full_name, avatar_url)
SELECT 
  id,
  email,
  raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'avatar_url'
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles);
```

## 자동화 기능

### 1. 자동 프로필 생성
- 사용자가 회원가입하면 `handle_new_user()` 함수가 자동으로 프로필 생성
- Google OAuth 로그인 시에도 자동 생성

### 2. 통계 자동 업데이트
- 포스트 생성/삭제 시 `posts_count`, `places_visited_count` 자동 업데이트
- 실시간으로 통계 반영

### 3. Auth 동기화
- `auth.users`의 메타데이터 변경 시 `profiles` 테이블 자동 동기화
- Google 프로필 사진/이름 변경 시 자동 반영

## 사용 예시

### 프로필 조회
```javascript
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single()
```

### 통계 업데이트 (수동)
```javascript
// 필요시 수동으로 통계 재계산
const { data } = await supabase.rpc('recalculate_user_stats', {
  user_id: userId
})
```

### 프로필 업데이트
```javascript
const { error } = await supabase
  .from('profiles')
  .update({ 
    bio: 'New bio text',
    notification_enabled: false 
  })
  .eq('id', userId)
```

## 현재 vs 개선 후

### 현재 (Profiles 테이블 없음)
```javascript
// 매번 전체 posts 스캔
const postsCount = vibePosts.filter(p => p.userId === user.id).length
const placesCount = new Set(vibePosts.filter(p => p.userId === user.id).map(p => p.placeId)).size
```
- **문제**: 데이터가 많아질수록 느려짐
- **문제**: 매번 계산해야 함

### 개선 후 (Profiles 테이블 사용)
```javascript
// 즉시 조회
const { data: profile } = await supabase
  .from('profiles')
  .select('posts_count, places_visited_count')
  .eq('id', user.id)
  .single()
```
- **장점**: 빠른 조회 (O(1))
- **장점**: 자동 업데이트
- **장점**: 확장 가능

## 다음 단계

1. ✅ 마이그레이션 실행
2. App.jsx에서 `profiles` 테이블 사용하도록 코드 수정
3. (선택) 기존 사용자 프로필 생성
4. (선택) 추가 필드 필요 시 마이그레이션 추가
