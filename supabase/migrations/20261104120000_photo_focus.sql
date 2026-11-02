-- The part of a photo that matters (Bildausschnitt).
--
-- Stephan marks a point on a photo (the figure); boxes that fill their area with the photo
-- (tiles, cards, round pictures, thumbnails) show it around that point. The points live in the
-- object's data as `photoFocus`: {"<photo path>": {"x": 0..100, "y": 0..100}}, whole percent from
-- the photo's top left corner, for up to 20 photos. Photos without a point show their middle, and
-- objects saved before this migration have none, so nothing existing changes.
--
-- `save_object` keeps the data as it comes, so only the rule for the new field is added here, as a
-- trigger on the four tables whose objects have photos. It answers like `save_object` does for a
-- malformed object (`invalid_object`) and matches `isPhotoFocusMap` in `src/backend/rules.ts`.

create function public.check_photo_focus()
returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_focus jsonb := new.data -> 'photoFocus';
begin
  if v_focus is null then
    return new;
  end if;
  if jsonb_typeof(v_focus) <> 'object' or (select count(*) from jsonb_object_keys(v_focus)) > 20
    or exists (
      select 1 from jsonb_each(v_focus) e (path, point)
      where length(e.path) not between 1 and 300
        or jsonb_typeof(e.point) <> 'object'
        or (select count(*) from jsonb_object_keys(e.point)) <> 2
        or case when jsonb_typeof(e.point -> 'x') = 'number' then
          case when (e.point ->> 'x')::numeric % 1 = 0 then (e.point ->> 'x')::numeric else -1 end
          else -1 end not between 0 and 100
        or case when jsonb_typeof(e.point -> 'y') = 'number' then
          case when (e.point ->> 'y')::numeric % 1 = 0 then (e.point ->> 'y')::numeric else -1 end
          else -1 end not between 0 and 100
    ) then
    raise exception 'invalid_object' using errcode = '22023';
  end if;
  return new;
end;
$$;

-- Only the triggers call it; nobody calls it through the API.
revoke all on function public.check_photo_focus() from public, anon, authenticated;

create trigger minifigs_photo_focus before insert or update on public.minifigs
  for each row execute function public.check_photo_focus();
create trigger lego_sets_photo_focus before insert or update on public.lego_sets
  for each row execute function public.check_photo_focus();
create trigger special_parts_photo_focus before insert or update on public.special_parts
  for each row execute function public.check_photo_focus();
create trigger dioramas_photo_focus before insert or update on public.dioramas
  for each row execute function public.check_photo_focus();
