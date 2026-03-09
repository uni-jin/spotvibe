# GA에서 Discover / Map 화면 구분 가능 여부

## 현재 구조 요약

- **라우팅**: React Router는 `/admin/*` vs `/*` 만 구분. 메인 앱은 **경로 하나** (`/*`)에서 전부 렌더.
- **화면 전환**: URL이 바뀌지 않음. 앱 내부 상태 `currentView` (`'discover' | 'map' | 'my' | 'feed' | 'quest' | …`) 로만 전환.
- **결과**:  
  `https://spotvibe-k.vercel.app/?utm_source=qr&utm_medium=offline&utm_campaign=seongsu` 로 들어오면 **첫 로드 시 한 번만** page_view가 발생하고, Discover ↔ Map 탭을 눌러도 **URL이 그대로**이므로 GA에는 추가 page_view가 찍히지 않음.  
  → **지금 구조만으로는 GA에서 “discover 본 사람 / map 본 사람”을 구분할 수 없음.**

## 대응: 화면별 이벤트 전송

`currentView`가 바뀔 때마다 GTM `dataLayer`에 `screen_view` 이벤트를 넣어 두었습니다.

- **이벤트명**: `screen_view`
- **파라미터**: `screen_name` = 현재 뷰 ID (예: `discover`, `map`, `my`, `feed`, `discover-detail`, `post-detail` 등)

### GTM 설정 (한 번만 하면 됨)

1. **트리거**
   - 유형: Custom Event  
   - 이벤트 이름: `screen_view`
2. **GA4 이벤트 태그**
   - 이벤트 이름: `screen_view`  
   - 매개변수:  
     - `screen_name` = `{{DLV - screen_name}}` (dataLayer Variable로 `screen_name` 생성)
   - 트리거: 위 Custom Event 트리거

이렇게 하면 GA4에서 `screen_view` 이벤트 + `screen_name` 으로 discover / map / my 등을 구분해서 보고·세그먼트할 수 있습니다.  
(UTM은 첫 진입 시 한 번만 붙고, 이후 화면 이동은 모두 같은 세션으로 묶이므로 “어느 캠페인 유입이 discover/map을 봤는지”도 GA에서 분석 가능.)
