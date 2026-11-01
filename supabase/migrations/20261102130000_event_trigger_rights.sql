-- Stud Stephan, after P11: Security Advisor "Public / Signed-In Users Can Execute SECURITY DEFINER
-- Function" for `public.rls_auto_enable()`.
--
-- That function is not from this repo: Supabase puts it into the project when "Enable automatic
-- RLS" is on (chosen at creation, see UMSETZUNG.md P4a). It is the function of an event trigger
-- that switches row level security on for every new table, and it carries Supabase's default
-- grants to `anon` and `authenticated`. The app never calls it, and the event trigger does not
-- need those grants: PostgreSQL does not check EXECUTE when an event trigger fires.
--
-- So: every SECURITY DEFINER function in `public` that is an event trigger function loses EXECUTE
-- for everyone but its owner. Other functions are not touched. Where there is none (the local
-- instance of `check:db`), nothing happens. Written so that it can run twice.

do $$
declare
  v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prosecdef
      and p.prorettype = 'event_trigger'::regtype
  loop
    execute format('revoke all on function %s from public, anon, authenticated', v_function);
  end loop;
end;
$$;
