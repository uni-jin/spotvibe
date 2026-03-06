-- User place picks: 사용자가 Pick한 장소 저장
-- auth.users(id)는 UUID, post_likes 등에서는 user_id TEXT로 저장하므로 TEXT 사용
CREATE TABLE IF NOT EXISTS user_place_picks (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_user_place_picks_user_id ON user_place_picks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_place_picks_place_id ON user_place_picks(place_id);

COMMENT ON TABLE user_place_picks IS '사용자가 Pick한 장소 (Discover/상세에서 저장)';

-- RLS: 본인만 자신의 픽 조회/추가/삭제
ALTER TABLE user_place_picks ENABLE ROW LEVEL SECURITY;

-- 로그인 사용자: 본인 픽만 SELECT
CREATE POLICY "Users can read own picks"
  ON user_place_picks FOR SELECT
  USING (auth.uid()::text = user_id);

-- 로그인 사용자: 본인 픽만 INSERT
CREATE POLICY "Users can insert own picks"
  ON user_place_picks FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- 로그인 사용자: 본인 픽만 DELETE
CREATE POLICY "Users can delete own picks"
  ON user_place_picks FOR DELETE
  USING (auth.uid()::text = user_id);
