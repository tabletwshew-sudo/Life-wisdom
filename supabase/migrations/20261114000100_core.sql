-- =============================================================================
-- Family Hub — Phase 1: core schema (profiles, families, members, invites)
--
-- Security model
--   * Row Level Security (RLS) is ON for every table.
--   * A signed-in user can only read/write rows that belong to a family they
--     are a member of. Anonymous (signed-out) visitors can read nothing.
--   * Membership changes (create / join / role change / remove) only happen
--     through the SECURITY DEFINER functions below, which do their own checks.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

do $$ begin
  create type public.family_role as enum ('admin', 'member');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default ''
               check (char_length(display_name) <= 40),
  emoji        text not null default '🙂'
               check (char_length(emoji) between 1 and 16),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.families (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null check (char_length(btrim(name)) between 1 and 60),
  timezone                  text not null default 'Europe/London'
                            check (char_length(timezone) <= 64),
  -- 0 = Sunday, 1 = Monday, 6 = Saturday
  week_starts_on            smallint not null default 1 check (week_starts_on in (0, 1, 6)),
  -- What "member" (kid) accounts may create. Admins can always create.
  members_can_add_tasks     boolean not null default false,
  members_can_add_events    boolean not null default false,
  members_can_add_recipes   boolean not null default true,
  members_can_add_shopping  boolean not null default true,
  points_enabled            boolean not null default true,
  encryption_enabled        boolean not null default false,
  created_by                uuid references auth.users (id) on delete set null,
  created_at                timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id  uuid not null references public.families (id) on delete cascade,
  -- References profiles (which cascades from auth.users) so the API can join them.
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.family_role not null default 'member',
  colour     text not null default '#0072B2' check (colour ~ '^#[0-9A-Fa-f]{6}$'),
  joined_at  timestamptz not null default now(),
  primary key (family_id, user_id)
);
create index if not exists family_members_user_idx on public.family_members (user_id);

-- Kept in its own table so that only admins can read the code.
create table if not exists public.family_invites (
  family_id  uuid primary key references public.families (id) on delete cascade,
  code       text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  created_at timestamptz not null default now()
);

-- Brute-force protection for invite codes.
create table if not exists public.join_attempts (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  success    boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists join_attempts_user_idx on public.join_attempts (user_id, created_at);

-- -----------------------------------------------------------------------------
-- Helper functions used by RLS policies.
-- SECURITY DEFINER so they can look at family_members without recursion.
-- -----------------------------------------------------------------------------

create or replace function public.is_family_member(fid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_members m
    where m.family_id = fid and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_family_admin(fid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_members m
    where m.family_id = fid and m.user_id = (select auth.uid()) and m.role = 'admin'
  );
$$;

create or replace function public.shares_family_with(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.family_members a
    join public.family_members b on a.family_id = b.family_id
    where a.user_id = (select auth.uid()) and b.user_id = uid
  );
$$;

-- Clean up free text: trim, collapse control characters, cap length.
create or replace function public.clean_text(t text, max_len int)
returns text language sql immutable set search_path = '' as $$
  select left(btrim(regexp_replace(coalesce(t, ''), '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g')), max_len);
$$;

create or replace function public.generate_invite_code()
returns text language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no I, O, 0, 1
  v_code text;
  b bytea;
begin
  loop
    b := extensions.gen_random_bytes(8);
    v_code := '';
    for i in 0..7 loop
      v_code := v_code || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.family_invites fi where fi.code = v_code);
  end loop;
  return v_code;
end $$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Create a profile row automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, emoji)
  values (
    new.id,
    public.clean_text(new.raw_user_meta_data ->> 'display_name', 40),
    coalesce(nullif(public.clean_text(new.raw_user_meta_data ->> 'emoji', 16), ''), '🙂')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Validate family fields and keep created_by immutable.
create or replace function public.validate_family()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.name := public.clean_text(new.name, 60);
  if new.name = '' then raise exception 'Family name is required'; end if;
  -- Throws if the time zone name is not valid.
  perform now() at time zone new.timezone;
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

drop trigger if exists families_validate on public.families;
create trigger families_validate before insert or update on public.families
  for each row execute function public.validate_family();

create or replace function public.validate_profile()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.display_name := public.clean_text(new.display_name, 40);
  new.emoji := coalesce(nullif(public.clean_text(new.emoji, 16), ''), '🙂');
  if tg_op = 'UPDATE' then new.created_at := old.created_at; end if;
  return new;
end $$;

drop trigger if exists profiles_validate on public.profiles;
create trigger profiles_validate before insert or update on public.profiles
  for each row execute function public.validate_profile();

-- -----------------------------------------------------------------------------
-- RPC functions (the only way to change membership)
-- -----------------------------------------------------------------------------

create or replace function public.create_family(p_name text, p_colour text default '#0072B2', p_timezone text default 'Europe/London')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  fid uuid;
begin
  if uid is null then raise exception 'You need to be signed in' using errcode = '28000'; end if;
  if (select count(*) from public.families f where f.created_by = uid) >= 5 then
    raise exception 'You have created the maximum number of families (5)';
  end if;
  insert into public.families (name, timezone, created_by)
  values (p_name, coalesce(nullif(btrim(p_timezone), ''), 'Europe/London'), uid)
  returning id into fid;
  insert into public.family_members (family_id, user_id, role, colour)
  values (fid, uid, 'admin', coalesce(p_colour, '#0072B2'));
  insert into public.family_invites (family_id, code)
  values (fid, public.generate_invite_code());
  return fid;
end $$;

-- Returns the family id, or NULL if the code is wrong.
create or replace function public.join_family(p_code text, p_colour text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  fid uuid;
  v_colour text;
  palette constant text[] := array['#0072B2','#E69F00','#009E73','#CC79A7','#D55E00','#56B4E9','#7B61FF','#F0C808','#1B998B','#E5446D'];
begin
  if uid is null then raise exception 'You need to be signed in' using errcode = '28000'; end if;

  if (select count(*) from public.join_attempts a
      where a.user_id = uid and not a.success and a.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many wrong codes. Please wait an hour and try again.';
  end if;

  select fi.family_id into fid from public.family_invites fi where fi.code = v_code;
  insert into public.join_attempts (user_id, success) values (uid, fid is not null);
  if fid is null then return null; end if;

  if exists (select 1 from public.family_members m where m.family_id = fid and m.user_id = uid) then
    return fid;
  end if;

  if (select count(*) from public.family_members m where m.family_id = fid) >= 20 then
    raise exception 'This family is full (20 members maximum)';
  end if;

  v_colour := p_colour;
  if v_colour is null or v_colour !~ '^#[0-9A-Fa-f]{6}$' then
    select c into v_colour from unnest(palette) as c
    where c not in (select m.colour from public.family_members m where m.family_id = fid)
    limit 1;
  end if;

  insert into public.family_members (family_id, user_id, role, colour)
  values (fid, uid, 'member', coalesce(v_colour, palette[1]));
  return fid;
end $$;

create or replace function public.regenerate_invite_code(p_family uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if not public.is_family_admin(p_family) then raise exception 'Only admins can do this' using errcode = '42501'; end if;
  v_code := public.generate_invite_code();
  update public.family_invites set code = v_code, created_at = now() where family_id = p_family;
  return v_code;
end $$;

-- Admins can change anyone's role/colour. Members can only change their own colour.
create or replace function public.update_member(p_family uuid, p_user uuid, p_role public.family_role default null, p_colour text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  admin boolean := public.is_family_admin(p_family);
begin
  if not public.is_family_member(p_family) then raise exception 'Not a member of this family' using errcode = '42501'; end if;
  if p_role is not null and not admin then raise exception 'Only admins can change roles' using errcode = '42501'; end if;
  if p_user <> uid and not admin then raise exception 'Only admins can change other members' using errcode = '42501'; end if;
  if p_colour is not null and p_colour !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Invalid colour'; end if;

  if p_role = 'member' and (select role from public.family_members where family_id = p_family and user_id = p_user) = 'admin'
     and (select count(*) from public.family_members where family_id = p_family and role = 'admin') <= 1 then
    raise exception 'A family needs at least one admin';
  end if;

  update public.family_members
     set role = coalesce(p_role, role), colour = coalesce(p_colour, colour)
   where family_id = p_family and user_id = p_user;
end $$;

-- Admins can remove anyone; anyone can remove themselves (leave the family).
create or replace function public.remove_member(p_family uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if p_user <> uid and not public.is_family_admin(p_family) then
    raise exception 'Only admins can remove other members' using errcode = '42501';
  end if;
  if (select role from public.family_members where family_id = p_family and user_id = p_user) = 'admin'
     and (select count(*) from public.family_members where family_id = p_family and role = 'admin') <= 1
     and (select count(*) from public.family_members where family_id = p_family) > 1 then
    raise exception 'Make someone else an admin first';
  end if;
  delete from public.family_members where family_id = p_family and user_id = p_user;
  -- Last person out: remove the family and all its data.
  if not exists (select 1 from public.family_members where family_id = p_family) then
    delete from public.families where id = p_family;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.families       enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invites enable row level security;
alter table public.join_attempts  enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_family_with(id));
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- families (insert only via create_family())
drop policy if exists families_select on public.families;
create policy families_select on public.families for select to authenticated
  using (public.is_family_member(id));
drop policy if exists families_update on public.families;
create policy families_update on public.families for update to authenticated
  using (public.is_family_admin(id)) with check (public.is_family_admin(id));
drop policy if exists families_delete on public.families;
create policy families_delete on public.families for delete to authenticated
  using (public.is_family_admin(id));

-- family_members (changes only via RPC functions)
drop policy if exists family_members_select on public.family_members;
create policy family_members_select on public.family_members for select to authenticated
  using (public.is_family_member(family_id));

-- family_invites: only admins can see the code
drop policy if exists family_invites_select on public.family_invites;
create policy family_invites_select on public.family_invites for select to authenticated
  using (public.is_family_admin(family_id));

-- join_attempts: no policies = no direct access at all.

-- -----------------------------------------------------------------------------
-- Privileges: signed-out visitors get nothing; RPCs only for signed-in users.
-- -----------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon, public;

grant execute on function
  public.is_family_member(uuid), public.is_family_admin(uuid), public.shares_family_with(uuid),
  public.create_family(text, text, text), public.join_family(text, text),
  public.regenerate_invite_code(uuid), public.update_member(uuid, uuid, public.family_role, text),
  public.remove_member(uuid, uuid)
to authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- -----------------------------------------------------------------------------
-- Realtime: live updates for these tables (RLS still applies).
-- -----------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['profiles', 'families', 'family_members'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
