# 📋 Supabase 마이그레이션 실행 가이드

## 마이그레이션 파일 목록

다음 순서로 마이그레이션을 실행해야 합니다:

1. `010_add_place_fields_and_admin.sql` - places 테이블 확장 + admin_accounts 테이블 생성
2. `011_create_custom_place_names.sql` - custom_place_names 테이블 생성
3. `012_create_common_codes.sql` - common_codes 테이블 생성 + 초기 데이터

## 실행 방법

### 방법 1: Supabase Dashboard SQL Editor (추천)

1. **Supabase Dashboard 접속**
   - https://supabase.com/dashboard 접속
   - 프로젝트 선택

2. **SQL Editor 열기**
   - 왼쪽 메뉴에서 "SQL Editor" 클릭
   - "New query" 버튼 클릭

3. **마이그레이션 파일 실행 (순서대로)**
   - `010_add_place_fields_and_admin.sql` 파일 내용 전체 복사
   - SQL Editor에 붙여넣기
   - "Run" 버튼 클릭 (또는 Ctrl+Enter)
   - 성공 메시지 확인
   
   - 동일한 방식으로 `011_create_custom_place_names.sql` 실행
   - 동일한 방식으로 `012_create_common_codes.sql` 실행

### 방법 2: Supabase CLI (선택사항)

만약 Supabase CLI가 설치되어 있다면:

```bash
# Supabase 프로젝트 연결 (처음 한 번만)
supabase link --project-ref your-project-ref

# 마이그레이션 실행
supabase db push
```

## 실행 후 확인

### 1. 테이블 생성 확인

SQL Editor에서 다음 쿼리로 테이블이 생성되었는지 확인:

```sql
-- 테이블 목록 확인
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('admin_accounts', 'custom_place_names', 'common_codes')
ORDER BY table_name;
```

### 2. admin_accounts 테이블 확인

```sql
-- 관리자 계정 확인
SELECT id, username, created_at 
FROM admin_accounts;
```

**예상 결과:**
- username: `super`
- password_hash: `$2b$10$ssrv3GYacH1t9keNIaqknel3iSwjAhPlnR/37cYQXCRw1tdweiZdK`

### 3. common_codes 초기 데이터 확인

```sql
-- 공통코드 확인
SELECT code_type, code_value, code_label_ko, display_order 
FROM common_codes 
ORDER BY code_type, display_order;
```

**예상 결과:**
- place_category: 팝업스토어, 식당, 쇼핑, 기타
- vibe_status: Very Busy, Busy, No Wait, Quiet, Sold Out
- wait_time: No Wait, 10분, 20분, 30분, 40분+, Quiet
- region: 성수동, 홍대, 한남, 강남

### 4. places 테이블 확장 확인

```sql
-- places 테이블 컬럼 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'places' 
AND column_name IN ('thumbnail_url', 'description')
ORDER BY column_name;
```

**예상 결과:**
- thumbnail_url (TEXT)
- description (TEXT)

## 주의사항

1. **순서 중요**: 마이그레이션은 반드시 순서대로 실행해야 합니다 (010 → 011 → 012)
2. **중복 실행**: 마이그레이션 파일에 `IF NOT EXISTS`가 포함되어 있어 중복 실행해도 안전합니다
3. **백업**: 중요한 데이터가 있다면 실행 전 백업을 권장합니다
4. **RLS 정책**: RLS가 활성화되어 있으므로 필요시 정책을 확인하세요

## 문제 해결

### 에러: "relation already exists"
- 테이블이 이미 존재하는 경우입니다
- `IF NOT EXISTS`가 있어도 일부 경우 발생할 수 있습니다
- 해당 테이블을 삭제하고 다시 실행하거나, 에러를 무시하고 진행할 수 있습니다

### 에러: "permission denied"
- RLS 정책 문제일 수 있습니다
- Supabase Dashboard에서 RLS 정책을 확인하세요

### 에러: "duplicate key value"
- 초기 데이터가 이미 존재하는 경우입니다
- `ON CONFLICT DO NOTHING`이 있어 안전하게 무시됩니다

## 다음 단계

마이그레이션 실행이 완료되면:
1. 위의 확인 쿼리로 모든 테이블과 데이터가 정상적으로 생성되었는지 확인
2. 관리자 인증 시스템 구현 시작
3. 관리자 사이트 기본 구조 구축
