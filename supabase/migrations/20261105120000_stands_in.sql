-- "Steht in": a figure can be displayed in one of the own sets instead of a diorama.
--
-- The place lives in the figure's data: `dioramaId` (a diorama) or the new `standsInSetId` (an own
-- set), never both. Nothing in the tables changes, so figures saved before this migration are
-- fine. Two rules are added, as triggers like `check_photo_focus` (they work for `save_object`
-- and for every other way into the table), and they match `isPlace` in `src/backend/rules.ts`:
--
--   1. `standsInSetId` is a text of 1 to 100 characters, and the figure has no `dioramaId` then.
--   2. Deleting a set takes the figures out of it again: `standsInSetId` is removed from the
--      figures that stood in it. The figures stay in the collection.

create or replace function public.check_minifig_place()
returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.data -> 'standsInSetId' is not null then
    if jsonb_typeof(new.data -> 'standsInSetId') <> 'string'
      or length(new.data ->> 'standsInSetId') not between 1 and 100
      or coalesce(jsonb_typeof(new.data -> 'dioramaId'), 'null') <> 'null' then
      raise exception 'invalid_object' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.release_figures_of_set()
returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  update public.minifigs m
    set data = m.data - 'standsInSetId', updated_at = now()
    where m.owner = old.owner and m.data ->> 'standsInSetId' = old.id;
  return old;
end;
$$;

-- Only the triggers call them; nobody calls them through the API.
revoke all on function public.check_minifig_place() from public, anon, authenticated;
revoke all on function public.release_figures_of_set() from public, anon, authenticated;

create or replace trigger minifigs_place before insert or update on public.minifigs
  for each row execute function public.check_minifig_place();
create or replace trigger lego_sets_release_figures after delete on public.lego_sets
  for each row execute function public.release_figures_of_set();
