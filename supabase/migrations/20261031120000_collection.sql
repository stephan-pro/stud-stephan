-- Stud Stephan, P4a: the collection in the database.
--
-- One table per object type (minifigs, lego_sets, special_parts, dioramas, wish_items); a row holds
-- the object as JSON (`data`), keyed by its owner and id. Photos and Studio files have their own
-- tables, one row per file in storage, and are joined back into the objects on loading. Price
-- points are keyed by item type, BrickLink number and day (a second run on a day replaces its point).
--
-- Security: row level security on every table; every row and every file belongs to `owner`, the
-- signed-in person (`auth.uid()`). The project does not expose new tables by itself, so privileges
-- are granted explicitly and only to `authenticated` (and `ping` to `anon` for the keepalive). The
-- functions run with the caller's rights (`security invoker`), so row level security holds there too.
-- Files lie in the private buckets `photos` and `studio-files` under `<owner>/…`, owner only.
--
-- The rules are those of `src/backend/rules.ts` and `src/backend/fakeStore.ts`, which the fake
-- server of the tests follows; one series of contract tests (`src/backend/remote.contract.ts`) runs
-- against both. Refusals are exceptions whose message is the reason (`invalid_object`, …).

-- Tables -----------------------------------------------------------------------------------------

create table public.minifigs (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  data jsonb not null check (
    jsonb_typeof(data) = 'object' and data ->> 'id' = id and octet_length(data::text) <= 32768
  ),
  schema_version integer not null check (schema_version >= 1),
  updated_at timestamptz not null default now(),
  primary key (owner, id)
);

create table public.lego_sets (like public.minifigs including all);
create table public.special_parts (like public.minifigs including all);
create table public.dioramas (like public.minifigs including all);
create table public.wish_items (like public.minifigs including all);

-- `like … including all` copies defaults and checks, not the foreign key to the owner.
alter table public.lego_sets add foreign key (owner) references auth.users (id) on delete cascade;
alter table public.special_parts add foreign key (owner) references auth.users (id) on delete cascade;
alter table public.dioramas add foreign key (owner) references auth.users (id) on delete cascade;
alter table public.wish_items add foreign key (owner) references auth.users (id) on delete cascade;

/** One own photo of a minifig, set, special part or diorama; `position` 0 is the cover. */
create table public.photos (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path text not null check (left(path, 37) = owner::text || '/' and length(path) between 38 and 300),
  item_kind text not null check (item_kind in ('minifig', 'legoSet', 'specialPart', 'diorama')),
  item_id text not null check (length(item_id) between 1 and 100),
  position integer not null check (position between 0 and 19),
  primary key (owner, path)
);

create index photos_item on public.photos (owner, item_kind, item_id);

/** One Studio file (`.io`) of a diorama; goes with the diorama. */
create table public.studio_files (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  diorama_id text not null,
  file_name text not null check (length(file_name) between 1 and 200),
  size_bytes bigint not null check (size_bytes between 0 and 26214400),
  uploaded_at text not null check (length(uploaded_at) between 1 and 40),
  path text not null check (left(path, 37) = owner::text || '/' and length(path) between 38 and 300),
  position integer not null check (position between 0 and 19),
  primary key (owner, id),
  unique (owner, path),
  foreign key (owner, diorama_id) references public.dioramas (owner, id) on delete cascade
);

create index studio_files_diorama on public.studio_files (owner, diorama_id);

/** One price run's result for one catalog item (`PricePoint` as JSON in `data`). */
create table public.price_points (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_type text not null check (item_type in ('minifig', 'legoSet', 'specialPart')),
  bricklink_id text not null check (length(bricklink_id) between 1 and 100),
  date date not null,
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 4096),
  primary key (owner, item_type, bricklink_id, date)
);

-- Row level security and privileges: the owner only, signed in only ---------------------------

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'minifigs', 'lego_sets', 'special_parts', 'dioramas', 'wish_items', 'photos', 'studio_files',
    'price_points'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from public, anon, authenticated', v_table);
    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated', v_table
    );
    execute format(
      'create policy owner_only on public.%I for all to authenticated '
        'using (owner = (select auth.uid())) with check (owner = (select auth.uid()))',
      v_table
    );
  end loop;
end;
$$;

-- Saving and deleting objects --------------------------------------------------------------------

/**
 * Saves a minifig, set, special part, diorama or wish item (new or replacing the one with its id)
 * together with its photos (`photos`, in order) and, for a diorama, its Studio files
 * (`studioFiles`). Answers `{releasedFiles: [{bucket, path}]}`: the files the object no longer
 * lists, which the app then removes from storage.
 */
create function public.save_object(p_kind text, p_object jsonb, p_schema_version integer)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_table text := case p_kind
    when 'minifig' then 'minifigs'
    when 'legoSet' then 'lego_sets'
    when 'specialPart' then 'special_parts'
    when 'diorama' then 'dioramas'
    when 'wishItem' then 'wish_items'
  end;
  v_id text;
  v_type text;
  v_data jsonb;
  v_photos jsonb := '[]';
  v_files jsonb := '[]';
  v_released jsonb := '[]';
  v_gone jsonb;
begin
  if v_owner is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if v_table is null or jsonb_typeof(p_object) is distinct from 'object'
    or jsonb_typeof(p_object -> 'id') is distinct from 'string'
    or p_schema_version is null or p_schema_version < 1 then
    raise exception 'invalid_object' using errcode = '22023';
  end if;
  v_id := p_object ->> 'id';
  v_type := coalesce(p_object ->> 'type', '');
  if length(v_id) not between 1 and 100
    or (p_kind = 'wishItem' and v_type not in ('minifig', 'legoSet'))
    or (p_kind <> 'wishItem' and v_type <> p_kind) then
    raise exception 'invalid_object' using errcode = '22023';
  end if;
  v_data := p_object;

  if p_kind <> 'wishItem' then
    v_photos := coalesce(p_object -> 'photos', '[]');
    v_data := v_data - 'photos';
    if jsonb_typeof(v_photos) <> 'array' then
      raise exception 'invalid_object' using errcode = '22023';
    end if;
    if jsonb_array_length(v_photos) > 20 then
      raise exception 'too_many_photos' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_array_elements(v_photos) e (value) where jsonb_typeof(e.value) <> 'string')
      or (select count(distinct e.path) from jsonb_array_elements_text(v_photos) e (path))
        <> jsonb_array_length(v_photos) then
      raise exception 'invalid_object' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(v_photos) e (path)
      where not (left(e.path, 37) = v_owner::text || '/' and length(e.path) between 38 and 300)
    ) then
      raise exception 'invalid_path' using errcode = '22023';
    end if;
  end if;

  if p_kind = 'diorama' then
    v_files := coalesce(p_object -> 'studioFiles', '[]');
    v_data := v_data - 'studioFiles';
    if jsonb_typeof(v_files) <> 'array' then
      raise exception 'invalid_object' using errcode = '22023';
    end if;
    if jsonb_array_length(v_files) > 20 then
      raise exception 'too_many_files' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_files) f (value)
      where jsonb_typeof(f.value) is distinct from 'object'
        or jsonb_typeof(f.value -> 'id') is distinct from 'string'
        or coalesce(length(f.value ->> 'id'), 0) not between 1 and 100
        or jsonb_typeof(f.value -> 'fileName') is distinct from 'string'
        or coalesce(length(f.value ->> 'fileName'), 0) not between 1 and 200
        or jsonb_typeof(f.value -> 'uploadedAt') is distinct from 'string'
        or coalesce(length(f.value ->> 'uploadedAt'), 0) not between 1 and 40
        or jsonb_typeof(f.value -> 'path') is distinct from 'string'
        or case when jsonb_typeof(f.value -> 'sizeBytes') = 'number' then
          case when (f.value ->> 'sizeBytes')::numeric % 1 = 0
            then (f.value ->> 'sizeBytes')::numeric else -1 end
          else -1 end not between 0 and 26214400
    )
      or (select count(distinct f.value ->> 'id') from jsonb_array_elements(v_files) f (value))
        <> jsonb_array_length(v_files)
      or (select count(distinct f.value ->> 'path') from jsonb_array_elements(v_files) f (value))
        <> jsonb_array_length(v_files) then
      raise exception 'invalid_object' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_files) f (value)
      where not (
        left(f.value ->> 'path', 37) = v_owner::text || '/'
        and length(f.value ->> 'path') between 38 and 300
      )
    ) then
      raise exception 'invalid_path' using errcode = '22023';
    end if;
  end if;

  if octet_length(v_data::text) > 32768 then
    raise exception 'too_large' using errcode = '22023';
  end if;

  execute format(
    'insert into public.%I (owner, id, data, schema_version) values ($1, $2, $3, $4) '
      'on conflict (owner, id) do update set data = excluded.data, '
      'schema_version = excluded.schema_version, updated_at = now()',
    v_table
  ) using v_owner, v_id, v_data, p_schema_version;

  if p_kind <> 'wishItem' then
    with gone as (
      delete from public.photos p
      where p.owner = v_owner and p.item_kind = p_kind and p.item_id = v_id
        and not exists (select 1 from jsonb_array_elements_text(v_photos) e (path) where e.path = p.path)
      returning p.path
    )
    select coalesce(jsonb_agg(jsonb_build_object('bucket', 'photos', 'path', g.path)), '[]')
      into v_gone from gone g;
    v_released := v_released || v_gone;
    insert into public.photos (owner, path, item_kind, item_id, position)
      select v_owner, e.path, p_kind, v_id, (e.n - 1)::integer
      from jsonb_array_elements_text(v_photos) with ordinality e (path, n)
    on conflict (owner, path) do update
      set item_kind = excluded.item_kind, item_id = excluded.item_id, position = excluded.position;
  end if;

  if p_kind = 'diorama' then
    with gone as (
      delete from public.studio_files s
      where s.owner = v_owner and s.diorama_id = v_id
        and not exists (
          select 1 from jsonb_array_elements(v_files) f (value)
          where f.value ->> 'id' = s.id and f.value ->> 'path' = s.path
        )
      returning s.path
    )
    select coalesce(jsonb_agg(jsonb_build_object('bucket', 'studio-files', 'path', g.path)), '[]')
      into v_gone from gone g;
    v_released := v_released || v_gone;
    insert into public.studio_files
      (owner, id, diorama_id, file_name, size_bytes, uploaded_at, path, position)
      select v_owner, f.value ->> 'id', v_id, f.value ->> 'fileName',
        (f.value ->> 'sizeBytes')::bigint, f.value ->> 'uploadedAt', f.value ->> 'path',
        (f.n - 1)::integer
      from jsonb_array_elements(v_files) with ordinality f (value, n)
    on conflict (owner, id) do update
      set diorama_id = excluded.diorama_id, file_name = excluded.file_name,
        size_bytes = excluded.size_bytes, uploaded_at = excluded.uploaded_at,
        path = excluded.path, position = excluded.position;
  end if;

  return jsonb_build_object('releasedFiles', v_released);
end;
$$;

/**
 * Deletes an object with its photos (and a diorama's Studio files); answers like `save_object`.
 * F8: the figures of a deleted diorama stay and are "ohne Diorama" again. A deleted set stays the
 * catalog's "Stammt aus Set" at its figures, only the link to the own set goes.
 */
create function public.delete_object(p_kind text, p_id text)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_table text := case p_kind
    when 'minifig' then 'minifigs'
    when 'legoSet' then 'lego_sets'
    when 'specialPart' then 'special_parts'
    when 'diorama' then 'dioramas'
    when 'wishItem' then 'wish_items'
  end;
  v_released jsonb := '[]';
  v_gone jsonb;
begin
  if v_owner is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if v_table is null or p_id is null then
    raise exception 'invalid_object' using errcode = '22023';
  end if;

  if p_kind <> 'wishItem' then
    with gone as (
      delete from public.photos p
      where p.owner = v_owner and p.item_kind = p_kind and p.item_id = p_id
      returning p.path
    )
    select coalesce(jsonb_agg(jsonb_build_object('bucket', 'photos', 'path', g.path)), '[]')
      into v_gone from gone g;
    v_released := v_released || v_gone;
  end if;

  if p_kind = 'diorama' then
    with gone as (
      delete from public.studio_files s
      where s.owner = v_owner and s.diorama_id = p_id
      returning s.path
    )
    select coalesce(jsonb_agg(jsonb_build_object('bucket', 'studio-files', 'path', g.path)), '[]')
      into v_gone from gone g;
    v_released := v_released || v_gone;
    update public.minifigs m
      set data = m.data - 'dioramaId', updated_at = now()
      where m.owner = v_owner and m.data ->> 'dioramaId' = p_id;
  end if;

  if p_kind = 'legoSet' then
    update public.minifigs m
      set data = case
          when (m.data #- '{fromSet,setId}') -> 'fromSet' = '{}'::jsonb then m.data - 'fromSet'
          else m.data #- '{fromSet,setId}'
        end,
        updated_at = now()
      where m.owner = v_owner and m.data #>> '{fromSet,setId}' = p_id;
  end if;

  execute format('delete from public.%I o where o.owner = $1 and o.id = $2', v_table)
    using v_owner, p_id;
  return jsonb_build_object('releasedFiles', v_released);
end;
$$;

/** Saves a price point; a second point for the same item and day replaces the first. */
create function public.save_price_point(p_point jsonb)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_date date;
begin
  if v_owner is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if jsonb_typeof(p_point) is distinct from 'object'
    or coalesce(p_point ->> 'itemType', '') not in ('minifig', 'legoSet', 'specialPart')
    or jsonb_typeof(p_point -> 'bricklinkId') is distinct from 'string'
    or coalesce(length(p_point ->> 'bricklinkId'), 0) not between 1 and 100
    or jsonb_typeof(p_point -> 'date') is distinct from 'string'
    or coalesce(p_point ->> 'date', '') !~ '^\d{4}-\d{2}-\d{2}$'
    or p_point ->> 'source' is distinct from 'bricklink'
    or jsonb_typeof(p_point -> 'cents') is distinct from 'object' then
    raise exception 'invalid_object' using errcode = '22023';
  end if;
  begin
    v_date := (p_point ->> 'date')::date;
  exception when others then
    raise exception 'invalid_object' using errcode = '22023';
  end;
  if to_char(v_date, 'YYYY-MM-DD') <> p_point ->> 'date' then
    raise exception 'invalid_object' using errcode = '22023';
  end if;
  if octet_length(p_point::text) > 4096 then
    raise exception 'too_large' using errcode = '22023';
  end if;
  insert into public.price_points (owner, item_type, bricklink_id, date, data)
    values (v_owner, p_point ->> 'itemType', p_point ->> 'bricklinkId', v_date, p_point)
  on conflict (owner, item_type, bricklink_id, date) do update set data = excluded.data;
end;
$$;

-- Loading ----------------------------------------------------------------------------------------

/**
 * The whole collection of the signed-in person in one answer (no row limit of the API):
 * `{minifigs, sets, specialParts, dioramas, wishlist, prices}`, objects with their photos (and
 * Studio files) in order, every list sorted by id (byte order, like the fake).
 */
create function public.load_collection()
returns jsonb
language sql stable security invoker set search_path = '' as $$
  with me as (select auth.uid() as owner)
  select jsonb_build_object(
    'minifigs', coalesce((
      select jsonb_agg(o.data || jsonb_build_object('photos', coalesce((
        select jsonb_agg(p.path order by p.position)
        from public.photos p
        where p.owner = o.owner and p.item_kind = 'minifig' and p.item_id = o.id
      ), '[]')) order by o.id collate "C")
      from public.minifigs o, me where o.owner = me.owner
    ), '[]'),
    'sets', coalesce((
      select jsonb_agg(o.data || jsonb_build_object('photos', coalesce((
        select jsonb_agg(p.path order by p.position)
        from public.photos p
        where p.owner = o.owner and p.item_kind = 'legoSet' and p.item_id = o.id
      ), '[]')) order by o.id collate "C")
      from public.lego_sets o, me where o.owner = me.owner
    ), '[]'),
    'specialParts', coalesce((
      select jsonb_agg(o.data || jsonb_build_object('photos', coalesce((
        select jsonb_agg(p.path order by p.position)
        from public.photos p
        where p.owner = o.owner and p.item_kind = 'specialPart' and p.item_id = o.id
      ), '[]')) order by o.id collate "C")
      from public.special_parts o, me where o.owner = me.owner
    ), '[]'),
    'dioramas', coalesce((
      select jsonb_agg(o.data || jsonb_build_object(
        'photos', coalesce((
          select jsonb_agg(p.path order by p.position)
          from public.photos p
          where p.owner = o.owner and p.item_kind = 'diorama' and p.item_id = o.id
        ), '[]'),
        'studioFiles', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', s.id, 'fileName', s.file_name, 'sizeBytes', s.size_bytes,
            'uploadedAt', s.uploaded_at, 'path', s.path
          ) order by s.position)
          from public.studio_files s
          where s.owner = o.owner and s.diorama_id = o.id
        ), '[]')
      ) order by o.id collate "C")
      from public.dioramas o, me where o.owner = me.owner
    ), '[]'),
    'wishlist', coalesce((
      select jsonb_agg(o.data order by o.id collate "C")
      from public.wish_items o, me where o.owner = me.owner
    ), '[]'),
    'prices', coalesce((
      select jsonb_agg(pp.data order by pp.item_type collate "C", pp.bricklink_id collate "C", pp.date)
      from public.price_points pp, me where pp.owner = me.owner
    ), '[]')
  );
$$;

/** Answers `true`, without sign-in and without data: the daily keepalive (workflow `keepalive`). */
create function public.ping()
returns boolean
language sql stable security invoker set search_path = '' as $$
  select true;
$$;

revoke all on function public.save_object(text, jsonb, integer) from public, anon, authenticated;
revoke all on function public.delete_object(text, text) from public, anon, authenticated;
revoke all on function public.save_price_point(jsonb) from public, anon, authenticated;
revoke all on function public.load_collection() from public, anon, authenticated;
revoke all on function public.ping() from public, anon, authenticated;
grant execute on function public.save_object(text, jsonb, integer) to authenticated;
grant execute on function public.delete_object(text, text) to authenticated;
grant execute on function public.save_price_point(jsonb) to authenticated;
grant execute on function public.load_collection() to authenticated;
grant execute on function public.ping() to anon, authenticated;

-- Storage: two private buckets, every file under `<owner>/…`, owner only -------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos', 'photos', false, 2097152, array['image/webp', 'image/jpeg', 'image/png']),
  ('studio-files', 'studio-files', false, 26214400, array['application/octet-stream'])
on conflict (id) do update
  set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy stud_stephan_owner_only on storage.objects for all to authenticated
  using (
    bucket_id in ('photos', 'studio-files')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('photos', 'studio-files')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
