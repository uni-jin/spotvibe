# 댓글 단 장소 → 상세 화면 검은색 화면 원인 분석 보고

## 현상
- Discover에서 장소 상세로 들어가 댓글 작성 후, 마이페이지 "댓글 단 장소"에서 해당 장소를 탭하면 상세 화면이 검은색만 보이고 내용이 보이지 않음.

## 가능 원인 (우선순위)

### 1. **상세 진입 시 spot이 null이 되는 경우**
- `discover-detail` 뷰는 맨 앞에서 `if (!selectedDiscoverSpot)`이면 `setCurrentView('discover')` 후 `return null`을 함.
- 마이페이지에서 `setSelectedDiscoverSpot({ ...spot, name_en: spot.nameEn })` + `setCurrentView('discover-detail')`을 동시에 호출하지만, 리렌더 순서나 배칭에 따라 **한 프레임에서** `currentView`만 `discover-detail`로 바뀌고 `selectedDiscoverSpot`은 아직 비어 있을 수 있음.
- 그 프레임에서 상세 블록이 실행되면 `selectedDiscoverSpot`이 null이라 바로 `return null`이 되고, 검은 배경만 보이는 것처럼 보일 수 있음.

### 2. **마이페이지에서 넘기는 spot과 Discover 목록의 spot 구조 차이**
- 마이페이지 "댓글 단 장소"는 `hotSpots.filter(s => placeIdsCommentedByUser.includes(s.id))`로 같은 `hotSpots` 소스 사용.
- 다만 클릭 시 `{ ...spot, name_en: spot.nameEn }`만 넘기고 있어, 이 객체가 **직렬화/참조 과정에서** 또는 **다른 뷰 전환으로 hotSpots가 갱신된 뒤** 예전 스냅샷이 되면, `display_periods` 등이 없거나 형식이 다를 수 있음.
- 상세에서 `getDDayBadgeLabel(spot)` → `getEffectiveDisplayPeriod(spot)` → `getCurrentOrNextPeriod(spot.display_periods)` 등이 **기대하는 형식**(예: `display_start_date`/`display_end_date` 문자열)과 맞지 않으면 예외가 나고, 에러 바운더리가 없으면 상세가 아예 안 그려져 검은 화면처럼 보일 수 있음.

### 3. **날짜/기간 유틸 예외**
- `getKstDateKeyFromString`, `kstStringToInstant` 등은 **문자열**을 전제로 함. Supabase가 `display_start_date`/`display_end_date`를 Date 객체나 다른 형식으로 주면 `String(x)`만으로는 파싱이 실패하고, 일부 경로에서 예외가 날 수 있음.
- 상세 최초 렌더 시 `getDDayBadgeLabel(spot)` 등이 throw하면 그 위의 JSX가 실행되지 않아 검은 화면이 될 수 있음.

### 4. **PlaceCommentsSection 등 자식 예외**
- `PlaceCommentsSection`에 `spot`을 넘길 때 `spot.id`가 없거나 형식이 다르면, 내부 `db.getPlaceComments(spot.id)` 또는 렌더링 로직에서 예외가 날 수 있음.

## 권장 대응

1. **마이페이지에서 진입할 때 spot을 항상 hotSpots에서 다시 조회**
   - `discover-detail`에서 `discoverDetailFrom === 'my'`이면 `hotSpots.find(s => s.id === selectedDiscoverSpot.id)`로 현재 목록의 spot을 사용.
   - 없으면 (노출 기간 만료 등으로 목록에서 빠진 경우) 마이페이지로 되돌리기.
   - 이렇게 하면 Discover 목록과 **동일한 객체 구조**로 상세를 그리므로, 날짜/기간 유틸과의 불일치 가능성을 줄일 수 있음.

2. **상세 블록 진입 시 null 처리 보강**
   - `selectedDiscoverSpot`이 없을 때 Discover가 아니라 **진입 경로(discoverDetailFrom)**에 따라 복귀 (마이에서 왔으면 마이로).
   - 또는 `discover-detail`로 전환할 때 spot을 먼저 set하고, 다음 이벤트/프레임에서 view만 전환하는 방식으로, null인 한 프레임을 없애는 방법 검토.

3. **날짜/기간 유틸 방어 코드**
   - `getEffectiveDisplayPeriod`, `getDDayBadgeLabel` 등에서 `display_periods`/날짜 필드가 없거나 형식이 다를 때 예외 대신 null 또는 기본값을 반환하도록 하여, 상세가 아예 안 그려지는 상황 방지.

4. **에러 바운더리**
   - discover-detail 구간에 에러 바운더리를 두면, 자식에서 예외가 나도 "다시 시도" 등으로 복구할 수 있고, 원인 로그 수집에 유리함.

위 1번(마이 진입 시 hotSpots에서 spot 재조회)을 먼저 적용하고, 필요 시 2·3번을 추가하는 것을 권장함.
