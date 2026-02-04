-- Fix UUID and TEXT type mismatch in profile stats update functions
-- This migration fixes the "operator does not exist: uuid = text" error
-- by casting UUID to TEXT in the WHERE clause (profiles.id is UUID, posts.user_id is TEXT)

-- Fix update_user_stats_on_insert function
CREATE OR REPLACE FUNCTION public.update_user_stats_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if user_id is not null
  IF NEW.user_id IS NOT NULL THEN
    UPDATE profiles
    SET posts_count = (
      SELECT COUNT(*) FROM posts WHERE user_id = NEW.user_id
    ),
    places_visited_count = (
      SELECT COUNT(DISTINCT place_id) FROM posts WHERE user_id = NEW.user_id AND place_id IS NOT NULL
    ),
    updated_at = NOW()
    WHERE id::text = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix update_user_stats_on_delete function
CREATE OR REPLACE FUNCTION public.update_user_stats_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if user_id is not null
  IF OLD.user_id IS NOT NULL THEN
    UPDATE profiles
    SET posts_count = (
      SELECT COUNT(*) FROM posts WHERE user_id = OLD.user_id
    ),
    places_visited_count = (
      SELECT COUNT(DISTINCT place_id) FROM posts WHERE user_id = OLD.user_id AND place_id IS NOT NULL
    ),
    updated_at = NOW()
    WHERE id::text = OLD.user_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
