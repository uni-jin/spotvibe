# 사용자 지도 검은 화면 원인 분석 (네이버 지도)

## 현상
- Map 메뉴 진입 시 우측 하단 아이콘(Discover only, 현재 위치)과 Naver 저작권 문구는 보임
- 지도 타일/맵 영역은 보이지 않고 검은 화면만 표시됨

## 원인 (타이밍 이슈)

### 1. Naver Maps SDK 로딩 방식
- `useNaverMapSdk()`에서 `<script src="...maps.js?ncpKeyId=...">`를 **비동기(async)** 로 삽입
- 스크립트 로드가 끝나야 `window.naver.maps`가 정의됨

### 2. 지도 생성 시점
- `LiveRadarNaverMap` 내부 지도 생성 `useEffect`는 **의존 배열이 `[]`** 로, **마운트 시 1회만 실행**됨
- 실행 시점 조건: `window.naver?.maps` 존재 && `mapRef.current` 존재 && `mapInstanceRef.current` 없음

### 3. 실제 흐름에서의 실패
1. 사용자가 Map 탭 클릭 → `currentView === 'map'` 이 되면서 `LiveRadarNaverMap` 마운트
2. 같은 타이밍에 `useNaverMapSdk()`가 스크립트 태그만 추가하고, 스크립트는 아직 로드 중
3. 지도 생성 effect가 **한 번만** 실행될 때 `window.naver?.maps`가 아직 `undefined`
4. 조건 불만족으로 **지도 생성 코드가 실행되지 않고 return**
5. effect는 deps가 `[]`라 **다시 실행되지 않음** → 스크립트가 나중에 로드되어도 지도는 생성되지 않음
6. 결과: 지도 컨테이너 div(`w-full h-full`)만 있고, 그 위에 MapControls·저작권만 렌더링 → **검은 화면처럼 보임**

### 4. 왜 아이콘과 저작권만 보이는가
- MapControls와 저작권 문구는 지도 인스턴스와 무관하게 **같은 부모 안에서 절대 위치로** 렌더링됨
- 지도가 생성되지 않아도 해당 UI는 그대로 표시됨

## 조치 내용

1. **`useNaverMapSdk` 수정**
   - 스크립트 로드 완료를 호출 측에 알리기 위해 **`isReady` 상태** 추가
   - `script.onload`에서 `setIsReady(true)` 호출
   - 이미 `window.naver?.maps`가 있으면 초기값을 `true`로 설정
   - 훅 반환값을 **`isReady`(boolean)** 로 변경

2. **`LiveRadarNaverMap` 수정**
   - `const sdkReady = useNaverMapSdk()` 로 준비 여부 사용
   - 지도 생성 effect 조건에 `sdkReady` 포함
   - effect 의존 배열을 **`[sdkReady]`** 로 변경  
     → SDK 로드 후 `sdkReady`가 `true`가 되면 effect가 **다시 실행**되어 그때 지도 생성

3. **관리자 지도(`AdminNaverMap`)**
   - 동일 타이밍 이슈 가능성이 있어, 같은 방식으로 `sdkReady` 사용 및 지도 생성 effect 의존 배열에 `[sdkReady]` 적용

## 요약
- **근본 원인**: SDK는 비동기 로드되는데, 지도 생성 effect는 마운트 시 1회만 실행되어, 그 시점에 `window.naver.maps`가 없으면 지도를 만들지 않고 재시도하지 않음.
- **해결**: SDK 로드 완료를 `useNaverMapSdk()`의 `isReady`로 노출하고, 지도 생성 effect가 `isReady`가 된 뒤에 실행·재실행되도록 의존 배열을 바꿈.
