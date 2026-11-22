alter table public.garden_flowers
  add column kept_at timestamptz,
  add column gifted_at timestamptz,
  add constraint garden_flowers_kept_or_gifted_check
    check (kept_at is null or gifted_at is null);

update public.garden_flowers
set kept_at = coalesce(kept_at, created_at)
where stage = 'bloomed';

create table public.flower_gifts (
  id uuid primary key default gen_random_uuid(),
  flower_id uuid not null unique references public.garden_flowers(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text not null check (recipient_email = lower(btrim(recipient_email)) and char_length(recipient_email) <= 254),
  sender_name text not null default 'A friend',
  flower_type text not null check (flower_type in ('daisy', 'sunflower', 'tulip', 'rose', 'lavender')),
  message text not null default '' check (char_length(message) <= 160),
  created_at timestamptz not null default now()
);

alter table public.flower_gifts enable row level security;

create policy "Senders and recipients can view flower gifts"
  on public.flower_gifts for select to authenticated
  using (
    sender_id = auth.uid()
    or lower(recipient_email) = lower((select auth.jwt()->>'email'))
  );

grant select on public.flower_gifts to authenticated;
revoke insert, update, delete on public.flower_gifts from public, anon, authenticated;

create or replace function public.gift_bloomed_flower(
  p_flower_id uuid,
  p_recipient_email text,
  p_message text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_sender_id uuid := auth.uid();
  v_recipient_email text := lower(btrim(coalesce(p_recipient_email, '')));
  v_sender_name text := 'A friend';
  v_flower_type text;
  v_gift_id uuid;
begin
  if v_sender_id is null then
    raise exception 'Sign in before gifting a flower.';
  end if;

  if v_recipient_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
     or char_length(v_recipient_email) > 254 then
    raise exception 'Enter a valid email address.';
  end if;

  if v_recipient_email = lower(coalesce((select auth.jwt()->>'email'), '')) then
    raise exception 'Choose someone else to receive this flower.';
  end if;

  if char_length(coalesce(p_message, '')) > 160 then
    raise exception 'Keep the gift note under 160 characters.';
  end if;

  select f.flower_type
    into v_flower_type
    from public.garden_flowers as f
   where f.id = p_flower_id
     and f.user_id = v_sender_id
     and f.stage = 'bloomed'
     and f.kept_at is null
     and f.gifted_at is null
   for update;

  if not found then
    raise exception 'This flower is not ready to gift.';
  end if;

  select coalesce(
    nullif(p.display_name, ''),
    nullif(u.raw_user_meta_data->>'display_name', ''),
    'A friend'
  )
    into v_sender_name
    from auth.users as u
    left join public.profiles as p on p.id = u.id
   where u.id = v_sender_id;

  insert into public.flower_gifts (
    flower_id, sender_id, recipient_email, sender_name, flower_type, message
  ) values (
    p_flower_id, v_sender_id, v_recipient_email, v_sender_name, v_flower_type, coalesce(p_message, '')
  )
  returning id into v_gift_id;

  update public.garden_flowers
     set gifted_at = now()
   where id = p_flower_id
     and user_id = v_sender_id;

  return v_gift_id;
end;
$function$;

revoke all on function public.gift_bloomed_flower(uuid, text, text) from public, anon;
grant execute on function public.gift_bloomed_flower(uuid, text, text) to authenticated;