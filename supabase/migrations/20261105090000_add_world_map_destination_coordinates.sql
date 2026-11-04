alter table public.world_map_destinations
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'world_map_destinations_coordinates_check'
      and conrelid = 'public.world_map_destinations'::regclass
  ) then
    alter table public.world_map_destinations
      add constraint world_map_destinations_coordinates_check
      check (
        (latitude is null and longitude is null)
        or (
          latitude between -90 and 90
          and longitude between -180 and 180
        )
      );
  end if;
end $$;