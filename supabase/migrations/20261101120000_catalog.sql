-- Stud Stephan, P7: cache and call count of the catalog functions (`supabase/functions/`).
--
-- `catalog_cache` holds the answers of the catalog (30 days, the function decides by `fetched_at`);
-- `catalog_usage` counts the day's calls per service (BrickLink allows 5,000 a day). Both are for the
-- Edge Functions only: row level security is on, nobody but the service role has any right, so the
-- app (signed in or not) cannot read or write them. Written so that it can run twice (it can be
-- pasted into the SQL editor of the dashboard and still be pushed later).

create table if not exists public.catalog_cache (
  key text primary key check (length(key) between 1 and 200),
  value jsonb not null,
  fetched_at timestamptz not null default now()
);

create table if not exists public.catalog_usage (
  day date not null,
  service text not null check (length(service) between 1 and 50),
  calls integer not null default 0 check (calls >= 0),
  primary key (day, service)
);

alter table public.catalog_cache enable row level security;
alter table public.catalog_usage enable row level security;
revoke all on table public.catalog_cache from public, anon, authenticated;
revoke all on table public.catalog_usage from public, anon, authenticated;
grant select, insert, update on table public.catalog_cache to service_role;
grant select, insert, update on table public.catalog_usage to service_role;

/**
 * Counts one call of `p_service` on `p_day` and answers `true`; answers `false` (and counts
 * nothing) once `p_cap` calls are used up.
 */
create or replace function public.catalog_count_call(p_service text, p_day date, p_cap integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_calls integer;
begin
  insert into public.catalog_usage as u (day, service, calls)
  values (p_day, p_service, 1)
  on conflict (day, service) do update set calls = u.calls + 1 where u.calls < p_cap
  returning u.calls into v_calls;
  return v_calls is not null;
end;
$$;

revoke all on function public.catalog_count_call(text, date, integer)
  from public, anon, authenticated;
grant execute on function public.catalog_count_call(text, date, integer) to service_role;
