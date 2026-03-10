# 장소 카테고리 코드명 한국어/영어 저장·다국어 미동작 원인 분석

## 요약

- **설정에서 한국어/영어 입력 후 다시 들어가면 사라지는 이유**: DB와 RPC가 **한 개의 `code_label`만** 저장하도록 되어 있는데, 관리자 저장 시 **한국어만** 그 값으로 넘기고 **영어는 어디에도 저장하지 않음**. 다시 불러오면 `code_label`만 내려와서 한국어 필드에만 채워지고, 영어 필드는 항상 빈 값으로 초기화됨.
- **사용자 화면에서 다국어가 안 되는 이유**: DB에 한국어/영어가 따로 없고, 사용자 앱도 `category.code_label` 하나만 쓰고 있어서 언어(lang)에 따라 바꿀 수 있는 구조가 아님.

즉, **SQL(마이그레이션)에서 한/영을 하나로 합친 뒤, 복원하지 않았고**, 그에 맞춘 **RPC·admin·사용자 앱 쪽도 단일 라벨만** 다루고 있어서 발생한 문제입니다.

---

## 1. DB 스키마 (마이그레이션 기준)

### 012_create_common_codes.sql (최초)

- `code_label_ko` (TEXT NOT NULL), `code_label_en` (TEXT) 존재.
- 시드 데이터도 `code_label_ko`, `code_label_en` 로 넣음.

### 015_unify_common_code_label.sql (통합)

- **`code_label` 하나만** 쓰기 위해:
  - `code_label` 컬럼 추가.
  - 기존 데이터: `code_label = COALESCE(code_label_en, code_label_ko)` 로 이전.
  - **`code_label_ko`, `code_label_en` 컬럼 삭제.**

그 결과, **현재 `common_codes` 테이블에는 `code_label` 한 컬럼만 있고, 한국어/영어를 구분해 저장할 컬럼이 없음.**

---

## 2. RPC (025_admin_common_codes_rpc.sql)

- `admin_save_common_code` 시그니처:
  - `p_code_label` (TEXT) **한 개만** 받음.
- INSERT/UPDATE 모두 `code_label` 컬럼만 설정.

즉, **DB·RPC 모두 “한 가지 라벨”만 저장/갱신 가능한 상태.**

---

## 3. 관리자 쪽 (admin.js + SettingsManagement.jsx)

### 저장 (saveCommonCode)

- 폼에서는 `code_label_ko`, `code_label_en` 두 값을 넘김.
- `admin.js` 에서는:
  - `unifiedLabel = code_label_ko?.trim() || code_label?.trim() || code_value`
  - **`p_code_label`에는 이 `unifiedLabel` 하나만** 넘김.
- 따라서 **영어(`code_label_en`)는 RPC/DB로 전혀 전달되지 않음.**

### 불러오기 (getCommonCodes → 폼 초기값)

- `getCommonCodes`는 `select('*')` 로 조회 → 실제로는 **`code_label`만** 존재.
- 폼 초기값:
  - `code_label_ko: code?.code_label_ko || code?.code_label || ''`
  - `code_label_en: code?.code_label_en || ''`
- DB 행에는 `code_label_ko`, `code_label_en` 이 없으므로:
  - 한국어 필드: `code_label` 값으로 채워짐.
  - 영어 필드: `code_label_en` 이 항상 undefined → **항상 빈 문자열.**

그래서 **한국어/영어 다 넣고 저장한 뒤, 다시 설정 화면에 들어가면 영어는 사라져 있고, 한국어만 남아 있는 것처럼 보이는 것.**

---

## 4. 사용자 앱 (App.jsx)

- 장소 카테고리는 `getCommonCodes('place_category', false)` 로 가져와서 `categories` 에 넣음.
- 화면에서는 전부 **`category.code_label`만** 사용 (Feed/지도/Post Vibe 모달 등).
- `lang`(ko/en)에 따라 `code_label_ko` / `code_label_en` 를 선택하는 로직이 **없음**.  
  그리고 DB에 그런 필드가 없으므로, **다국어를 할 수 있는 데이터 자체가 없음.**

한편 place_tag 용으로는 `placeTagLabelMap` 에서  
`c.code_label_ko || c.code_label`, `c.code_label_en || ko` 를 쓰려고 하나,  
실제로는 행에 `code_label_ko`/`code_label_en` 이 없어서 둘 다 `code_label` 로만 채워짐 (실질적으로 단일 언어).

---

## 5. 정리 (원인)

| 현상 | 원인 |
|------|------|
| 설정에서 코드명 한국어/영어 입력 후 다시 들어가면 영어(또는 한국어)가 사라져 있음 | 015에서 `code_label_ko`/`code_label_en` 제거 후, DB·RPC는 단일 `code_label`만 저장. admin은 저장 시 `code_label_ko`만 `p_code_label`로 보내고, 영어는 미저장. 불러올 때는 `code_label`만 있으므로 영어 필드는 항상 빈 값. |
| 사용자 화면에서 장소 카테고리 다국어가 안 됨 | DB에 언어별 컬럼이 없고, 사용자 앱도 `code_label` 하나만 사용. `lang`으로 ko/en을 바꿀 데이터와 로직이 없음. |

**결론:**  
“SQL 작업이 덜된 건가”에 대한 답은, **반쯤 맞음**입니다.  
015에서 한/영을 하나로 합친 것은 “의도된 변경”이었을 수 있지만,  
**장소 카테고리를 한국어/영어 따로 관리하고 사용자 앱에서 다국어로 쓰려면**,  
지금 구조(단일 `code_label`만 있는 DB + 단일 `p_code_label`만 받는 RPC + 영어 미저장 admin + 단일 라벨만 쓰는 사용자 앱)로는 불가능하고,  
**DB에 다시 한국어/영어를 구분하는 컬럼(또는 동등한 구조)을 넣고, RPC·admin·사용자 앱을 그에 맞게 고쳐야** 합니다.

---

## 6. 수정 시 필요한 작업 (참고, 작업 지시 아님)

1. **DB**
   - `common_codes` 에 `code_label_ko`, `code_label_en` (또는 `code_label_ko` + `code_label_en` 유지하고 `code_label`은 조회 시 병합) 다시 추가하는 마이그레이션.
   - 기존 `code_label` 값은 예를 들어 `code_label_ko` 로 이전하는 데이터 마이그레이션.
2. **RPC**
   - `admin_save_common_code` 가 `p_code_label_ko`, `p_code_label_en` (또는 동등 파라미터)를 받아서 각 컬럼에 저장하도록 시그니처·본문 수정.
3. **관리자**
   - `saveCommonCode`에서 `code_label_ko`, `code_label_en` 를 각각 RPC로 전달.
   - `getCommonCodes` 응답에 `code_label_ko`, `code_label_en` 이 오면 폼에 그대로 채움 (이미 폼 필드는 있음).
4. **사용자 앱**
   - `getCommonCodes` 로 받은 항목에 대해 `lang === 'ko' ? code_label_ko : code_label_en` (또는 fallback) 로 표시할 라벨을 선택하도록 변경.

이 순서로 진행하면 “설정에서 넣은 한국어/영어가 유지되는지”와 “사용자 화면에서 다국어가 되는지” 둘 다 해결할 수 있습니다.
