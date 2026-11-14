-- =============================================================================
-- Family Hub — security self-check. Paste into Supabase → SQL Editor → Run.
-- Every row should say ✅. Anything else is worth a look (see SECURITY.md).
-- =============================================================================
with
tables as (
  select c.relname as name, c.relrowsecurity as rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
anon_grants as (
  select table_name from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public'
),
bucket as (select public from storage.buckets where id = 'recipe-photos')
select '1. Row Level Security on every table' as "check",
       case when bool_and(rls) then '✅ all ' || count(*) || ' tables'
            else '❌ missing on: ' || string_agg(name, ', ') filter (where not rls) end as result
from tables
union all
select '2. Signed-out visitors have no table access',
       case when count(*) = 0 then '✅ none' else '❌ anon can access: ' || string_agg(distinct table_name, ', ') end
from anon_grants
union all
select '3. Recipe photos bucket is private',
       case when (select public from bucket) is false then '✅ private'
            when (select public from bucket) is null then '⚠️ bucket not found (run migration 4)'
            else '❌ PUBLIC — make it private' end
union all
select '4. Policies in place',
       '✅ ' || count(*) || ' policies on ' || count(distinct tablename) || ' tables'
from pg_policies where schemaname = 'public'
union all
select '5. Families using end-to-end encryption',
       '✅ ' || count(*) filter (where encryption_enabled) || ' of ' || count(*) || ' (optional)'
from public.families
union all
select '6. Plain text left in encrypted families',
       case when count(*) = 0 then '✅ none'
            else '⚠️ ' || count(*) || ' notes/locations not encrypted yet — open the app as an admin to finish' end
from (
  select t.notes v from public.tasks t join public.families f on f.id = t.family_id where f.encryption_enabled and t.notes <> ''
  union all select e.notes from public.events e join public.families f on f.id = e.family_id where f.encryption_enabled and e.notes <> ''
  union all select e.location from public.events e join public.families f on f.id = e.family_id where f.encryption_enabled and e.location <> ''
  union all select r.notes from public.recipes r join public.families f on f.id = r.family_id where f.encryption_enabled and r.notes <> ''
) x
where v not like 'enc:v1:%'
union all
select '7. Database connection uses TLS (this session)',
       case when (select ssl from pg_stat_ssl where pid = pg_backend_pid()) then '✅ encrypted connection'
            else 'ℹ️ not TLS (normal for the local dev database; Supabase cloud uses TLS)' end;
