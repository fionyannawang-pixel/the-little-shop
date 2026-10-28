create table public.map_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_name text not null check (char_length(btrim(place_name)) between 1 and 100),
  place_kind text not null check (place_kind in ('real', 'imaginary')),
  description text not null default '' check (char_length(description) <= 500),
  created_at timestamptz not null default now()
);

alter table public.map_places enable row level security;

grant select, insert, delete on public.map_places to authenticated;

create policy "Users can read their own map places"
  on public.map_places for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own map places"
  on public.map_places for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own map places"
  on public.map_places for delete to authenticated
  using ((select auth.uid()) = user_id);

create index map_places_user_created_idx
  on public.map_places (user_id, created_at desc);
