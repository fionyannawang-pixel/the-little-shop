create table public.my_map_shapes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shape_name text not null check (char_length(btrim(shape_name)) between 1 and 60),
  fill_color text not null check (fill_color ~ '^#[0-9A-Fa-f]{6}$'),
  points jsonb not null check (
    case
      when jsonb_typeof(points) = 'array'
      then jsonb_array_length(points) between 3 and 250
      else false
    end
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index my_map_shapes_user_created_idx
  on public.my_map_shapes (user_id, created_at, id);

alter table public.my_map_shapes enable row level security;

create policy "Users can read their own map shapes"
  on public.my_map_shapes for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own map shapes"
  on public.my_map_shapes for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own map shapes"
  on public.my_map_shapes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own map shapes"
  on public.my_map_shapes for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.my_map_shapes from anon;
grant select, insert, update, delete on table public.my_map_shapes to authenticated;
