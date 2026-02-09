-- Add admin functions for place management (bypass RLS)
-- These functions use SECURITY DEFINER to allow admin operations

-- Function to create or update a place (admin only)
CREATE OR REPLACE FUNCTION admin_save_place(
  p_id INTEGER DEFAULT NULL,
  p_name TEXT,
  p_name_en TEXT DEFAULT NULL,
  p_type TEXT,
  p_thumbnail_url TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_lat DECIMAL(10, 8) DEFAULT NULL,
  p_lng DECIMAL(11, 8) DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT true,
  p_region_id TEXT DEFAULT NULL
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
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result RECORD;
BEGIN
  IF p_id IS NOT NULL THEN
    -- Update existing place
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
      updated_at = NOW()
    WHERE id = p_id
    RETURNING * INTO v_result;
    
    RETURN QUERY SELECT
      v_result.id,
      v_result.name,
      v_result.name_en,
      v_result.type,
      v_result.thumbnail_url,
      v_result.description,
      v_result.lat,
      v_result.lng,
      v_result.is_active,
      v_result.region_id,
      v_result.created_at,
      v_result.updated_at;
  ELSE
    -- Create new place
    INSERT INTO places (
      name,
      name_en,
      type,
      thumbnail_url,
      description,
      lat,
      lng,
      is_active,
      region_id
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
      p_region_id
    )
    RETURNING * INTO v_result;
    
    RETURN QUERY SELECT
      v_result.id,
      v_result.name,
      v_result.name_en,
      v_result.type,
      v_result.thumbnail_url,
      v_result.description,
      v_result.lat,
      v_result.lng,
      v_result.is_active,
      v_result.region_id,
      v_result.created_at,
      v_result.updated_at;
  END IF;
END;
$$;

-- Function to delete a place (admin only)
CREATE OR REPLACE FUNCTION admin_delete_place(p_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM places WHERE id = p_id;
  RETURN FOUND;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION admin_save_place IS 'Admin function to create or update a place (bypasses RLS)';
COMMENT ON FUNCTION admin_delete_place IS 'Admin function to delete a place (bypasses RLS)';
