create table public.my_map_country_pieces (
  user_id uuid not null references auth.users(id) on delete cascade,
  country_code text not null check (char_length(country_code) = 3),
  country_name text not null check (char_length(btrim(country_name)) between 1 and 100),
  fill_color text not null check (fill_color ~ '^#[0-9A-Fa-f]{6}$'),
  updated_at timestamptz not null default now(),
  primary key (user_id, country_code)
);

alter table public.my_map_country_pieces enable row level security;

grant select, insert, update, delete on public.my_map_country_pieces to authenticated;

create policy "Users can read their own map pieces"
  on public.my_map_country_pieces for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can paint their own map pieces"
  on public.my_map_country_pieces for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own map pieces"
  on public.my_map_country_pieces for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can clear their own map pieces"
  on public.my_map_country_pieces for delete to authenticated
  using ((select auth.uid()) = user_id);

create table public.world_map_destinations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  destination_name text not null check (char_length(btrim(destination_name)) between 1 and 120),
  address text not null check (char_length(btrim(address)) between 1 and 300),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);

alter table public.world_map_destinations enable row level security;

grant select, insert, delete on public.world_map_destinations to authenticated;

create policy "Users can read their own world map destinations"
  on public.world_map_destinations for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own world map destinations"
  on public.world_map_destinations for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can remove their own world map destinations"
  on public.world_map_destinations for delete to authenticated
  using ((select auth.uid()) = user_id);

create index world_map_destinations_user_created_idx
  on public.world_map_destinations (user_id, created_at desc);
