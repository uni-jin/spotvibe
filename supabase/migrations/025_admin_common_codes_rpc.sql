-- 공통코드 저장/삭제를 SECURITY DEFINER RPC로 수행 (관리자는 Supabase Auth 미사용 → RLS 우회)
-- 클라이언트는 admin_token 검증 후 이 RPC만 호출

DROP FUNCTION IF EXISTS admin_save_common_code(TEXT, TEXT, TEXT, INTEGER, BOOLEAN, INTEGER);
DROP FUNCTION IF EXISTS admin_delete_common_code(INTEGER);

-- 저장: code_id가 있으면 UPDATE, 없으면 INSERT
CREATE OR REPLACE FUNCTION admin_save_common_code(
  p_code_type TEXT,
  p_code_value TEXT,
  p_code_label TEXT,
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
      code_label = p_code_label,
      display_order = COALESCE(p_display_order, 0),
      is_active = COALESCE(p_is_active, true),
      updated_at = NOW()
    WHERE id = p_id;
    RETURN QUERY SELECT * FROM common_codes WHERE id = p_id;
  ELSE
    RETURN QUERY
    INSERT INTO common_codes (code_type, code_value, code_label, display_order, is_active)
    VALUES (p_code_type, p_code_value, p_code_label, COALESCE(p_display_order, 0), COALESCE(p_is_active, true))
    RETURNING *;
  END IF;
END;
$$;

COMMENT ON FUNCTION admin_save_common_code IS 'Create or update common code. SECURITY DEFINER for admin (no Supabase Auth).';

-- 삭제
CREATE OR REPLACE FUNCTION admin_delete_common_code(p_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM common_codes WHERE id = p_id;
END;
$$;

COMMENT ON FUNCTION admin_delete_common_code IS 'Delete common code by id. SECURITY DEFINER for admin.';
