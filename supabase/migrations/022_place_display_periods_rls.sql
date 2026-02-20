-- place_display_periods RLS: 읽기는 모두 허용, 쓰기(INSERT/UPDATE/DELETE)는 관리자 RPC(admin_save_place)만
-- Supabase 경고 대응: "RLS Disabled in Public"

ALTER TABLE public.place_display_periods ENABLE ROW LEVEL SECURITY;

-- 읽기: 앱(anon)·관리자에서 장소별 노출기간 조회 가능
CREATE POLICY "Allow read place_display_periods"
  ON public.place_display_periods
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 쓰기(INSERT/UPDATE/DELETE)는 정책 없음 → anon/authenticated 불가.
-- 관리자 저장은 RPC admin_save_place(SECURITY DEFINER)에서만 수행.

COMMENT ON TABLE public.place_display_periods IS '장소별 복수 노출기간 (KST). RLS: SELECT만 허용, 쓰기는 admin_save_place만.';
