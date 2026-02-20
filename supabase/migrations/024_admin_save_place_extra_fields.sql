-- admin_save_place에 info_url, phone, hashtags 추가 → RLS로 막힌 클라이언트 UPDATE 제거
-- 저장은 RPC(SECURITY DEFINER)에서만 수행

DROP FUNCTION IF EXISTS admin_save_place(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, BOOLEAN, TEXT, TIMESTAMP WITHOUT TIME ZONE, TIMESTAMP WITHOUT TIME ZONE, JSONB) CASCADE;

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
  p_display_end_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL,
  p_display_periods JSONB DEFAULT '[]',
  p_info_url TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_hashtags TEXT[] DEFAULT NULL
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
  info_url TEXT,
  phone TEXT,
  hashtags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place_id INTEGER;
  v_first_start TIMESTAMP WITHOUT TIME ZONE;
  v_first_end TIMESTAMP WITHOUT TIME ZONE;
  v_periods_len INTEGER;
BEGIN
  v_periods_len := COALESCE(jsonb_array_length(p_display_periods), 0);

  IF v_periods_len > 0 THEN
    v_first_start := (p_display_periods->0->>'start')::TIMESTAMP WITHOUT TIME ZONE;
    v_first_end := (p_display_periods->0->>'end')::TIMESTAMP WITHOUT TIME ZONE;
  ELSE
    v_first_start := p_display_start_date;
    v_first_end := p_display_end_date;
  END IF;

  IF p_id IS NOT NULL THEN
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
      display_start_date = v_first_start,
      display_end_date = v_first_end,
      info_url = p_info_url,
      phone = p_phone,
      hashtags = p_hashtags,
      updated_at = NOW()
    WHERE places.id = p_id;

    v_place_id := p_id;

    DELETE FROM place_display_periods WHERE place_id = v_place_id;
    IF v_periods_len > 0 THEN
      INSERT INTO place_display_periods (place_id, display_start_date, display_end_date, display_order)
      SELECT
        v_place_id,
        (elem->>'start')::TIMESTAMP WITHOUT TIME ZONE,
        (elem->>'end')::TIMESTAMP WITHOUT TIME ZONE,
        (ord - 1)::SMALLINT
      FROM jsonb_array_elements(p_display_periods) WITH ORDINALITY AS t(elem, ord);
    END IF;

    RETURN QUERY
    SELECT
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
      places.info_url,
      places.phone,
      places.hashtags,
      places.created_at,
      places.updated_at
    FROM places
    WHERE places.id = v_place_id;
  ELSE
    INSERT INTO places (
      name, name_en, type, thumbnail_url, description,
      lat, lng, is_active, region_id,
      display_start_date, display_end_date,
      info_url, phone, hashtags
    )
    VALUES (
      p_name, p_name_en, p_type, p_thumbnail_url, p_description,
      p_lat, p_lng, p_is_active, p_region_id,
      v_first_start, v_first_end,
      p_info_url, p_phone, p_hashtags
    )
    RETURNING places.id INTO v_place_id;

    IF v_periods_len > 0 THEN
      INSERT INTO place_display_periods (place_id, display_start_date, display_end_date, display_order)
      SELECT
        v_place_id,
        (elem->>'start')::TIMESTAMP WITHOUT TIME ZONE,
        (elem->>'end')::TIMESTAMP WITHOUT TIME ZONE,
        (ord - 1)::SMALLINT
      FROM jsonb_array_elements(p_display_periods) WITH ORDINALITY AS t(elem, ord);
    END IF;

    RETURN QUERY
    SELECT
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
      places.info_url,
      places.phone,
      places.hashtags,
      places.created_at,
      places.updated_at
    FROM places
    WHERE places.id = v_place_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION admin_save_place IS 'Create or update place. Includes info_url, phone, hashtags, display_periods. SECURITY DEFINER.';
