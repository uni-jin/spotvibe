-- SpotVibe Database Schema
-- This migration creates the initial database structure for SpotVibe

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Regions table (지역 정보)
CREATE TABLE IF NOT EXISTS regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Places table (Hot Spots - 관리자 등록 장소)
CREATE TABLE IF NOT EXISTS places (
  id SERIAL PRIMARY KEY,
  region_id TEXT REFERENCES regions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  name_en TEXT,
  status TEXT,
  wait_time TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Posts table (제보 데이터)
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  place_id INTEGER REFERENCES places(id) ON DELETE SET NULL,
  place_name TEXT NOT NULL, -- 장소명 (사용자가 직접 입력할 수도 있음)
  vibe TEXT NOT NULL CHECK (vibe IN ('verybusy', 'busy', 'nowait', 'quiet', 'soldout')),
  user_id TEXT, -- 나중에 auth.users와 연결할 수 있음
  metadata JSONB, -- GPS 좌표, 촬영 시간 등 메타데이터
  main_image_url TEXT, -- 메인 이미지 URL
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Post Images table (포스트 이미지들 - 메인 + 추가 이미지)
CREATE TABLE IF NOT EXISTS post_images (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_main BOOLEAN DEFAULT false, -- 메인 이미지 여부
  captured_at TIMESTAMP WITH TIME ZONE, -- 촬영 시간
  image_order INTEGER DEFAULT 0, -- 이미지 순서
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_posts_place_id ON posts(place_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_vibe ON posts(vibe);
CREATE INDEX IF NOT EXISTS idx_post_images_post_id ON post_images(post_id);
CREATE INDEX IF NOT EXISTS idx_places_region_id ON places(region_id);
CREATE INDEX IF NOT EXISTS idx_posts_metadata_gin ON posts USING GIN(metadata);

-- Row Level Security (RLS) Policies
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_images ENABLE ROW LEVEL SECURITY;

-- Allow public read access (모든 사용자가 읽기 가능)
CREATE POLICY "Allow public read access on regions" ON regions
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access on places" ON places
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access on posts" ON posts
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access on post_images" ON post_images
  FOR SELECT USING (true);

-- Allow public insert access (모든 사용자가 제보 작성 가능)
CREATE POLICY "Allow public insert on posts" ON posts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public insert on post_images" ON post_images
  FOR INSERT WITH CHECK (true);

-- Functions for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_regions_updated_at BEFORE UPDATE ON regions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_places_updated_at BEFORE UPDATE ON places
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
