-- Stud Stephan, P12: building the series of "Fehlende Figuren" (F13).
--
-- A series is a Rebrickable theme below a main theme ("Star Wars – The Clone Wars"). Building it is
-- a queue like the price run's: `series_begin` puts every set of the theme into `series_build_sets`,
-- the Edge Function `bricklink` (`{op: "series"}`) works through it in portions (`series_claim` →
-- BrickLink "minifigs of the set" → `series_finish`), and what one call does not finish the next call
-- goes on with. The figures of a series are the figures of its finished sets, each one once.
--
-- BrickLink allows 5,000 calls a day for catalog, prices and series together (`catalog_usage`). A
-- build counts on the catalog's share; when the day is used up the Edge Function releases what it
-- took and pauses the series until the next day (`series_release`), and the cron job below goes on
-- by itself then instead of the build stopping.
--
-- Security: the tables are closed to the app (row level security without a policy, no rights for
-- anon or signed-in people). Everything goes through these functions, which run with the owner's
-- rights of the database (`security definer`) and may be called by the service role only (the Edge
-- Function, which names the owner after checking the sign-in).
--
-- Written so that it can run twice (it can be pasted into the SQL editor of the dashboard and still
-- be pushed later). Needs the P11 migration (`price_run_continue`).

-- Tables -----------------------------------------------------------------------------------------

create table if not exists public.series_builds (
  id bigint generated always as identity primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  /** Rebrickable's theme id. */
  theme_id integer not null check (theme_id > 0),
  name text not null check (length(name) between 1 and 300),
  created_at timestamptz not null default now(),
  /** The last time the person opened it: "Meine Reihen" lists the latest first. */
  opened_at timestamptz not null default now(),
  finished_at timestamptz,
  /** The day's BrickLink calls are used up; the build goes on after this time. */
  paused_until timestamptz,
  unique (owner, theme_id)
);

create index if not exists series_builds_owner on public.series_builds (owner, opened_at desc);
create index if not exists series_builds_open on public.series_builds (id)
  where finished_at is null;

/** One set of a series: open → working → done (with its figures) or failed. */
create table if not exists public.series_build_sets (
  series_id bigint not null references public.series_builds (id) on delete cascade,
  owner uuid not null references auth.users (id) on delete cascade,
  set_number text not null check (length(set_number) between 1 and 100),
  state text not null default 'open' check (state in ('open', 'working', 'done', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  claimed_at timestamptz,
  /** `[{number, name, imageUrl?}]` once the set is done. */
  figures jsonb not null default '[]' check (jsonb_typeof(figures) = 'array'),
  primary key (series_id, set_number)
);

create index if not exists series_build_sets_waiting on public.series_build_sets (series_id)
  where state in ('open', 'working');
create index if not exists series_build_sets_owner on public.series_build_sets (owner);

do $$
declare
  v_table text;
begin
  foreach v_table in array array['series_builds', 'series_build_sets'] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from public, anon, authenticated', v_table);
    execute format('grant select, insert, update, delete on table public.%I to service_role', v_table);
  end loop;
end;
$$;

-- Helpers ----------------------------------------------------------------------------------------

/** Closes a series whose sets are all done and failed; nothing if sets are left. */
create or replace function public.series_settle(p_series bigint)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.series_builds s
    set finished_at = now(), paused_until = null
    where s.id = p_series and s.finished_at is null
      and not exists (
        select 1 from public.series_build_sets x
        where x.series_id = s.id and x.state in ('open', 'working')
      );
end;
$$;

/**
 * `{id, themeId, name, total, done, failed, figureCount, createdAt, openedAt, finishedAt?,
 * pausedUntil?}` of a series, or null.
 */
create or replace function public.series_summary(p_series bigint)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', s.id,
    'themeId', s.theme_id,
    'name', s.name,
    'total', (select count(*) from public.series_build_sets x where x.series_id = s.id),
    'done', (select count(*) from public.series_build_sets x
      where x.series_id = s.id and x.state = 'done'),
    'failed', (select count(*) from public.series_build_sets x
      where x.series_id = s.id and x.state = 'failed'),
    'figureCount', (select count(distinct e ->> 'number')
      from public.series_build_sets x, jsonb_array_elements(x.figures) e
      where x.series_id = s.id and x.state = 'done'),
    'createdAt', s.created_at,
    'openedAt', s.opened_at,
    'finishedAt', s.finished_at,
    'pausedUntil', case when s.finished_at is null and s.paused_until > now()
      then s.paused_until end
  ))
  from public.series_builds s
  where s.id = p_series;
$$;

-- Building the queue -----------------------------------------------------------------------------

/**
 * Creates the series of a theme for the owner with `p_sets` (`[{number, name}]`, at most 1,000) in
 * the queue and answers its summary. If the owner has a series for the theme, nothing new is made
 * and that one is answered.
 */
create or replace function public.series_begin(
  p_owner uuid,
  p_theme_id integer,
  p_name text,
  p_sets jsonb
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_series bigint;
begin
  if p_owner is null or p_theme_id is null or p_theme_id <= 0
    or p_name is null or length(p_name) not between 1 and 300
    or jsonb_typeof(p_sets) is distinct from 'array' or jsonb_array_length(p_sets) > 1000 then
    raise exception 'invalid_object' using errcode = '22023';
  end if;
  -- One begin at a time per owner, so two calls at once do not make two series.
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text, 12));
  select s.id into v_series from public.series_builds s
    where s.owner = p_owner and s.theme_id = p_theme_id;
  if v_series is not null then
    return public.series_summary(v_series);
  end if;

  insert into public.series_builds (owner, theme_id, name)
    values (p_owner, p_theme_id, p_name)
    returning id into v_series;

  insert into public.series_build_sets (series_id, owner, set_number)
    select distinct on (x.number) v_series, p_owner, x.number
    from jsonb_to_recordset(p_sets) as x (number text)
    where x.number is not null and length(x.number) between 1 and 100
    order by x.number;

  -- A theme without sets is done at once.
  perform public.series_settle(v_series);
  return public.series_summary(v_series);
end;
$$;

-- Working through the queue (the Edge Function, with the service role) ---------------------------

/**
 * Takes up to `p_limit` (at most 50) open sets of open, not paused series, of one owner or of all
 * (`null`), and marks them as being worked on. A set taken more than three minutes ago by a call
 * that never finished is open again. Answers `[{seriesId, setNumber, attempts}]`.
 */
create or replace function public.series_claim(p_owner uuid, p_limit integer)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_sets jsonb;
begin
  -- Series whose work is done are closed first (also after an interrupted call).
  perform public.series_settle(s.id) from public.series_builds s
    where s.finished_at is null and (p_owner is null or s.owner = p_owner);

  with picked as (
    select x.series_id, x.set_number
    from public.series_build_sets x
    join public.series_builds s on s.id = x.series_id
    where s.finished_at is null
      and (s.paused_until is null or s.paused_until <= now())
      and (p_owner is null or s.owner = p_owner)
      and (x.state = 'open' or (x.state = 'working' and x.claimed_at < now() - interval '3 minutes'))
    order by s.opened_at desc, x.attempts, x.set_number
    limit greatest(least(coalesce(p_limit, 0), 50), 0)
    for update of x skip locked
  ), claimed as (
    update public.series_build_sets x
      set state = 'working', claimed_at = now(), attempts = x.attempts + 1
      from picked p
      where x.series_id = p.series_id and x.set_number = p.set_number
      returning x.series_id, x.set_number, x.attempts
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'seriesId', c.series_id, 'setNumber', c.set_number, 'attempts', c.attempts
    ) order by c.series_id, c.set_number), '[]')
    into v_sets from claimed c;
  return v_sets;
end;
$$;

/**
 * The result for one set: `done` stores its figures (`[{number, name, imageUrl?}]`, at most 200);
 * `failed` marks it; `retry` puts it back into the queue.
 */
create or replace function public.series_finish(
  p_series bigint,
  p_set text,
  p_outcome text,
  p_figures jsonb default null
)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_outcome is null or p_outcome not in ('done', 'failed', 'retry')
    or (p_outcome = 'done' and (
      jsonb_typeof(p_figures) is distinct from 'array' or jsonb_array_length(p_figures) > 200
    )) then
    raise exception 'invalid_object' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.series_build_sets x
    where x.series_id = p_series and x.set_number = p_set
  ) then
    raise exception 'not_found' using errcode = '22023';
  end if;

  update public.series_build_sets x
    set state = case p_outcome when 'retry' then 'open' else p_outcome end,
      claimed_at = null,
      figures = case when p_outcome = 'done' then p_figures else x.figures end
    where x.series_id = p_series and x.set_number = p_set;
  perform public.series_settle(p_series);
end;
$$;

/**
 * Puts sets taken but not worked on back into the queue, without counting the attempt
 * (`[{seriesId, setNumber}]`). With `p_paused_until` (BrickLink's day is used up) every open series
 * waits until then.
 */
create or replace function public.series_release(p_items jsonb, p_paused_until timestamptz)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'invalid_object' using errcode = '22023';
  end if;
  update public.series_build_sets x
    set state = 'open', claimed_at = null, attempts = greatest(x.attempts - 1, 0)
    from jsonb_to_recordset(p_items) as i ("seriesId" bigint, "setNumber" text)
    where x.series_id = i."seriesId" and x.set_number = i."setNumber" and x.state = 'working';
  if p_paused_until is not null then
    update public.series_builds s set paused_until = p_paused_until where s.finished_at is null;
  end if;
end;
$$;

-- Reading (the Edge Function answers the app) ----------------------------------------------------

/** The owner's series as summaries, the one opened last first. */
create or replace function public.series_list(p_owner uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    jsonb_agg(public.series_summary(s.id) order by s.opened_at desc, s.id desc),
    '[]'
  )
  from public.series_builds s
  where s.owner = p_owner;
$$;

/**
 * Opens a series of the owner: it counts as opened now, and `{summary, figures}` comes back, the
 * figures of the finished sets, each one once, sorted by name (`[{number, name, imageUrl?}]`).
 * Null if the owner has no such series.
 */
create or replace function public.series_open(p_owner uuid, p_series bigint, p_touch boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_figures jsonb;
begin
  if not exists (
    select 1 from public.series_builds s where s.id = p_series and s.owner = p_owner
  ) then
    return null;
  end if;
  if p_touch then
    update public.series_builds s set opened_at = now()
      where s.id = p_series and s.owner = p_owner;
  end if;
  select coalesce(jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'number', f.number, 'name', f.name, 'imageUrl', f.image_url
      )) order by f.name, f.number
    ), '[]')
    into v_figures
    from (
      select distinct on (e ->> 'number')
        e ->> 'number' as number, e ->> 'name' as name, e ->> 'imageUrl' as image_url
      from public.series_build_sets x, jsonb_array_elements(x.figures) e
      where x.series_id = p_series and x.state = 'done'
        and e ->> 'number' is not null and e ->> 'name' is not null
      order by e ->> 'number', x.set_number
    ) f;
  return jsonb_build_object('summary', public.series_summary(p_series), 'figures', v_figures);
end;
$$;

/** Deletes a series of the owner with its sets. */
create or replace function public.series_remove(p_owner uuid, p_series bigint)
returns void
language sql security definer set search_path = '' as $$
  delete from public.series_builds s where s.id = p_series and s.owner = p_owner;
$$;

-- The five-minute job also goes on when only a series is open ------------------------------------

/**
 * The job every five minutes: one more call while a price run or a series build has work and is not
 * paused (replaces the function of the P11 migration; the Edge Function works on both).
 */
create or replace function public.price_run_continue()
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.price_runs r
    where r.finished_at is null and (r.paused_until is null or r.paused_until <= now())
  ) or exists (
    select 1 from public.series_builds s
    where s.finished_at is null and (s.paused_until is null or s.paused_until <= now())
  ) then
    perform public.price_run_call();
  end if;
end;
$$;

-- Rights -----------------------------------------------------------------------------------------

revoke all on function public.series_settle(bigint) from public, anon, authenticated, service_role;
revoke all on function public.series_summary(bigint) from public, anon, authenticated, service_role;
revoke all on function public.series_begin(uuid, integer, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.series_claim(uuid, integer) from public, anon, authenticated;
revoke all on function public.series_finish(bigint, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.series_release(jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.series_list(uuid) from public, anon, authenticated;
drop function if exists public.series_open(uuid, bigint);
revoke all on function public.series_open(uuid, bigint, boolean) from public, anon, authenticated;
revoke all on function public.series_remove(uuid, bigint) from public, anon, authenticated;
revoke all on function public.price_run_continue()
  from public, anon, authenticated, service_role;

grant execute on function public.series_begin(uuid, integer, text, jsonb) to service_role;
grant execute on function public.series_claim(uuid, integer) to service_role;
grant execute on function public.series_finish(bigint, text, text, jsonb) to service_role;
grant execute on function public.series_release(jsonb, timestamptz) to service_role;
grant execute on function public.series_list(uuid) to service_role;
grant execute on function public.series_open(uuid, bigint, boolean) to service_role;
grant execute on function public.series_remove(uuid, bigint) to service_role;
