-- Store display period as Korean time (no timezone conversion)
-- 관리자가 입력한 일시를 한국 시간 그대로 저장

-- Convert existing UTC values to KST for storage (so existing data shows as intended)
ALTER TABLE places
  ALTER COLUMN display_start_date TYPE TIMESTAMP WITHOUT TIME ZONE
  USING (CASE WHEN display_start_date IS NOT NULL THEN (display_start_date AT TIME ZONE 'Asia/Seoul')::timestamp ELSE NULL END),
  ALTER COLUMN display_end_date TYPE TIMESTAMP WITHOUT TIME ZONE
  USING (CASE WHEN display_end_date IS NOT NULL THEN (display_end_date AT TIME ZONE 'Asia/Seoul')::timestamp ELSE NULL END);

COMMENT ON COLUMN places.display_start_date IS '노출 시작 일시 (한국 시간, KST 그대로 저장)';
COMMENT ON COLUMN places.display_end_date IS '노출 종료 일시 (한국 시간, KST 그대로 저장)';

-- Recreate admin_save_place to use timestamp without time zone
DROP FUNCTION IF EXISTS admin_save_place(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, BOOLEAN, TEXT, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) CASCADE;
DROP FUNCTION IF EXISTS admin_save_place CASCADE;

CREATE OR REPLACE FUNCTION admin_save_place(
  p_name TEXT,
  p_type TEXT,
  p_id INTEGER DEFAULT NULL,
  p_name_en TEXT DEFAULT NULL,
  p_thumbnail_url TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_lat DECIMAL(10, 8) DEFAULT NULL,
  p_lng DECIMAL(11, 8) DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT true,
  p_region_id TEXT DEFAULT NULL,
  p_display_start_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL,
  p_display_end_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  name_en TEXT,
  type TEXT,
  thumbnail_url TEXT,
  description TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  is_active BOOLEAN,
  region_id TEXT,
  display_start_date TIMESTAMP WITHOUT TIME ZONE,
  display_end_date TIMESTAMP WITHOUT TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_id IS NOT NULL THEN
    RETURN QUERY
    UPDATE places
    SET
      name = p_name,
      name_en = p_name_en,
      type = p_type,
      thumbnail_url = p_thumbnail_url,
      description = p_description,
      lat = p_lat,
      lng = p_lng,
      is_active = p_is_active,
      region_id = p_region_id,
      display_start_date = p_display_start_date,
      display_end_date = p_display_end_date,
      updated_at = NOW()
    WHERE places.id = p_id
    RETURNING
      places.id,
      places.name,
      places.name_en,
      places.type,
      places.thumbnail_url,
      places.description,
      places.lat,
      places.lng,
      places.is_active,
      places.region_id,
      places.display_start_date,
      places.display_end_date,
      places.created_at,
      places.updated_at;
  ELSE
    RETURN QUERY
    INSERT INTO places (
      name,
      name_en,
      type,
      thumbnail_url,
      description,
      lat,
      lng,
      is_active,
      region_id,
      display_start_date,
      display_end_date
    )
    VALUES (
      p_name,
      p_name_en,
      p_type,
      p_thumbnail_url,
      p_description,
      p_lat,
      p_lng,
      p_is_active,
      p_region_id,
      p_display_start_date,
      p_display_end_date
    )
    RETURNING
      places.id,
      places.name,
      places.name_en,
      places.type,
      places.thumbnail_url,
      places.description,
      places.lat,
      places.lng,
      places.is_active,
      places.region_id,
      places.display_start_date,
      places.display_end_date,
      places.created_at,
      places.updated_at;
  END IF;
END;
$$;

COMMENT ON FUNCTION admin_save_place IS 'Admin function to create or update a place. display_start_date/display_end_date are stored in KST.';
