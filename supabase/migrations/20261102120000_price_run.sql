-- Stud Stephan, P11: the weekly price run (BrickLink price guide → `price_points`).
--
-- A run is a queue: `price_run_begin` puts every official figure and set of the collection and of
-- the wishlist with a BrickLink number into `price_run_items` (each number once). The Edge Function
-- `bricklink` works through it in portions (`price_run_claim` → BrickLink → `price_run_finish`), as
-- long as one call may take, so a run goes on over several calls and never asks twice for an item
-- that is done. Every price point of a run carries the run's day, so a run gives exactly one point
-- per item, and a second run on the same day replaces that day's point (F10).
--
-- Who calls: pg_cron starts a run every Monday at 02:00 UTC (03:00 in German winter time) and every
-- five minutes calls the function again while a run is open; both go through pg_net with the secret
-- from the Vault (`price_run_secret`, the same value as the function's secret `PRICE_RUN_SECRET`).
-- Without that secret nothing is called. The app's "Jetzt aktualisieren" calls the function with
-- the person's sign-in instead.
--
-- Security: the run tables are readable by their owner only (row level security), writable by
-- nobody but these functions. The functions that write run with the owner's rights of the database
-- (`security definer`) and may be called by the service role only (the Edge Function).
--
-- BrickLink allows 5,000 calls a day for catalog and prices together (`catalog_usage`, P7). The
-- catalog stops at 4,500; the price run counts on the same counter (`price_count_call`) up to
-- 4,950 and takes at most 2,500 calls a day itself, then waits for the next day.
--
-- Written so that it can run twice (it can be pasted into the SQL editor of the dashboard and still
-- be pushed later). Needs the P7 migration (`catalog_usage`).

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Tables -----------------------------------------------------------------------------------------

create table if not exists public.price_runs (
  id bigint generated always as identity primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  trigger text not null check (trigger in ('schedule', 'manual')),
  /** The day of every price point of the run: the calendar day in Germany when it started. */
  day date not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  /** The day's BrickLink calls are used up; the run goes on after this time. */
  paused_until timestamptz,
  total integer not null default 0 check (total >= 0),
  /** Official figures, sets and wishes without a BrickLink number: not asked for. */
  skipped integer not null default 0 check (skipped >= 0),
  -- The result, written when the run is finished (its items are deleted with the next run).
  updated integer check (updated >= 0),
  empty integer check (empty >= 0),
  failed integer check (failed >= 0),
  failed_numbers jsonb not null default '[]' check (jsonb_typeof(failed_numbers) = 'array')
);

create unique index if not exists price_runs_one_open on public.price_runs (owner)
  where finished_at is null;
create index if not exists price_runs_latest on public.price_runs (owner, started_at desc);

/** One catalog item of a run: open → working → priced, empty (no sale) or failed. */
create table if not exists public.price_run_items (
  run_id bigint not null references public.price_runs (id) on delete cascade,
  owner uuid not null references auth.users (id) on delete cascade,
  item_type text not null check (item_type in ('minifig', 'legoSet')),
  bricklink_id text not null check (length(bricklink_id) between 1 and 100),
  state text not null default 'open'
    check (state in ('open', 'working', 'priced', 'empty', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  claimed_at timestamptz,
  primary key (run_id, item_type, bricklink_id)
);

create index if not exists price_run_items_owner on public.price_run_items (owner);
create index if not exists price_run_items_waiting on public.price_run_items (run_id)
  where state in ('open', 'working');

do $$
declare
  v_table text;
begin
  foreach v_table in array array['price_runs', 'price_run_items'] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from public, anon, authenticated', v_table);
    execute format('grant select on table public.%I to authenticated, service_role', v_table);
    execute format('drop policy if exists owner_reads on public.%I', v_table);
    execute format(
      'create policy owner_reads on public.%I for select to authenticated '
        'using (owner = (select auth.uid()))',
      v_table
    );
  end loop;
end;
$$;

-- Building the queue -----------------------------------------------------------------------------

/**
 * The official figures, sets and wishes of an owner with their number (trimmed; empty if missing):
 * what a run asks BrickLink for. Customs and other manufacturers have no market value.
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
    select o.data ->> 'type',
      case when o.data ->> 'type' = 'minifig' then o.data ->> 'bricklinkId'
        else o.data ->> 'setNumber' end,
      o.data
      from public.wish_items o where o.owner = p_owner
  ) x
  where x.data -> 'manufacturer' ->> 'kind' = 'lego' and x.item_type in ('minifig', 'legoSet');
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
      ), '[]')
    where r.id = p_run and r.finished_at is null
      and not exists (
        select 1 from public.price_run_items i
        where i.run_id = r.id and i.state in ('open', 'working')
      );
end;
$$;

/**
 * Starts a run for the owner and answers its id. If one is still open (paused or not done yet),
 * nothing new starts and that one goes on.
 */
create or replace function public.price_run_begin(p_owner uuid, p_trigger text)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_run bigint;
begin
  if p_owner is null or p_trigger is null or p_trigger not in ('schedule', 'manual') then
    raise exception 'invalid_object' using errcode = '22023';
  end if;
  -- One begin at a time per owner, so two calls at once do not start two runs.
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text, 11));
  select r.id into v_run from public.price_runs r
    where r.owner = p_owner and r.finished_at is null;
  if v_run is not null then
    return v_run;
  end if;

  -- The items of finished runs are no longer needed; their result stays on the run.
  delete from public.price_run_items i where i.owner = p_owner;

  insert into public.price_runs (owner, trigger, day)
    values (p_owner, p_trigger, (now() at time zone 'Europe/Berlin')::date)
    returning id into v_run;

  insert into public.price_run_items (run_id, owner, item_type, bricklink_id)
    select distinct on (n.item_type, lower(n.number)) v_run, p_owner, n.item_type, n.number
    from public.price_run_numbers(p_owner) n
    where n.number <> '' and length(n.number) <= 100
    order by n.item_type, lower(n.number), n.number;

  update public.price_runs r
    set total = (select count(*) from public.price_run_items i where i.run_id = v_run),
      skipped = (select count(*) from public.price_run_numbers(p_owner) n where n.number = '')
    where r.id = v_run;
  -- A collection without numbers is done at once.
  perform public.price_run_settle(v_run);
  return v_run;
end;
$$;

-- Working through the queue (the Edge Function, with the service role) ---------------------------

/**
 * Takes up to `p_limit` (at most 50) open items of open, not paused runs, of one owner or of all
 * (`null`), and marks them as being worked on. An item taken more than three minutes ago by a call
 * that never finished is open again. Answers `[{runId, itemType, bricklinkId, attempts}]`.
 */
create or replace function public.price_run_claim(p_owner uuid, p_limit integer)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_items jsonb;
begin
  -- Runs whose work is done are closed first (also after an interrupted call).
  perform public.price_run_settle(r.id) from public.price_runs r
    where r.finished_at is null and (p_owner is null or r.owner = p_owner);

  with picked as (
    select i.run_id, i.item_type, i.bricklink_id
    from public.price_run_items i
    join public.price_runs r on r.id = i.run_id
    where r.finished_at is null
      and (r.paused_until is null or r.paused_until <= now())
      and (p_owner is null or r.owner = p_owner)
      and (i.state = 'open' or (i.state = 'working' and i.claimed_at < now() - interval '3 minutes'))
    order by r.started_at, i.attempts, i.item_type, i.bricklink_id
    limit greatest(least(coalesce(p_limit, 0), 50), 0)
    for update of i skip locked
  ), claimed as (
    update public.price_run_items i
      set state = 'working', claimed_at = now(), attempts = i.attempts + 1
      from picked p
      where i.run_id = p.run_id and i.item_type = p.item_type and i.bricklink_id = p.bricklink_id
      returning i.run_id, i.item_type, i.bricklink_id, i.attempts
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'runId', c.run_id, 'itemType', c.item_type, 'bricklinkId', c.bricklink_id,
      'attempts', c.attempts
    ) order by c.item_type, c.bricklink_id), '[]')
    into v_items from claimed c;
  return v_items;
end;
$$;

/** Whether `p_value` is `{new?, used?}` with whole numbers from 0, at least one of them. */
create or replace function public.price_run_is_pair(p_value jsonb)
returns boolean
language sql immutable security definer set search_path = '' as $$
  select jsonb_typeof(p_value) = 'object'
    and exists (select 1 from jsonb_object_keys(p_value))
    and not exists (
      select 1 from jsonb_each(p_value) e
      where e.key not in ('new', 'used')
        or jsonb_typeof(e.value) <> 'number'
        or (e.value::text)::numeric % 1 <> 0
        or (e.value::text)::numeric not between 0 and 100000000
    );
$$;

/**
 * The result for one item: `priced` writes the price point (`p_cents`, optionally `p_sold`) with the
 * run's day for the run's owner, replacing one of that day; `empty` (nothing sold) and `failed`
 * write nothing, so an older value stays (F10); `retry` puts the item back into the queue.
 */
create or replace function public.price_run_finish(
  p_run bigint,
  p_item_type text,
  p_bricklink_id text,
  p_outcome text,
  p_cents jsonb default null,
  p_sold jsonb default null
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
    set state = case p_outcome when 'retry' then 'open' else p_outcome end, claimed_at = null
    where i.run_id = p_run and i.item_type = p_item_type and i.bricklink_id = p_bricklink_id;
  perform public.price_run_settle(p_run);
end;
$$;

/**
 * Puts items taken but not worked on back into the queue, without counting the attempt
 * (`[{runId, itemType, bricklinkId}]`). With `p_paused_until` (BrickLink's day is used up) every
 * open run waits until then.
 */
create or replace function public.price_run_release(p_items jsonb, p_paused_until timestamptz)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'invalid_object' using errcode = '22023';
  end if;
  update public.price_run_items i
    set state = 'open', claimed_at = null, attempts = greatest(i.attempts - 1, 0)
    from jsonb_to_recordset(p_items) as x ("runId" bigint, "itemType" text, "bricklinkId" text)
    where i.run_id = x."runId" and i.item_type = x."itemType"
      and i.bricklink_id = x."bricklinkId" and i.state = 'working';
  if p_paused_until is not null then
    update public.price_runs r set paused_until = p_paused_until where r.finished_at is null;
  end if;
end;
$$;

/**
 * Counts one BrickLink call of the price run and answers `true`; `false` (nothing counted) once
 * the day has `p_total_cap` calls of catalog and prices together or `p_price_cap` of the price run.
 */
create or replace function public.price_count_call(
  p_day date,
  p_total_cap integer,
  p_price_cap integer
)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_total integer;
  v_prices integer;
begin
  insert into public.catalog_usage (day, service, calls)
    values (p_day, 'bricklink', 0), (p_day, 'bricklink-prices', 0)
  on conflict (day, service) do nothing;
  select u.calls into v_total from public.catalog_usage u
    where u.day = p_day and u.service = 'bricklink' for update;
  select u.calls into v_prices from public.catalog_usage u
    where u.day = p_day and u.service = 'bricklink-prices' for update;
  if v_total >= p_total_cap or v_prices >= p_price_cap then
    return false;
  end if;
  update public.catalog_usage u set calls = u.calls + 1
    where u.day = p_day and u.service in ('bricklink', 'bricklink-prices');
  return true;
end;
$$;

-- Reading the state (the app, S12) ---------------------------------------------------------------

/**
 * The latest run of the signed-in person (the service role names the owner), or null:
 * `{trigger, day, startedAt, finishedAt?, pausedUntil?, total, updated, empty, failed, open,
 * skipped, failedNumbers}`. Row level security keeps everyone to their own runs.
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
        ), '[]') end
    ))
  from public.price_runs r
  where r.owner = coalesce(p_owner, (select auth.uid()))
  order by r.started_at desc, r.id desc
  limit 1;
$$;

-- Calling the function from the database (pg_cron → pg_net) --------------------------------------

/**
 * Calls the Edge Function `bricklink` with `{op: "priceRun"}` and the secret from the Vault.
 * Answers the id of the request, or null without a secret (then nothing is called). The project
 * address may be overridden in the Vault (`project_url`), e.g. for a local instance.
 */
create or replace function public.price_run_call()
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_secret text;
  v_url text;
begin
  select s.decrypted_secret into v_secret from vault.decrypted_secrets s
    where s.name = 'price_run_secret' limit 1;
  if coalesce(length(btrim(v_secret)), 0) < 32 then
    return null;
  end if;
  select s.decrypted_secret into v_url from vault.decrypted_secrets s
    where s.name = 'project_url' limit 1;
  v_url := coalesce(nullif(btrim(v_url), ''), 'https://ohuqwiypmoqyuxsgouxw.supabase.co');
  return net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/bricklink',
    body := jsonb_build_object('op', 'priceRun'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-price-run-secret', btrim(v_secret)
    ),
    timeout_milliseconds := 120000
  );
end;
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
    union select w.owner from public.wish_items w
  ) o;
  perform public.price_run_call();
end;
$$;

/** The job every five minutes: one more call while a run has work and is not paused. */
create or replace function public.price_run_continue()
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.price_runs r
    where r.finished_at is null and (r.paused_until is null or r.paused_until <= now())
  ) then
    perform public.price_run_call();
  end if;
end;
$$;

-- Rights: the app reads its status; the Edge Function (service role) works the queue; the cron
-- jobs run as the owner of the database and need no grant.

revoke all on function public.price_run_numbers(uuid) from public, anon, authenticated, service_role;
revoke all on function public.price_run_settle(bigint) from public, anon, authenticated, service_role;
revoke all on function public.price_run_begin(uuid, text) from public, anon, authenticated;
revoke all on function public.price_run_claim(uuid, integer) from public, anon, authenticated;
revoke all on function public.price_run_is_pair(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.price_run_finish(bigint, text, text, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.price_run_release(jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.price_count_call(date, integer, integer)
  from public, anon, authenticated;
revoke all on function public.price_run_status(uuid) from public, anon;
revoke all on function public.price_run_call() from public, anon, authenticated, service_role;
revoke all on function public.price_run_weekly() from public, anon, authenticated, service_role;
revoke all on function public.price_run_continue() from public, anon, authenticated, service_role;

grant execute on function public.price_run_begin(uuid, text) to service_role;
grant execute on function public.price_run_claim(uuid, integer) to service_role;
grant execute on function public.price_run_finish(bigint, text, text, text, jsonb, jsonb)
  to service_role;
grant execute on function public.price_run_release(jsonb, timestamptz) to service_role;
grant execute on function public.price_count_call(date, integer, integer) to service_role;
grant execute on function public.price_run_status(uuid) to authenticated, service_role;

-- The jobs (pg_cron runs in UTC). `cron.schedule` with a name replaces a job of that name.

select cron.schedule('stud-stephan-price-run', '0 2 * * 1', 'select public.price_run_weekly()');
select cron.schedule(
  'stud-stephan-price-run-continue', '*/5 * * * *', 'select public.price_run_continue()'
);
-- pg_cron keeps a line per job run; two weeks are enough.
select cron.schedule(
  'stud-stephan-cron-cleanup', '30 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '14 days'$$
);
