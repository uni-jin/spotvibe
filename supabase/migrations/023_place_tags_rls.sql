-- place_tags, place_tag_mappings RLS: 읽기만 허용, 쓰기는 백엔드/마이그레이션만
-- Supabase 경고 대응: "RLS Disabled in Public"

-- place_tags (태그 마스터)
ALTER TABLE public.place_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read place_tags"
  ON public.place_tags
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- place_tag_mappings (장소-태그 매핑)
ALTER TABLE public.place_tag_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read place_tag_mappings"
  ON public.place_tag_mappings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT/UPDATE/DELETE 정책 없음 → 클라이언트 직접 쓰기 불가
