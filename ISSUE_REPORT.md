# 이슈 분석 및 처리 방안 보고서

## 1. 장소명 긴 경우 모바일에서 영역 이탈 (말줄임 처리)

### 현상
- **위치**: Feed 뷰 → Masonry 카드 → 장소명 버튼 (`📍 Ongredients inner glow VIP Lounge`)
- **DOM**: `button.inline-block px-2.5 py-1 ... whitespace-nowrap ...`
- 장소명이 길면 `whitespace-nowrap` 때문에 한 줄로 늘어나 모바일에서 가로 스크롤/영역 이탈 발생

### 원인
- `App.jsx` 1586~1598 라인: 장소명 버튼에 `whitespace-nowrap`만 있고 **최대 너비 제한**과 **말줄임 스타일**이 없음

### 처리 방안
- 장소명 버튼(또는 감싸는 블록)에:
  - `max-width: 100%` 또는 부모 기준 `max-w-full` 등으로 최대 너비 고정
  - `overflow: hidden`, `text-overflow: ellipsis` 적용
  - 긴 텍스트만 줄이려면 `whitespace-nowrap` 유지 + 위 스타일로 한 줄 말줄임
- 수정 위치: `App.jsx` 내 Masonry 카드의 Place Name 버튼 부분 (약 1584~1598 라인)

---

## 2. Map 화면에서 카테고리별 사진/포스트가 안 보이는 문제 (Other만 표시)

### 현상
- 포스팅 시 카테고리 **팝업스토어** 선택 + 관리자 등록 장소 선택 후 업로드
- Map 화면에서는 **Other** 탭 선택 시에만 사용자 포스트(사진)가 보임
- 기대: 선택한 카테고리(예: 팝업스토어)에 맞춰 해당 카테고리 포스트가 지도에 표시

### 원인
- **포스트 저장 시 `category_type` 미저장**
  - `App.jsx` `handlePostVibe`: `postData`에 `postCategory`(카테고리)를 넣지 않음 (1059~1076 라인)
  - `lib/supabase.js` `createPost`: `posts` insert 시 `category_type` 컬럼을 사용하지 않음 (193~208 라인)
- **조회 시 `category_type` 미반영**
  - `lib/supabase.js` `getPosts`: select/transform 시 `category_type`를 포함하지 않음 (94~123 라인)
- **Map 필터 로직**
  - `App.jsx` 1967~1970: `postsForMap = vibePosts.filter((post) => (post.category_type || 'other') === selectedHotSpotCategory)`
  - 저장/조회에 `category_type`이 없으므로 모든 포스트가 `category_type === undefined` → `'other'`로 취급됨 → **Other 선택 시에만 노출**

### 처리 방안
1. **DB**
   - `posts` 테이블에 `category_type` 컬럼이 없으면 추가 (예: `text`, nullable 또는 기본값 `'other'`).
2. **저장**
   - `handlePostVibe`에서 `postData`에 `categoryType: postCategory` 추가.
   - `createPost(postData)`에서 `category_type: postData.categoryType ?? 'other'` 로 insert.
3. **조회**
   - `getPosts`의 select에 `category_type` 포함, transform 시 `category_type: post.category_type ?? 'other'` 로 매핑.
4. **표시 방식 유지**
   - 관리자 등록 장소 = 핀(마커), 사용자 포스트 = 사진 마커는 현재 구조 유지.  
   - 위 수정만으로 “선택한 카테고리에 맞게 사진도 표시”되도록 함.

---

## 3. 관리자 등록 장소 카드에 사용자 Vibe가 반영되지 않음 (Busy 올렸는데 Quiet 표시)

### 현상
- 포스팅 시 Vibe **Busy**로 선택해 업로드
- Feed 상단 가로 스크롤 장소 카드에는 해당 장소가 **🟢 Quiet**으로 표시됨  
  (예: "Ongredients inner glow VIP Lounge ... 🟢 Quiet")

### 원인
- **장소 카드 표시값**
  - `App.jsx` 1477: `{spot.status}` 로 표시.
- **`spot.status` 설정 경로**
  - `loadPlaces` useEffect (176~274): `db.getPlaces()` 결과를 `formattedPlaces`로 만들 때  
    `status: place.status || '🟢 Quiet'` (190 라인)  
    → **DB의 `places.status`(또는 기본값)만 사용**, 사용자 포스트의 최신 Vibe를 전혀 반영하지 않음.
- **placeStats**
  - 같은 useEffect 내에서 `vibePosts`로 `placeStats`를 만들 때 **포스트 수·최신 시간**만 사용하고, **최신 포스트의 vibe**는 저장/사용하지 않음 (226~259 라인).
- 따라서 “관리자가 올린 곳의 Vibe는 사용자가 올린 최신 Vibe를 따라가게”라는 요구사항과 불일치.

### 처리 방안
1. **`loadPlaces` 내 placeStats 확장**
   - `placeStats[placeName]`에 `latestVibe`(최신 포스트의 `vibe` 값, 예: `'busy'`, `'quiet'`)를 함께 저장.
   - “최신” 기준은 기존과 동일: `latestTimestamp`를 갱신할 때 해당 포스트의 `post.vibe`를 `latestVibe`로 설정.
2. **GPS 있는 경우**
   - 현재는 `userLocation`이 있으면 placeStats를 만들지 않고 거리순만 정렬.  
     **장소별 최신 Vibe**는 카테고리와 무관하게 필요하므로, `userLocation` 여부와 관계없이 **항상** `vibePosts`로 “장소명 → 최신 vibe” 맵을 계산하는 것이 좋음.
3. **hotSpots(spot)의 status 결정**
   - `formattedPlaces`를 만들 때:
     - 해당 장소에 대한 `placeStats`의 `latestVibe`가 있으면 → `getVibeInfo(latestVibe).label`(예: `⏱️ Busy`)를 `status`로 사용.
     - 없으면 → 기존처럼 `place.status || '🟢 Quiet'` 유지.
   - 이렇게 하면 “관리자 등록 장소 카드 = 사용자 최신 Vibe 반영”이 됨.
4. **구현 시 참고**
   - `getVibeInfo`는 컴포넌트에 있으므로, effect 안에서는 `vibeOptions.find(v => v.id === vibeId)?.label` 등으로 동일 로직을 한 번 더 쓰거나, `placeStats`에는 `latestVibe`(id만) 저장하고 **렌더 시** `getVibeInfo(spot.latestVibe)?.label ?? spot.status` 로 표시하는 방식도 가능.  
   - 전자(effect에서 label까지 넣어서 `spot.status`로 통일)면 기존 `{spot.status}` 그대로 사용 가능.

---

## 요약

| # | 이슈 | 원인 | 핵심 수정 |
|---|------|------|-----------|
| 1 | 장소명 모바일 이탈 | 장소명 버튼에 max-width/ellipsis 없음 | 장소명 버튼에 max-width + overflow hidden + text-overflow ellipsis |
| 2 | Map에서 Other만 포스트 표시 | 포스트 저장/조회에 category_type 없음 | posts에 category_type 저장·조회, Map 필터는 기존 로직 유지 |
| 3 | 장소 카드에 Quiet만 표시 | spot.status가 DB place 기준, 사용자 최신 Vibe 미반영 | placeStats에 latestVibe 추가, hotSpots의 status를 최신 포스트 Vibe로 덮어쓰기 |

위 순서대로 적용하면 세 가지 현상이 모두 해결됩니다.
