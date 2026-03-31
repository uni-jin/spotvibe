-- Create place_views table for per-place view tracking (단순 +1 방식)
create table if not exists public.place_views (
  id uuid primary key default gen_random_uuid(),
  -- places.id가 integer 타입이므로 place_id도 integer로 맞춰 줍니다.
  place_id integer not null references public.places(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

-- RLS 비활성화: anon/auth 모두 INSERT/SELECT 가능
alter table public.place_views disable row level security;

-- Aggregated view counts per place
create or replace view public.place_view_stats as
select
  p.id as place_id,
  coalesce(count(v.id), 0) as view_count
from public.places p
left join public.place_views v
  on v.place_id = p.id
group by p.id;

