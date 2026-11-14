-- =============================================================================
-- Family Hub — keep-alive. The "Keep Supabase awake" GitHub Action calls this
-- every 2 days so the free project never pauses. It returns only the time and
-- reads no family data, so it's safe for the public (anon) key.
-- =============================================================================
create or replace function public.keep_alive()
returns timestamptz language sql stable set search_path = '' as $$
  select now();
$$;

revoke all on function public.keep_alive() from public;
grant execute on function public.keep_alive() to anon, authenticated;
