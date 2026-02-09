# 🛠️ SpotVibe 개발 로드맵

## 📋 현재 상태
- ✅ 기본 UI/UX 완성
- ✅ 구글 로그인 기능 활성화
- ✅ Post Vibe 모달 UI 완성
- ✅ MY 페이지 프로필 화면
- ✅ 데이터베이스 연동 완료
- ✅ 실제 Post Vibe 기능 완료 (이미지 업로드, Supabase 저장)
- ✅ 좋아요 기능, 포스트 삭제 기능
- ✅ 포스트 설명 기능
- ✅ 촬영 일시 표시 개선

## 🎯 Phase 1: 팝업스토어 집중 개발

### 서비스 방향
- **초점:** 성수동 팝업스토어 정보만 먼저 공유
- **Hot Spots Now:** 팝업스토어 정보만 메인으로 표시
- **GPS 기반 정렬:** 사용자 위치 기준으로 가까운 순서로 정렬
- **관리자 사이트:** 팝업스토어 등록/관리 기능

---

## 📝 작업 순서

### ✅ 1단계: 데이터베이스 스키마 수정 및 준비 (완료)
**목표:** 팝업스토어 타입 구분을 위한 스키마 수정

- [x] `places` 테이블에 `type` 필드 추가 (예: 'popup_store', 'cafe', 'restaurant' 등)
- [x] `places` 테이블에 `is_active` 필드 추가 (활성/비활성 팝업스토어 구분)
- [x] 기존 seed 데이터에 type 정보 추가
- [x] 마이그레이션 파일 생성 및 실행

**파일:**
- `supabase/migrations/004_add_place_type.sql` ✅

---

### ✅ 2단계: Post Vibe 기능 - Supabase 연동 (완료)
**목표:** Post Vibe 시 실제로 Supabase에 저장

- [x] Supabase Storage 버킷 생성 (`post-images`)
- [x] 이미지 업로드 기능 구현 (`src/lib/supabase.js`의 `uploadImage` 함수)
- [x] `handlePostVibe` 함수 수정하여 Supabase에 저장
  - 이미지 업로드 → URL 획득
  - `db.createPost()` 호출
  - 성공 시 로컬 state 업데이트
- [x] 에러 핸들링 및 로딩 상태 추가
- [x] 성공 토스트 메시지 개선

**수정 파일:**
- `src/App.jsx` - `handlePostVibe` 함수 ✅
- `src/lib/supabase.js` - `uploadImage`, `createPost` 함수 ✅

---

### ✅ 3단계: 예시 데이터 삭제 및 실제 데이터 로드 (완료)
**목표:** Mock 데이터 제거하고 Supabase에서 실제 데이터 가져오기

- [x] `initialPosts` Mock 데이터 제거
- [x] `hotSpots` 하드코딩 데이터 제거
- [x] `useEffect`에서 Supabase에서 데이터 로드
  - `db.getPosts()` 호출하여 포스트 가져오기
  - `db.getPlaces()` 호출하여 팝업스토어 목록 가져오기
- [x] 로딩 상태 추가
- [x] 에러 핸들링

**수정 파일:**
- `src/App.jsx` - 초기 데이터 로딩 로직 ✅

---

### 4단계: Hot Spots Now - 팝업스토어만 표시 (6단계 이후)
**목표:** Hot Spots Now 섹션에 팝업스토어만 필터링하여 표시

- [ ] `db.getPlaces()` 호출 시 `type = 'popup_store'` 필터 추가
- [ ] Hot Spots Now 섹션에서 팝업스토어만 표시
- [ ] UI 텍스트 변경 ("Hot Spots Now" → "Pop-up Stores Now" 또는 유지)
- [ ] 팝업스토어가 없을 때 빈 상태 처리

**수정 파일:**
- `src/lib/supabase.js` - `getPlaces` 함수
- `src/App.jsx` - Feed View의 Hot Spots Now 섹션

**참고:** 관리자 사이트에서 팝업스토어 데이터를 먼저 입력한 후 진행

---

### 5단계: GPS 기반 거리 계산 및 정렬 (우선 작업)

### 5단계: GPS 기반 거리 계산 및 정렬 (우선 작업)
**목표:** 사용자 위치 기준으로 가까운 팝업스토어 순서로 정렬

**상세 작업 계획:**

1. **유틸 함수 생성** (`src/utils/geolocation.js`)
   - [ ] `getUserLocation()`: Geolocation API로 사용자 위치 가져오기
     - `navigator.geolocation.getCurrentPosition()` 사용
     - Promise 기반 반환
     - 에러 핸들링 (권한 거부, 타임아웃 등)
   - [ ] `calculateDistance(lat1, lng1, lat2, lng2)`: Haversine formula로 거리 계산
     - 지구상 실제 거리 계산 (km 단위)
     - 반환값: 거리 (숫자, km)
   - [ ] `formatDistance(distance)`: 거리 포맷팅
     - 1km 미만: "500m away"
     - 1km 이상: "1.2km away"

2. **App.jsx 수정**
   - [ ] `userLocation` state 추가: `{ lat: number, lng: number } | null`
   - [ ] `useEffect`에서 앱 로드 시 위치 요청
     - 권한 요청 및 사용자 위치 저장
     - 실패 시 에러 로그만 (사용자에게 강제하지 않음)
   - [ ] `hotSpots` 정렬 로직 수정
     - 위치가 있을 때: 거리순 정렬
     - 위치가 없을 때: 기존 정렬 유지 (이름순)
   - [ ] `hotSpots`에 `distance` 필드 추가 (표시용)

3. **Hot Spots Now UI 수정** (1056-1097 라인)
   - [ ] 거리 정보 표시
     - 위치가 있을 때: "1.2km away" 표시
     - 위치가 없을 때: 거리 정보 숨김
   - [ ] 거리 정보 스타일링
     - 작은 회색 텍스트로 표시
     - 상태 정보 옆에 배치

4. **에러 핸들링**
   - [ ] 위치 권한 거부 시: 조용히 실패, 기본 정렬 사용
   - [ ] 위치 가져오기 실패 시: 기본 정렬 사용
   - [ ] 타임아웃 처리 (10초)

**수정 파일:**
- `src/utils/geolocation.js` (새 파일 생성)
- `src/App.jsx` - 위치 가져오기 및 정렬 로직, Hot Spots Now UI

**참고사항:**
- HTTPS 환경에서만 Geolocation API 작동
- 사용자 경험: 위치 권한을 강제하지 않고, 제공되면 활용
- 성능: 위치는 한 번만 가져오고 캐싱 (새로고침 시 재요청)

---

### 6단계: 관리자 사이트 - 팝업스토어 등록 (5단계 이후)
**목표:** 관리자가 팝업스토어를 등록/수정/삭제할 수 있는 사이트

- [ ] 관리자 인증 시스템 (Supabase RLS 또는 별도 인증)
- [ ] 관리자 대시보드 페이지 생성
  - 팝업스토어 목록
  - 팝업스토어 등록 폼
  - 팝업스토어 수정/삭제 기능
- [ ] 폼 필드:
  - 이름 (한글/영문)
  - 타입 (popup_store)
  - 좌표 (lat, lng) - 지도에서 선택 또는 직접 입력
  - 상태 (Very Busy, Busy, No Wait 등)
  - 대기 시간
  - 활성화 여부
- [ ] Supabase에 저장하는 API 함수 구현

**새 파일:**
- `src/admin/AdminDashboard.jsx` (또는 별도 라우트)
- `src/lib/admin.js` - 관리자용 API 함수

**수정 파일:**
- `src/lib/supabase.js` - 관리자용 함수 추가 (또는 별도 파일)

---

### 7단계: Post Vibe - 장소 선택 개선 (6단계 이후)
**목표:** Post Vibe 시 실제 팝업스토어 목록에서 선택

- [ ] Post Vibe 모달의 장소 선택을 Supabase에서 가져온 팝업스토어 목록으로 변경
- [ ] "기타" 옵션 유지 (직접 입력 가능)
- [ ] 장소 선택 드롭다운에 거리 정보 표시 (5단계에서 구현한 거리 정보 활용)

**수정 파일:**
- `src/App.jsx` - `PostVibeModal` 컴포넌트

**참고:** 관리자 사이트에서 팝업스토어 데이터를 먼저 입력한 후 진행

---

### 8단계: 테스트 및 최적화
**목표:** 전체 기능 테스트 및 성능 최적화

- [ ] Post Vibe 기능 전체 테스트
- [ ] GPS 기반 정렬 정확도 확인
- [ ] 이미지 업로드 성능 테스트
- [ ] 관리자 사이트 테스트
- [ ] 에러 케이스 처리 확인
- [ ] 로딩 상태 UX 개선

---

## 🔄 이후 단계 (Phase 2+)

### Phase 2: 일반 핫플레이스 확장
- 카페, 레스토랑 등 다른 타입 추가
- 타입별 필터링 기능
- 지역 확장 (홍대, 강남 등)

### Phase 3: 고급 기능
- 실시간 알림 (새로운 제보)
- 사용자 프로필 상세화
- 리워드 시스템
- 통계 대시보드

---

## 📌 참고사항

### 데이터베이스 스키마 변경 시
- 마이그레이션 파일은 항상 새로 생성
- 기존 데이터와의 호환성 고려
- RLS 정책 업데이트 필요 시 함께 수정

### 이미지 업로드
- Supabase Storage 버킷 생성 필요
- Public access 설정
- 파일 크기 제한 설정 (예: 5MB)
- 이미지 최적화 고려 (리사이징 등)

### GPS 기능
- HTTPS 환경에서만 작동 (Vercel 배포 시 문제없음)
- 위치 권한 거부 시 대체 로직 필요
- 위치 정확도와 배터리 사용량 균형 고려

### 관리자 사이트
- 보안: 관리자 권한 체크 필수
- Supabase RLS 정책으로 관리자만 접근 가능하도록 설정
- 또는 별도 인증 시스템 구축
