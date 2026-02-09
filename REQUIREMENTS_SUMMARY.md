# 📋 SpotVibe 요구사항 정리

## 🎯 포스팅 시 장소 선택 UX

### 선택 흐름
1. **카테고리 선택** (탭 또는 버튼)
   - 팝업스토어 / 식당 / 쇼핑 / 기타

2. **드롭다운에서 관리자 등록 장소 선택**
   - 선택한 카테고리에 해당하는 관리자 등록 장소만 표시
   - 거리 정보 표시 (GPS 위치가 있을 때)
   - 드롭다운 마지막에 "기타" 옵션 포함

3. **"기타" 선택 시**
   - 텍스트 입력 필드 표시
   - 자동완성 기능:
     - 다른 사용자들이 "기타"로 입력한 장소명 표시
     - 사용 횟수 표시 (예: "성수동 카페거리 (15)")
     - 인스타그램/쓰레드 해시태그 자동완성과 유사한 UX
   - 직접 입력도 가능

### 데이터 구조
- `posts.place_name`: 장소명 (관리자 등록 장소 ID 또는 직접 입력한 이름)
- `posts.place_id`: 관리자 등록 장소 ID (nullable, "기타" 선택 시 null)
- 기타 장소명 통계를 위한 별도 테이블 또는 쿼리 필요

---

## 🏢 관리자 사이트 상세 요구사항

### 인증 시스템
- **로그인 방식**: 별도 ID/PW (Google OAuth 아님)
- **URL**: `https://spotvibe-k.vercel.app/admin` (경로 기반)
- **초기 계정**:
  - ID: `super`
  - PW: `wlsdn123`
- **비밀번호 변경**: 로그인 후 설정 메뉴에서 변경 가능

### 메뉴 구조 (Depth 1)

#### 1. 회원관리
- **회원 목록**
  - 계정 정보 표시 (이름, 이메일, 가입일 등)
  - 검색/필터링 기능
- **회원 상세**
  - 기본 정보
  - 포스팅 수 통계
  - 포스팅 목록 (선택사항)
  - 좋아요 수 등 활동 통계

#### 2. 장소관리
- **장소 목록**
  - 관리자가 등록한 장소 목록
  - 카테고리별 필터링
  - 검색 기능
  - 등록 버튼
- **장소 등록/수정**
  - 카테고리 선택 (공통코드에서 가져옴)
  - 장소명 (한글/영문)
  - 대표사진
  - 위치 (GPS 좌표, 지도에서 선택)
  - 설명
  - 상태, 대기 시간
  - 활성화 여부
- **장소 상세**
  - 등록된 장소의 모든 정보 표시
  - 해당 장소의 포스팅 목록 (선택사항)

#### 3. 설정
- **비밀번호 변경**
  - 현재 비밀번호 확인
  - 새 비밀번호 입력
  - 비밀번호 변경
- **공통코드 관리**
  - 장소 카테고리 관리
    - 추가/수정/삭제
    - 카테고리명 (한글/영문)
    - 표시 순서
  - 기타 공통코드 (추천 항목 아래 참고)

#### 4. 기타 장소 관리 (추가 제안)
- **기타 장소 목록**
  - 사용자들이 "기타"로 입력한 장소명 목록
  - 사용 횟수 정렬
  - 많이 사용된 장소를 공식 장소로 승격 기능
  - 공식 장소로 승격 시 장소관리로 이동

---

## 📊 데이터베이스 스키마 변경 필요사항

### 1. 관리자 계정 테이블
```sql
-- 관리자 계정 테이블 (별도 테이블 또는 profiles 확장)
CREATE TABLE IF NOT EXISTS admin_accounts (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL, -- 'super'
  password_hash TEXT NOT NULL, -- bcrypt 해시
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- 초기 관리자 계정 생성
-- password: wlsdn123 (bcrypt 해시 필요)
```

### 2. places 테이블 확장
```sql
ALTER TABLE places ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS description TEXT;
```

### 3. 기타 장소명 통계를 위한 테이블
```sql
-- 사용자들이 "기타"로 입력한 장소명 통계
CREATE TABLE IF NOT EXISTS custom_place_names (
  id SERIAL PRIMARY KEY,
  place_name TEXT NOT NULL,
  category_type TEXT, -- 'popup_store', 'restaurant', 'shop', 'other'
  usage_count INTEGER DEFAULT 1,
  first_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(place_name, category_type)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_custom_place_names_category ON custom_place_names(category_type);
CREATE INDEX IF NOT EXISTS idx_custom_place_names_usage ON custom_place_names(usage_count DESC);
```

### 4. 공통코드 테이블
```sql
-- 공통코드 관리 테이블
CREATE TABLE IF NOT EXISTS common_codes (
  id SERIAL PRIMARY KEY,
  code_type TEXT NOT NULL, -- 'place_category', 'vibe_status', etc.
  code_value TEXT NOT NULL, -- 'popup_store', 'verybusy', etc.
  code_label_ko TEXT NOT NULL, -- 한글명
  code_label_en TEXT, -- 영문명
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(code_type, code_value)
);

-- 초기 데이터: 장소 카테고리
INSERT INTO common_codes (code_type, code_value, code_label_ko, code_label_en, display_order) VALUES
  ('place_category', 'popup_store', '팝업스토어', 'Pop-up Store', 1),
  ('place_category', 'restaurant', '식당', 'Restaurant', 2),
  ('place_category', 'shop', '쇼핑', 'Shopping', 3),
  ('place_category', 'other', '기타', 'Other', 4)
ON CONFLICT (code_type, code_value) DO NOTHING;
```

### 5. posts 테이블 확인
- `place_id`: 관리자 등록 장소 ID (nullable)
- `place_name`: 장소명 (관리자 등록 장소명 또는 사용자 직접 입력)
- `category_type`: 카테고리 타입 (추가 필요할 수 있음)

---

## 🎨 UI/UX 상세

### 포스팅 모달 - 장소 선택
```
[카테고리 탭]
[팝업스토어] [식당] [쇼핑] [기타]

[드롭다운]
▼ 장소 선택
  - 디올 성수 (1.2km away)
  - 아더 성수 (0.8km away)
  - 포인트오브뷰 (2.1km away)
  ─────────────
  - 기타

[기타 선택 시]
[텍스트 입력 필드]
성수동 카페거리
  ↓ (자동완성 드롭다운)
  - 성수동 카페거리 (15) ← 사용 횟수
  - 성수동 맛집거리 (8)
  - 성수동 쇼핑거리 (3)
```

### 관리자 사이트 - 로그인
```
[로그인 화면]
ID: [super        ]
PW: [************  ]
    [로그인]
```

### 관리자 사이트 - 메인 레이아웃
```
[사이드바]
📊 회원관리
📍 장소관리
⚙️ 설정
  - 비밀번호 변경
  - 공통코드 관리
📝 기타 장소 관리 (추가 제안)

[메인 콘텐츠 영역]
```

---

## 🔧 공통코드 관리 - 추천 항목

### 1. 장소 카테고리 (필수)
- 팝업스토어, 식당, 쇼핑, 기타

### 2. Vibe 상태 (추천)
- Very Busy, Busy, No Wait, Quiet, Sold Out
- 현재는 하드코딩되어 있지만 공통코드로 관리하면 유연함

### 3. 대기 시간 옵션 (추천)
- No Wait, 10min, 20min, 30min, 40min+, Quiet
- 드롭다운 선택지로 제공

### 4. 지역 (추천)
- Seongsu, Hongdae, Hannam, Gangnam 등
- 현재는 하드코딩되어 있음

### 5. 포스팅 상태 (추천, 나중에)
- Active, Deleted, Reported 등

---

## 🔒 보안 고려사항

### 관리자 인증
- **비밀번호 해싱**: bcrypt 사용
- **세션 관리**: JWT 또는 Supabase Session
- **CSRF 보호**: 토큰 기반
- **Rate Limiting**: 로그인 시도 제한

### 데이터 접근
- **RLS 정책**: 관리자만 places, common_codes 수정 가능
- **API 검증**: 서버 사이드에서도 관리자 권한 체크

---

## 📝 작업 순서 제안

### Phase 1: 데이터베이스 스키마
1. 관리자 계정 테이블 생성
2. places 테이블 확장 (thumbnail_url, description)
3. custom_place_names 테이블 생성
4. common_codes 테이블 생성
5. 초기 데이터 삽입

### Phase 2: 관리자 인증 시스템
1. 관리자 로그인 페이지
2. ID/PW 인증 로직
3. 세션 관리
4. 비밀번호 변경 기능

### Phase 3: 관리자 사이트 기본 구조
1. 레이아웃 (사이드바 + 메인 콘텐츠)
2. 라우팅 구조
3. 메뉴 네비게이션

### Phase 4: 관리자 사이트 기능 구현
1. 공통코드 관리 (카테고리 등)
2. 장소 관리 (목록, 등록, 수정, 상세)
3. 회원 관리 (목록, 상세)
4. 기타 장소 관리 (목록, 승격)

### Phase 5: 포스팅 UX 개선
1. 카테고리 선택 UI
2. 관리자 등록 장소 드롭다운
3. 기타 선택 및 자동완성
4. custom_place_names 통계 업데이트

### Phase 6: 통합 및 테스트
1. 전체 기능 테스트
2. 보안 검증
3. 성능 최적화

---

## ✅ 확인 사항

### 결정 필요
- [ ] 기타 장소 관리 메뉴 추가 여부 (추가 제안)
- [ ] 공통코드 관리 항목 최종 결정
- [ ] 관리자 사이트 프레임워크 선택 (React Router 등)

### 기술 스택
- **인증**: bcrypt + JWT 또는 Supabase Auth (별도 테이블)
- **세션 관리**: localStorage + JWT 또는 Supabase Session
- **라우팅**: React Router (관리자 사이트는 별도 앱 또는 같은 앱 내 라우팅)

### 추가 고려사항
- 관리자 사이트는 별도 앱으로 구축할지, 같은 앱 내 라우팅으로 할지
- 서브도메인 라우팅 설정 (Vercel)
- 관리자 작업 로그 기록 (나중에 추가 가능)
