-- Why a price run item failed.
--
-- When BrickLink does not give a price for an item, the run only said "failed" and the number.
-- Now the Edge Function passes a short reason (BrickLink's code and message, at most 200 characters,
-- never a key or a signature) when it finishes an item as failed. It is kept with the item
-- (`price_run_items.reason`), copied to the run when the run is settled
-- (`price_runs.failed_reasons`, number → reason, at most 20 like `failed_numbers`) and answered by
-- `price_run_status` as `failedReasons`, so that the settings can show it next to the number.
--
-- `price_run_finish` gets a seventh parameter, `p_reason`, with a default. The old function with six
-- parameters is dropped first, so that a call with six named parameters does not meet two
-- functions. The Edge Function works with or without this migration (it finishes an item without
-- the reason where `p_reason` is unknown), so it does not matter which comes first.
--
-- Written so that it can run twice. Needs the P11 migration (`price_run`).

alter table public.price_run_items add column if not exists reason text
  check (reason is null or length(reason) <= 200);

alter table public.price_runs add column if not exists failed_reasons jsonb not null default '{}'
  check (jsonb_typeof(failed_reasons) = 'object');

drop function if exists public.price_run_finish(bigint, text, text, text, jsonb, jsonb);

/**
 * The result for one item: `priced` writes the price point (`p_cents`, optionally `p_sold`) with the
 * run's day for the run's owner, replacing one of that day; `empty` (nothing sold) and `failed`
 * write nothing, so an older value stays (F10); `retry` puts the item back into the queue. A failed
 * item keeps `p_reason` (cut to 200 characters).
 */
create or replace function public.price_run_finish(
  p_run bigint,
  p_item_type text,
  p_bricklink_id text,
  p_outcome text,
  p_cents jsonb default null,
  p_sold jsonb default null,
  p_reason text default null
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_day date;
  v_point jsonb;
begin
  if p_outcome is null or p_outcome not in ('priced', 'empty', 'failed', 'retry')
    or (p_outcome = 'priced' and not coalesce(public.price_run_is_pair(p_cents), false))
    or (p_sold is not null and not coalesce(public.price_run_is_pair(p_sold), false)) then
    raise exception 'invalid_object' using errcode = '22023';
  end if;
  select r.owner, r.day into v_owner, v_day from public.price_runs r
    where r.id = p_run for update;
  if v_owner is null or not exists (
    select 1 from public.price_run_items i
    where i.run_id = p_run and i.item_type = p_item_type and i.bricklink_id = p_bricklink_id
  ) then
    raise exception 'not_found' using errcode = '22023';
  end if;

  if p_outcome = 'priced' then
    v_point := jsonb_build_object(
      'itemType', p_item_type,
      'bricklinkId', p_bricklink_id,
      'date', to_char(v_day, 'YYYY-MM-DD'),
      'source', 'bricklink',
      'cents', p_cents
    );
    if p_sold is not null then
      v_point := v_point || jsonb_build_object('soldCount', p_sold);
    end if;
    insert into public.price_points (owner, item_type, bricklink_id, date, data)
      values (v_owner, p_item_type, p_bricklink_id, v_day, v_point)
    on conflict (owner, item_type, bricklink_id, date) do update set data = excluded.data;
  end if;

  update public.price_run_items i
    set state = case p_outcome when 'retry' then 'open' else p_outcome end,
      claimed_at = null,
      reason = case when p_outcome = 'failed' then left(nullif(btrim(p_reason), ''), 200) else null end
    where i.run_id = p_run and i.item_type = p_item_type and i.bricklink_id = p_bricklink_id;
  perform public.price_run_settle(p_run);
end;
$$;

/** Closes a run whose items are all done and writes its result; nothing if items are left. */
create or replace function public.price_run_settle(p_run bigint)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.price_runs r
    set finished_at = now(),
      paused_until = null,
      updated = (select count(*) from public.price_run_items i
        where i.run_id = r.id and i.state = 'priced'),
      empty = (select count(*) from public.price_run_items i
        where i.run_id = r.id and i.state = 'empty'),
      failed = (select count(*) from public.price_run_items i
        where i.run_id = r.id and i.state = 'failed'),
      failed_numbers = coalesce((
        select jsonb_agg(f.bricklink_id order by f.bricklink_id)
        from (
          select i.bricklink_id from public.price_run_items i
          where i.run_id = r.id and i.state = 'failed'
          order by i.bricklink_id limit 20
        ) f
      ), '[]'),
      failed_reasons = coalesce((
        select jsonb_object_agg(f.bricklink_id, f.reason)
        from (
          select i.bricklink_id, i.reason from public.price_run_items i
          where i.run_id = r.id and i.state = 'failed' and i.reason is not null
          order by i.bricklink_id limit 20
        ) f
      ), '{}')
    where r.id = p_run and r.finished_at is null
      and not exists (
        select 1 from public.price_run_items i
        where i.run_id = r.id and i.state in ('open', 'working')
      );
end;
$$;

/**
 * The latest run of the signed-in person (the service role names the owner), or null:
 * `{trigger, day, startedAt, finishedAt?, pausedUntil?, total, updated, empty, failed, open,
 * skipped, failedNumbers, failedReasons}`. Row level security keeps everyone to their own runs.
 */
create or replace function public.price_run_status(p_owner uuid default null)
returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
      'trigger', r.trigger,
      'day', to_char(r.day, 'YYYY-MM-DD'),
      'startedAt', r.started_at,
      'finishedAt', r.finished_at,
      'pausedUntil', case when r.finished_at is null and r.paused_until > now()
        then r.paused_until end,
      'total', r.total,
      'skipped', r.skipped,
      'updated', coalesce(r.updated, (select count(*) from public.price_run_items i
        where i.run_id = r.id and i.state = 'priced')),
      'empty', coalesce(r.empty, (select count(*) from public.price_run_items i
        where i.run_id = r.id and i.state = 'empty')),
      'failed', coalesce(r.failed, (select count(*) from public.price_run_items i
        where i.run_id = r.id and i.state = 'failed')),
      'open', case when r.finished_at is null then (select count(*) from public.price_run_items i
        where i.run_id = r.id and i.state in ('open', 'working')) else 0 end,
      'failedNumbers', case when r.finished_at is not null then r.failed_numbers
        else coalesce((
          select jsonb_agg(f.bricklink_id order by f.bricklink_id)
          from (
            select i.bricklink_id from public.price_run_items i
            where i.run_id = r.id and i.state = 'failed'
            order by i.bricklink_id limit 20
          ) f
        ), '[]') end,
      'failedReasons', case when r.finished_at is not null then r.failed_reasons
        else coalesce((
          select jsonb_object_agg(f.bricklink_id, f.reason)
          from (
            select i.bricklink_id, i.reason from public.price_run_items i
            where i.run_id = r.id and i.state = 'failed' and i.reason is not null
            order by i.bricklink_id limit 20
          ) f
        ), '{}') end
    ))
  from public.price_runs r
  where r.owner = coalesce(p_owner, (select auth.uid()))
  order by r.started_at desc, r.id desc
  limit 1;
$$;

-- The rights of the new function, as of the old one: only the Edge Function (service role) may call it.
revoke all on function public.price_run_finish(bigint, text, text, text, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.price_run_finish(bigint, text, text, text, jsonb, jsonb, text)
  to service_role;
