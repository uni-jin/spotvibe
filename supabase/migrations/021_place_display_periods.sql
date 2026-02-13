-- 복수 노출기간: 장소당 여러 개의 노출 구간 지원 (팝업 스토어 등)
-- place_display_periods에 구간 저장, places.display_start_date/display_end_date는 첫 구간과 동기화(호환용)

CREATE TABLE IF NOT EXISTS place_display_periods (
  id SERIAL PRIMARY KEY,
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  display_start_date TIMESTAMP WITHOUT TIME ZONE,
  display_end_date TIMESTAMP WITHOUT TIME ZONE,
  display_order SMALLINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_place_display_periods_place_id ON place_display_periods(place_id);

COMMENT ON TABLE place_display_periods IS '장소별 복수 노출기간 (KST). 정렬은 display_order 기준.';

-- 기존 단일 노출기간 데이터 이전
INSERT INTO place_display_periods (place_id, display_start_date, display_end_date, display_order)
SELECT id, display_start_date, display_end_date, 0
FROM places
WHERE display_start_date IS NOT NULL OR display_end_date IS NOT NULL;

-- admin_save_place: p_display_periods(JSONB) 추가. 형식: [{"start":"YYYY-MM-DD HH:mm:ss","end":"..."}, ...]
-- p_display_periods가 있으면 해당 구간들로 place_display_periods 갱신, 첫 구간을 places에 반영
DROP FUNCTION IF EXISTS admin_save_place(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, BOOLEAN, TEXT, TIMESTAMP WITHOUT TIME ZONE, TIMESTAMP WITHOUT TIME ZONE) CASCADE;
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
  p_display_end_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL,
  p_display_periods JSONB DEFAULT '[]'
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
      places.created_at,
      places.updated_at
    FROM places
    WHERE places.id = v_place_id;
  ELSE
    INSERT INTO places (
      name, name_en, type, thumbnail_url, description,
      lat, lng, is_active, region_id,
      display_start_date, display_end_date
    )
    VALUES (
      p_name, p_name_en, p_type, p_thumbnail_url, p_description,
      p_lat, p_lng, p_is_active, p_region_id,
      v_first_start, v_first_end
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
      places.created_at,
      places.updated_at
    FROM places
    WHERE places.id = v_place_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION admin_save_place IS 'Create or update place. p_display_periods: [{"start":"...","end":"..."}]. First period synced to places.display_start_date/display_end_date.';
