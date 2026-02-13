# 🧪 Discover & Admin Hot Spots 테스트/가이드 (오늘 작업분 기준)

> 오늘은 코드만 작업해두고, **SQL(017, 018) 적용 및 실제 테스트는 내일부터** 진행하는 상태입니다.  
> 아래 문서는 내일 테스트할 때 따라가면 되는 체크리스트 + 남은 TODO를 정리한 것입니다.

---

## 1. 적용해야 할 Supabase SQL 마이그레이션

### 1-1. 016_add_posts_category_type.sql

**파일**: `supabase/migrations/016_add_posts_category_type.sql`

**역할**:
- `posts` 테이블에 `category_type TEXT DEFAULT 'other'` 컬럼 추가
- `idx_posts_category_type` 인덱스 생성

**언제 필요?**
- Map / Feed에서 포스트를 카테고리(`popup_store` / `other` 등) 기준으로 필터링하기 위해 필요
- 새로 작성되는 포스트는 선택한 카테고리를 `category_type`으로 저장

**실행 방법 (운영/로컬 공통)**:
1. Supabase Dashboard → 프로젝트 선택
2. SQL Editor → New query
3. `016_add_posts_category_type.sql` 내용 전체 복사/붙여넣기
4. Run

> ⚠️ 이 마이그레이션은 **여러 번 실행해도 `IF NOT EXISTS` 덕분에 안전**합니다.

---

### 1-2. 017_add_place_tags_and_links.sql

**파일**: `supabase/migrations/017_add_place_tags_and_links.sql`

**역할**:
- `places` 테이블에 다음 컬럼 추가:
  - `info_url TEXT` – 팝업 안내 URL (상세에서 새 탭으로 열기)
  - `phone TEXT` – 연락처
  - `hashtags TEXT[]` – 태그 코드값 배열
- 태그용 테이블 생성:
  - `place_tags` – 태그 마스터
  - `place_tag_mappings` – 장소-태그 매핑 (현재는 구조만 있고, 실제 사용은 `hashtags` 쪽에 맞춰 둔 상태)

**실행 순서**:
- 016 실행 후, 017 실행

---

### 1-3. 018_seed_place_tag_codes.sql

**파일**: `supabase/migrations/018_seed_place_tag_codes.sql`

**역할**:
- `common_codes`에 태그용 코드 세트(seed) 추가:
  - `place_tag_admission`
    - `reservation_required` (예약 필수)
    - `walkin_wait` (현장 대기)
    - `free_entry` (자유 입장)
  - `place_tag_benefit`
    - `goods` (굿즈 증정)
    - `samples` (샘플 제공)
    - `lucky_draw` (럭키드로우)
  - `place_tag_amenity`
    - `english_ok` (영어 가능)
    - `pet_friendly` (반려동물 동반)
    - `parking` (주차 가능)
  - `place_tag_content`
    - `photo_zone` (포토존)
    - `experience` (체험)
    - `fnb` (F&B 판매)

**실행 순서**:
- 017 실행 후, 018 실행

---

## 2. 내일 테스트할 주요 흐름 (관리자/Admin)

### 2-1. SQL 적용 확인

1. 016, 017, 018을 모두 Supabase에 실행
2. 간단 검증:

```sql
-- posts.category_type 확인
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'posts' AND column_name = 'category_type';

-- places 확장 컬럼 확인
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'places' 
  AND column_name IN ('info_url', 'phone', 'hashtags')
ORDER BY column_name;

-- 태그용 common_codes 확인
SELECT code_type, code_value, code_label_en 
FROM common_codes 
WHERE code_type LIKE 'place_tag_%'
ORDER BY code_type, display_order;
```

---

### 2-2. 관리자: 장소 등록/수정 (PlaceForm)

**화면**: Admin 로그인 → `장소관리`

체크리스트:
1. **Booking URL 필드가 더 이상 보이지 않는지 확인**
2. `설명 + Info URL + 전화번호 + Tags` 입력 블록 확인:
   - Info URL (선택)
   - 전화번호 (선택)
   - Tags 섹션:
     - Admission / Benefits / Amenities / Content 그룹이 나뉘어 있고,
     - 각 그룹 안에 오늘 정의한 태그들이 체크박스 + 라벨로 보이는지 확인
3. 새 장소 등록:
   - 카테고리: `Pop-up Store`
   - 대표사진, 위치, 노출기간(시작/종료), Info URL, 전화번호, 태그 몇 개 선택
   - 저장 → 에러 없이 성공 메시지 출력
4. 수정 모드:
   - 방금 등록한 장소 `수정` 버튼 클릭
   - 선택했던 태그/Info URL/전화번호가 그대로 채워져 있는지 확인

**DB 확인 (선택)**:

```sql
SELECT id, name, info_url, phone, hashtags
FROM places
ORDER BY id DESC
LIMIT 5;
```

예상:
- `hashtags` 컬럼에 `{'reservation_required','goods','photo_zone'}` 같은 배열이 들어있어야 함.

---

## 3. 내일 테스트할 주요 흐름 (사용자/Discover & Map & Feed)

### 3-1. Discover 첫 진입 & 네비게이션

1. 로컬에서 `npm run dev` 실행
2. 사용자 사이트 접속:
   - 처음엔 Home(지역 선택) 화면
   - 지역 선택 시 → **이제 Feed가 아니라 Discover 화면으로 진입**하는지 확인
3. 하단 탭:
   - `Discover | Feed | Map | My` 순서로 배치되었는지
   - Discover 선택 시 현재 Discover 화면이 유지되는지

---

### 3-2. Discover 리스트 화면

1. 지역 선택 후 Discover 진입
2. 상단:
   - 정렬 탭: `Distance`, `Latest`, `Hot` 3개가 보이는지
   - 탭을 눌렀을 때 정렬이 바뀌는지(대략적인 순서만 확인)
3. 리스트:
   - 1열 카드 리스트(모든 카드 동일 높이)로 보이는지
   - 각 카드에서:
     - 대표 이미지 (없으면 “No image” 박스)
     - 좌상단 D-Day (예: `D-3`, `3 days left`, `Ends tomorrow` 등)
     - 우상단 혼잡도 뱃지:
       - 10분 이내 포스팅이 있는 장소 → Vibe + 빨간 Live 점
       - 10~30분 이내 → Vibe만
       - 30분 이상 → 혼잡도 뱃지 없음
     - 하단 텍스트:
       - 스토어명
       - 거리 (`xxx m away`)
       - 기간 (`Jan 10 - Jan 23` 등)
       - `hashtags`가 있다면 `#tag` pill 형태로 최대 4개 노출
   - 카드에는 **Info URL 버튼이 없고**, 클릭 시 상세로 들어가는지만 확인

---

### 3-3. Discover 상세 화면

1. Discover 카드 하나 클릭 → `discover-detail` 화면으로 진입해야 함
2. 상단 헤더:
   - `← Back to Discover` 버튼
   - 클릭 시 다시 Discover 리스트로 돌아가는지 확인
3. 히어로 섹션:
   - 큰 대표 이미지 + 블랙 그라데이션
   - 좌상단: D-Day 배지
   - 우상단: 혼잡도 뱃지(신선도 규칙 동일)
   - 하단: 스토어명 + 거리
4. 정보 블록:
   - 기간: `formatDisplayPeriod` 결과
   - 설명: 관리자에서 입력한 `description`
   - 해시태그:
     - 선택한 태그 코드들이 `#reservation_required` 형식으로 최대 6개 정도 보이는지
5. Info URL / 전화번호:
   - Info URL 버튼:
     - 텍스트: `Open info`
     - 클릭 시 **새 탭으로만** 외부 사이트가 열리는지 (현재 페이지는 유지)
   - 전화번호가 있다면 `📞 02-xxx-xxxx` 형식으로 보이는지
6. 커뮤니티 섹션:

   - `From the community` 타이틀 아래에:
     - 해당 장소에 대한 사용자 포스트 썸네일(최대 4개) 그리드
     - 썸네일 클릭 시 기존 포스트 상세(Feed의 post-detail)로 이동하는지 확인

---

### 3-4. Map / Feed에 대한 회귀 테스트 (간단)

1. **Map**
   - 카테고리 탭에서 팝업스토어/Other 선택 시:
     - 016 마이그레이션 이후 새로 작성한 포스트가 올바른 카테고리에만 보이는지
2. **Feed**
   - Live Vibe Stream 섹션:
     - 마이그레이션/Discover 작업 이후에도 기존 포스트 표시/좋아요/상세 보기 동작에 이상 없는지
3. **Admin**
   - 장소관리 테이블:
     - 최근 상태/포스팅 수/활성화/노출기간/등록일이 여전히 올바르게 렌더링되는지

---

## 4. 남은/앞으로 진행할 작업 (TODO 개요)

1. **Discover 상세 태그 섹션 고도화**
   - 지금은 `hashtags` 배열(코드값)을 그대로 `#code_value`로 보여주는 상태
   - 추후:
     - 클라이언트에서 `common_codes`를 로드해
     - Admission / Benefits / Amenities / Content 섹션을 나누고,
     - 각 섹션에 태그 라벨(영문/한글)을 사람친화적으로 표시

2. **place_tags / place_tag_mappings 실제 활용 여부 결정**
   - 현재 구조는 `places.hashtags`에 코드값을 저장하는 간단한 버전
   - 필요 시:
     - `place_tags` / `place_tag_mappings`를 사용해 정규화된 태그 구조로 확장 가능

3. **Discover UI 다듬기**
   - 카드/상세의 레이아웃, 폰트, 여백, 애니메이션 등을 실제 디자인 감안해 조정
   - Hot/Latest 정렬 기준을 “최근 7일” 등 기간 제한으로 더 세밀하게 조정할 수도 있음

4. **운영 배포 준비**
   - 로컬에서 위 테스트 체크리스트를 모두 통과한 뒤:
     - 016/017/018 마이그레이션을 **운영 Supabase**에도 적용
     - Git 커밋 & GitHub push → Vercel 자동 배포
     - 운영 사이트에서 동일 시나리오 재검증

---

## 5. 요약

- **SQL**: 016(포스트 카테고리), 017(places 확장 + 태그 테이블), 018(태그 공통코드 seed) 순서로 실행.
- **Admin**: 장소 등록/수정에 Info URL·전화번호·태그(공통코드 기반) UI 추가, 저장 시 places에 반영.
- **Discover**:
  - 지역 선택 후 최초 화면은 Discover.
  - Discover 리스트: 팝업 전용 1열 카드 + D-Day + 혼잡도 + 기간 + 해시태그.
  - Discover 상세: Info URL(새 탭), 전화번호, 설명, D-Day, 혼잡도, 커뮤니티 포스트 연계.
- **내일 할 일**: 위 체크리스트 순서대로 **SQL 적용 → Admin → Discover → Map/Feed 회귀**를 테스트하고, 그 다음 태그 섹션 고도화 및 디자인 다듬기를 진행하면 됩니다.

