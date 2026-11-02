-- Special parts with a BrickLink number in the price run.
--
-- A special part (GWP, Insiders reward, coin) that was taken from the BrickLink catalog keeps its
-- BrickLink type (`bricklinkType`: GEAR, SET or BOOK) and its number (`number`) in its data; nothing
-- in the tables changes for that. The price run now asks BrickLink for these too. Its queue key for
-- a special part is the type and the number in one text, "GEAR:5010325", so that the Edge Function
-- knows which kind of item to ask for, and the price points carry the same key (`item_type`
-- 'specialPart', which `price_points` has allowed from the start).
--
-- Special parts without a BrickLink type keep their own value or purchase price; they are not
-- asked for and not counted as skipped. Only official LEGO ones are asked for, like figures and sets.
--
-- Written so that it can run twice. Needs the P11 migration (`price_run`).

-- The queue takes the new item type. The constraint is looked up by its definition, not by name.
do $$
declare
  v_name text;
begin
  for v_name in
    select c.conname from pg_constraint c
    where c.conrelid = 'public.price_run_items'::regclass and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%item_type%'
  loop
    execute format('alter table public.price_run_items drop constraint %I', v_name);
  end loop;
  execute 'alter table public.price_run_items add constraint price_run_items_item_type_check '
    'check (item_type in (''minifig'', ''legoSet'', ''specialPart''))';
end;
$$;

/**
 * The official figures, sets, special parts with a BrickLink type and wishes of an owner with their
 * number (trimmed; empty if missing): what a run asks BrickLink for. Customs and other
 * manufacturers have no market value. A special part's number is "TYPE:number".
 */
create or replace function public.price_run_numbers(p_owner uuid)
returns table (item_type text, number text)
language sql stable security definer set search_path = '' as $$
  select x.item_type, coalesce(btrim(x.number), '')
  from (
    select 'minifig' as item_type, o.data ->> 'bricklinkId' as number, o.data as data
      from public.minifigs o where o.owner = p_owner
    union all
    select 'legoSet', o.data ->> 'setNumber', o.data
      from public.lego_sets o where o.owner = p_owner
    union all
    select 'specialPart', (o.data ->> 'bricklinkType') || ':' || btrim(o.data ->> 'number'), o.data
      from public.special_parts o
      where o.owner = p_owner
        and o.data ->> 'bricklinkType' in ('GEAR', 'SET', 'BOOK')
        and btrim(coalesce(o.data ->> 'number', '')) <> ''
    union all
    select o.data ->> 'type',
      case when o.data ->> 'type' = 'minifig' then o.data ->> 'bricklinkId'
        else o.data ->> 'setNumber' end,
      o.data
      from public.wish_items o where o.owner = p_owner
  ) x
  where x.data -> 'manufacturer' ->> 'kind' = 'lego'
    and x.item_type in ('minifig', 'legoSet', 'specialPart');
$$;

/** Monday's job: a run for everyone with a collection, then the first call. */
create or replace function public.price_run_weekly()
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.price_run_begin(o.owner, 'schedule')
  from (
    select m.owner from public.minifigs m
    union select s.owner from public.lego_sets s
    union select p.owner from public.special_parts p
    union select w.owner from public.wish_items w
  ) o;
  perform public.price_run_call();
end;
$$;

-- `create or replace` keeps the rights of both functions; nobody but the database itself may call
-- them, as before.
revoke all on function public.price_run_numbers(uuid) from public, anon, authenticated, service_role;
