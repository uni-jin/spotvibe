-- 장소 카테고리 등 공통코드 한국어/영어 라벨 분리 (다국어 저장·표시 복구)
-- 015에서 단일 code_label로 합쳤던 것을 다시 code_label_ko, code_label_en으로 복구

-- 1. 한국어/영어 컬럼 추가
ALTER TABLE common_codes
  ADD COLUMN IF NOT EXISTS code_label_ko TEXT,
  ADD COLUMN IF NOT EXISTS code_label_en TEXT;

-- 2. 기존 code_label 값을 두 컬럼에 이전 (기존 데이터는 동일 값으로)
UPDATE common_codes
SET
  code_label_ko = COALESCE(NULLIF(TRIM(code_label), ''), code_value),
  code_label_en = COALESCE(NULLIF(TRIM(code_label), ''), code_value)
WHERE code_label_ko IS NULL OR code_label_en IS NULL;

-- 3. NOT NULL 및 기본값
ALTER TABLE common_codes
  ALTER COLUMN code_label_ko SET NOT NULL,
  ALTER COLUMN code_label_en SET DEFAULT '';

UPDATE common_codes SET code_label_en = '' WHERE code_label_en IS NULL;
ALTER TABLE common_codes ALTER COLUMN code_label_en SET NOT NULL;

-- 4. 기존 단일 컬럼 제거
ALTER TABLE common_codes DROP COLUMN IF EXISTS code_label;

COMMENT ON COLUMN common_codes.code_label_ko IS 'Korean display label for the code.';
COMMENT ON COLUMN common_codes.code_label_en IS 'English display label for the code.';
