-- Profiles table (사용자 프로필)
-- auth.users와 1:1 관계로 사용자 추가 정보를 저장

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  -- 통계 정보 (성능 최적화를 위해 캐싱)
  posts_count INTEGER DEFAULT 0,
  places_visited_count INTEGER DEFAULT 0,
  -- 설정
  notification_enabled BOOLEAN DEFAULT true,
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update profile stats on insert
CREATE OR REPLACE FUNCTION public.update_user_stats_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Update posts count
  UPDATE profiles
  SET posts_count = (
    SELECT COUNT(*) FROM posts WHERE user_id = NEW.user_id
  ),
  places_visited_count = (
    SELECT COUNT(DISTINCT place_id) FROM posts WHERE user_id = NEW.user_id AND place_id IS NOT NULL
  ),
  updated_at = NOW()
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update profile stats on delete
CREATE OR REPLACE FUNCTION public.update_user_stats_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Update posts count
  UPDATE profiles
  SET posts_count = (
    SELECT COUNT(*) FROM posts WHERE user_id = OLD.user_id
  ),
  places_visited_count = (
    SELECT COUNT(DISTINCT place_id) FROM posts WHERE user_id = OLD.user_id AND place_id IS NOT NULL
  ),
  updated_at = NOW()
  WHERE id = OLD.user_id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stats when post is created
CREATE TRIGGER update_profile_stats_on_post_insert
  AFTER INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION public.update_user_stats_on_insert();

-- Trigger to update stats when post is deleted
CREATE TRIGGER update_profile_stats_on_post_delete
  AFTER DELETE ON posts
  FOR EACH ROW EXECUTE FUNCTION public.update_user_stats_on_delete();

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read all profiles (for public profile viewing)
CREATE POLICY "Allow public read access on profiles" ON profiles
  FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "Allow users to update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile (fallback)
CREATE POLICY "Allow users to insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Function to sync profile with auth.users metadata
CREATE OR REPLACE FUNCTION public.sync_profile_from_auth()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET 
    email = NEW.email,
    full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', full_name),
    avatar_url = COALESCE(NEW.raw_user_meta_data->>'avatar_url', avatar_url),
    updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync profile when auth.users is updated
CREATE TRIGGER sync_profile_on_auth_update
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_from_auth();

-- Update trigger for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
