-- BrickLink type per object: Big Figs in the price run.
--
-- A figure that BrickLink lists as a part (a Big Fig such as the Rancor of 75005, `P=11323pb01c01`,
-- category "Large Figure") keeps `bricklinkType: "PART"` in its data, and so does a wish for one;
-- nothing in the tables changes for that. A figure without it is a minifig, as before. The price run
-- asks BrickLink for the right type: its queue key for a Big Fig is "PART:11323pb01c01", like the
-- key of a special part is "GEAR:5010325" (migration `20261106120000_special_parts_prices.sql`);
-- the price points carry the same key. A plain number stays a minifig.
--
-- This replaces `price_run_numbers` of that migration with a version that also knows Big Figs, so
-- it holds everything: figures, sets, special parts with a BrickLink type and wishes.
--
-- Written so that it can run twice. Needs the migrations `…_price_run.sql` and
-- `…_special_parts_prices.sql` (the queue must allow the type `specialPart`).

/**
 * The official figures, sets, special parts with a BrickLink type and wishes of an owner with their
 * number (trimmed; empty if missing): what a run asks BrickLink for. Customs and other
 * manufacturers have no market value. A special part's number is "TYPE:number", a Big Fig's (a
 * figure or wish with `bricklinkType` PART) is "PART:number".
 */
create or replace function public.price_run_numbers(p_owner uuid)
returns table (item_type text, number text)
language sql stable security definer set search_path = '' as $$
  select x.item_type, coalesce(btrim(x.number), '')
  from (
    select 'minifig' as item_type,
      case when o.data ->> 'bricklinkType' = 'PART' and btrim(coalesce(o.data ->> 'bricklinkId', '')) <> ''
        then 'PART:' || btrim(o.data ->> 'bricklinkId')
        else o.data ->> 'bricklinkId' end as number,
      o.data as data
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
      case when o.data ->> 'type' = 'minifig' then
        case when o.data ->> 'bricklinkType' = 'PART' and btrim(coalesce(o.data ->> 'bricklinkId', '')) <> ''
          then 'PART:' || btrim(o.data ->> 'bricklinkId')
          else o.data ->> 'bricklinkId' end
        else o.data ->> 'setNumber' end,
      o.data
      from public.wish_items o where o.owner = p_owner
  ) x
  where x.data -> 'manufacturer' ->> 'kind' = 'lego'
    and x.item_type in ('minifig', 'legoSet', 'specialPart');
$$;

-- `create or replace` keeps the rights; nobody but the database itself may call it, as before.
revoke all on function public.price_run_numbers(uuid) from public, anon, authenticated, service_role;
