alter table public.garden_flowers
  add column flower_type text not null default 'daisy'
    check (flower_type in ('daisy', 'sunflower', 'tulip', 'rose', 'lavender')),
  add column stage text not null default 'bloomed'
    check (stage in ('seedling', 'bloomed')),
  add column bloomed_at timestamptz;

update public.garden_flowers
set bloomed_at = coalesce(bloomed_at, created_at)
where stage = 'bloomed';

alter table public.garden_flowers
  alter column stage set default 'seedling',
  alter column flower_emoji set default '🌼';

create policy "Users can update their own garden flowers"
  on public.garden_flowers for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant update on public.garden_flowers to authenticated;