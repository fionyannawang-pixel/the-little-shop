create table if not exists public.garden_flowers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bloom_date date not null,
  flower_emoji text not null check (flower_emoji in ('🌷', '🌼', '🌻', '🌸', '🪻', '🌹')),
  meaning text not null check (char_length(btrim(meaning)) between 1 and 250),
  created_at timestamptz not null default now(),
  constraint garden_flowers_user_bloom_date_key unique (user_id, bloom_date)
);

alter table public.garden_flowers enable row level security;

create policy "Users can view their own garden flowers"
  on public.garden_flowers for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can grow flowers in their own garden"
  on public.garden_flowers for insert to authenticated
  with check (auth.uid() = user_id);

grant select, insert on public.garden_flowers to authenticated;