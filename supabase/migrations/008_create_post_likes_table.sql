-- Create post_likes table for like functionality
-- This migration creates a table to store user likes on posts

CREATE TABLE IF NOT EXISTS post_likes (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- References auth.users(id)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id) -- Prevent duplicate likes from same user
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_created_at ON post_likes(created_at DESC);

-- Row Level Security (RLS) Policies
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

-- Allow public read access (모든 사용자가 좋아요 개수 확인 가능)
CREATE POLICY "Allow public read access on post_likes" ON post_likes
  FOR SELECT USING (true);

-- Allow authenticated users to insert likes (로그인한 사용자만 좋아요 가능)
CREATE POLICY "Allow authenticated users to insert likes" ON post_likes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow users to delete their own likes (자신의 좋아요만 삭제 가능)
CREATE POLICY "Allow users to delete their own likes" ON post_likes
  FOR DELETE USING (auth.uid()::text = user_id);

-- Function to get like count for a post
CREATE OR REPLACE FUNCTION get_post_like_count(post_id_param INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM post_likes WHERE post_id = post_id_param);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user liked a post
CREATE OR REPLACE FUNCTION is_post_liked_by_user(post_id_param INTEGER, user_id_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM post_likes 
    WHERE post_id = post_id_param AND user_id = user_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
