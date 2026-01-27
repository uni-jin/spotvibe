# Supabase 데이터베이스 설정 가이드

## 1. Supabase 프로젝트 생성

1. [Supabase](https://supabase.com)에 가입 및 로그인
2. 새 프로젝트 생성
3. 프로젝트 설정에서 다음 정보 확인:
   - Project URL (예: `https://xxxxx.supabase.co`)
   - API Key (Settings > API > `anon` `public` key)

## 2. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**주의**: `.env` 파일은 `.gitignore`에 포함되어 있어야 합니다.

## 3. 데이터베이스 마이그레이션 실행

### 방법 1: Supabase Dashboard 사용 (권장)

1. Supabase Dashboard 접속
2. 좌측 메뉴에서 **SQL Editor** 클릭
3. **New Query** 클릭
4. `supabase/migrations/001_initial_schema.sql` 파일 내용을 복사하여 붙여넣기
5. **Run** 버튼 클릭
6. 성공 메시지 확인
7. `supabase/migrations/002_seed_data.sql` 파일도 동일하게 실행

### 방법 2: Supabase CLI 사용

```bash
# Supabase CLI 설치
npm install -g supabase

# Supabase 로그인
supabase login

# 프로젝트 연결
supabase link --project-ref your-project-ref

# 마이그레이션 실행
supabase db push
```

## 4. 데이터베이스 구조 확인

마이그레이션 실행 후, **Table Editor**에서 다음 테이블들이 생성되었는지 확인:

- ✅ `regions` - 지역 정보
- ✅ `places` - Hot Spots (관리자 등록 장소)
- ✅ `posts` - 제보 데이터
- ✅ `post_images` - 포스트 이미지들

## 5. Row Level Security (RLS) 확인

**Authentication > Policies**에서 다음 정책이 설정되어 있는지 확인:

- `Allow public read access on regions` (SELECT)
- `Allow public read access on places` (SELECT)
- `Allow public read access on posts` (SELECT)
- `Allow public read access on post_images` (SELECT)
- `Allow public insert on posts` (INSERT)
- `Allow public insert on post_images` (INSERT)

## 6. 초기 데이터 확인

`002_seed_data.sql` 실행 후:

- **regions** 테이블에 4개 지역 (Seongsu, Hongdae, Hannam, Gangnam)
- **places** 테이블에 4개 장소 (디올 성수, 아더 성수, 포인트오브뷰, 성수동 카페거리)

## 7. 테스트

개발 서버 실행:

```bash
npm run dev
```

앱이 정상적으로 실행되고, Supabase 연결이 성공하면 콘솔에 에러가 없어야 합니다.

## 8. 다음 단계 (선택사항)

### 이미지 업로드를 위한 Storage 설정

1. Supabase Dashboard > **Storage** 메뉴
2. 새 버킷 생성: `post-images`
3. Public access 설정
4. `src/lib/supabase.js`의 `uploadImage` 함수 구현

### 인증 시스템 추가

1. Supabase Auth 설정
2. `posts` 테이블의 `user_id`를 `auth.users`와 연결
3. RLS 정책 업데이트

## 문제 해결

### 환경 변수를 찾을 수 없다는 오류

- `.env` 파일이 프로젝트 루트에 있는지 확인
- 환경 변수 이름이 정확한지 확인 (`VITE_` 접두사 필수)
- 개발 서버를 재시작

### RLS 정책 오류

- Supabase Dashboard에서 Policies 확인
- 필요시 수동으로 정책 추가

### 마이그레이션 오류

- SQL Editor에서 오류 메시지 확인
- 테이블이 이미 존재하는 경우 `CREATE TABLE IF NOT EXISTS` 사용
