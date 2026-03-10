-- admin_save_common_code: 단일 p_code_label 대신 p_code_label_ko, p_code_label_en 사용

DROP FUNCTION IF EXISTS admin_save_common_code(TEXT, TEXT, TEXT, INTEGER, BOOLEAN, INTEGER);

CREATE OR REPLACE FUNCTION admin_save_common_code(
  p_code_type TEXT,
  p_code_value TEXT,
  p_code_label_ko TEXT,
  p_code_label_en TEXT DEFAULT '',
  p_display_order INTEGER DEFAULT 0,
  p_is_active BOOLEAN DEFAULT true,
  p_id INTEGER DEFAULT NULL
)
RETURNS SETOF common_codes
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE common_codes
    SET
      code_type = p_code_type,
      code_value = p_code_value,
      code_label_ko = COALESCE(NULLIF(TRIM(p_code_label_ko), ''), code_value),
      code_label_en = COALESCE(NULLIF(TRIM(p_code_label_en), ''), NULLIF(TRIM(p_code_label_ko), ''), code_value),
      display_order = COALESCE(p_display_order, 0),
      is_active = COALESCE(p_is_active, true),
      updated_at = NOW()
    WHERE id = p_id;
    RETURN QUERY SELECT * FROM common_codes WHERE id = p_id;
  ELSE
    RETURN QUERY
    INSERT INTO common_codes (code_type, code_value, code_label_ko, code_label_en, display_order, is_active)
    VALUES (
      p_code_type,
      p_code_value,
      COALESCE(NULLIF(TRIM(p_code_label_ko), ''), p_code_value),
      COALESCE(NULLIF(TRIM(p_code_label_en), ''), COALESCE(NULLIF(TRIM(p_code_label_ko), ''), p_code_value)),
      COALESCE(p_display_order, 0),
      COALESCE(p_is_active, true)
    )
    RETURNING *;
  END IF;
END;
$$;

COMMENT ON FUNCTION admin_save_common_code IS 'Create or update common code (ko/en labels). SECURITY DEFINER for admin.';
