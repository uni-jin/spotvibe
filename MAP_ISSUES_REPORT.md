# Map 관련 이슈 분석 보고서

## 1. 클러스터 선택 시 다른 위치 포스팅이 사라지는 현상

### 현재 동작
- **위치**: `App.jsx` `clusterPosts(posts, zoomLevel)` (약 1751~1831라인)
- **로직**:
  - `mapZoom === 2` 이고 `selectedCluster`가 있을 때:
    - **반환값**: `selectedCluster.posts`만 개별 아이템으로 변환해서 반환 (1753~1764라인)
    - 즉 **선택한 클러스터에 속한 포스트만** `mapItems`가 됨
  - 그 결과, 지도에 그려지는 마커는 **클릭해서 펼친 그 클러스터의 포스트들뿐**이고, 원래 보이던 **다른 위치의 단일 마커/다른 클러스터**는 모두 사라짐

### 원인
- 클러스터 확대 시 “선택된 클러스터만 보여주는” 설계로 되어 있음.
- `mapItems = clusterPosts(postsForMap, mapZoom)`에서 zoom 2 + selectedCluster 분기 시 **전체 목록(`postsForMap`)을 버리고** `selectedCluster.posts`만 쓰기 때문.

### 기대 동작
- 클러스터를 눌러 “펼친” 상태에서도:
  - **선택한 클러스터** → 해당 포스트들이 개별 마커로 펼쳐져서 보이고
  - **그 외 포스트** → 기존처럼 다른 위치에 단일 마커 또는 다른 클러스터로 **그대로** 보여야 함.

### 수정 방향
- zoom 2 + selectedCluster 일 때:
  - 선택된 클러스터의 포스트들은 **개별 마커**로 변환하고
  - **선택된 클러스터에 포함되지 않은** `postsForMap` 포스트들은 **기존 클러스터링 로직(zoom 1일 때와 동일)**으로 다시 클러스터/단일 마커로 계산
- 최종 `mapItems` = (선택 클러스터 개별 마커들) + (나머지 포스트에 대한 클러스터/단일 마커들).

---

## 2. 사용자 현재 위치 아이콘에 반짝이는 애니메이션

### 현재 동작
- **위치**: `App.jsx` `UserLocationMarker` (약 1854~1898라인)
- **구성**: `CircleMarker` 두 개 (반경 7, 14)로 고정 스타일만 적용.
- **스타일**: `pathOptions`로 색·투명도·두께만 지정, **애니메이션 없음**.

### 기대 동작
- 사용자 위치 마커에 **반짝이거나 맥동하는(pulse)** 시각 효과를 넣어서, “내 위치”가 한눈에 구분되도록 함.

### 수정 방향
- `CircleMarker`에 적용 가능한 방식 중 하나:
  - **CSS 애니메이션**: Leaflet 마커/레이어에 `className`을 주고, `index.css` 등에 `@keyframes pulse`(또는 `ping`) 정의 후 `animation` 적용.
  - 또는 **외곽 링**용 `CircleMarker`를 하나 더 두고, 해당 링에만 `pulse` 애니메이션을 적용해 “터지는” 느낌으로 표현.
- Leaflet `CircleMarker`는 SVG path이므로, **외부 링용 div/SVG를 별도로 그리거나**, 기존 `pathOptions`만으로는 애니메이션이 제한적일 수 있어, **커스텀 컴포넌트(div + CSS 애니메이션)**로 사용자 위치만 별도 렌더링하는 방식도 고려 가능.

---

## 3. 팝업스토어로 포스팅했는데 Map에서 Other에만 노출되는 문제

### 현재 동작
- Map 상단 카테고리 필터: `selectedHotSpotCategory` (예: `popup_store`, `other` 등).
- 표시할 포스트:  
  `postsForMap = vibePosts.filter((post) => (post.category_type || 'other') === selectedHotSpotCategory)`  
  → **포스트의 `category_type`이 선택한 카테고리와 일치할 때만** 지도에 표시.

### 원인
- **과거에 작성된 포스트**:
  - DB에 `category_type` 컬럼이 없던 시절에 저장된 행은 **값이 NULL**.
  - 마이그레이션으로 컬럼을 추가해도 **기존 행은 그대로 NULL**.
  - 앱에서는 `getPosts` 시 `category_type: post.category_type ?? 'other'` 로 매핑하므로, **NULL → `'other'`** 로만 보임.
- 따라서 **수정 작업(코드/마이그레이션) 이전에 올라간 포스트**는 모두 `category_type`이 없거나 NULL → 앱에서는 전부 `'other'`로 취급되며, **팝업스토어 탭에서는 안 보이고 Other 탭에서만 보이는 것이 맞는 동작**입니다.

### 정리
- **원인**: “수정 전에 올라간 포스팅은 이미 분류가 Other로 들어가 있어서”가 아니라, **당시에는 `category_type` 자체가 저장되지 않았고(또는 컬럼이 없었고), 지금은 NULL을 `'other'`로만 해석하기 때문**에 Other에만 노출되는 것입니다.
- **수정 후 새로 작성된 포스트**는 선택한 카테고리(예: 팝업스토어)가 `category_type`으로 저장되므로, 해당 카테고리 탭에서 정상 노출됩니다.
- 기존 데이터를 팝업스토어 등으로 바꾸려면 **별도 배치/수동 작업**으로 해당 포스트들의 `category_type`을 업데이트해야 하며, 그건 선택 사항입니다.

---

## 요약

| # | 이슈 | 원인 | 비고 |
|---|------|------|------|
| 1 | 클러스터 선택 시 다른 위치 포스팅이 안 보임 | zoom 2 + selectedCluster일 때 `mapItems`를 선택 클러스터 포스트만으로 덮어씀 | 선택 클러스터만 펼치고, 나머지는 기존처럼 클러스터/단일 마커 유지하도록 로직 분리 필요 |
| 2 | 사용자 위치 아이콘 정적임 | `UserLocationMarker`에 애니메이션 미적용 | CSS pulse 등 반짝이는 효과 추가 |
| 3 | 팝업스토어 포스팅이 Other에만 보임 | 과거 포스트는 `category_type` NULL → 앱에서 `'other'`로만 처리 | 수정 전 데이터는 Other만 노출되는 것이 맞고, 신규 포스트부터 카테고리별 노출됨. 필요 시 기존 데이터 일괄 수정 가능 |
