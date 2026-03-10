# 공통코드 한국어/영어 라벨 복구 — SQL 적용 방법

아래 마이그레이션을 **Supabase 프로젝트에 반영**해야 관리자 설정의 코드명(한국어/영어) 저장·사용자 화면 다국어가 동작합니다.

## 1. 적용할 파일 (순서대로)

1. **`supabase/migrations/027_common_codes_ko_en_labels.sql`**  
   - `common_codes` 테이블에 `code_label_ko`, `code_label_en` 컬럼 추가  
   - 기존 `code_label` 값을 두 컬럼으로 이전 후 `code_label` 컬럼 제거  

2. **`supabase/migrations/028_admin_save_common_code_ko_en.sql`**  
   - `admin_save_common_code` RPC를 `p_code_label_ko`, `p_code_label_en` 인자로 저장하도록 변경  

## 2. 적용 방법 (택 1)

### A. Supabase CLI로 마이그레이션 실행 (권장)

```bash
cd /d/spotvibe   # 프로젝트 루트
npx supabase db push
```

또는 이미 리모트 DB에 연결돼 있다면:

```bash
npx supabase migration up
```

### B. Supabase 대시보드에서 수동 실행

1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 선택 → **SQL Editor** 이동  
2. **027_common_codes_ko_en_labels.sql** 내용 전체 복사 후 실행  
3. **028_admin_save_common_code_ko_en.sql** 내용 전체 복사 후 실행  

실행 순서를 바꾸면 안 됩니다. 반드시 027 → 028 순서로 실행하세요.

## 3. 적용 후 확인

- **관리자**: 설정 → 장소 카테고리에서 코드명(한국어)·코드명(영어) 입력 후 저장하고, 다시 들어가도 두 값이 유지되는지 확인  
- **사용자 앱**: KO/EN 전환 시 카테고리 탭·Post Vibe 모달 등에서 라벨이 언어에 맞게 바뀌는지 확인  

## 4. 이미 마이그레이션을 수동으로 돌린 경우

CLI로 `supabase db push`를 쓰는 경우, 위 두 파일이 `supabase/migrations/`에 있으면 자동으로 적용 대상에 포함됩니다.  
이미 대시보드에서 027·028 내용을 수동 실행했다면, 해당 마이그레이션을 “적용됨”으로 기록해 두지 않는 한 CLI가 다시 실행하려 할 수 있으므로, 필요하면 로컬에서 해당 마이그레이션 파일을 제거하거나 Supabase 문서에 따라 “기록만 추가”하는 방식으로 정리하세요.
