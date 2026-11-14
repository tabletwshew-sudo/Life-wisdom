-- =============================================================================
-- Family Hub — Phase 6: optional end-to-end encryption of private text
--
-- What is encrypted (in the browser, before it is sent):
--   task notes, event notes, event locations, recipe notes
-- Stored as "enc:v1:<base64 of 12-byte IV + AES-256-GCM ciphertext>".
--
-- Keys (the server never sees a usable key):
--   * user_public_keys   – each person's RSA-OAEP public key (family can read it)
--   * user_private_keys  – each person's private key, encrypted with a key
--                          derived from their login password (PBKDF2-SHA-256)
--   * family_keys        – the family's AES key, encrypted ("wrapped") once for
--                          each member's public key
--   * family_recovery    – the family key wrapped with the family recovery code
-- =============================================================================

-- Valid ciphertext passes through text cleaning untouched (never trimmed or cut).
create or replace function public.clean_text(t text, max_len int)
returns text language sql immutable set search_path = '' as $$
  select case
    when t ~ '^enc:v1:[A-Za-z0-9+/]+={0,2}$' and char_length(t) <= 16000 then t
    else left(btrim(regexp_replace(coalesce(t, ''), '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g')), max_len)
  end;
$$;

-- Encrypted text is longer than plain text: allow room for it.
alter table public.tasks   drop constraint if exists tasks_notes_check;
alter table public.tasks   add  constraint tasks_notes_check   check (char_length(notes) <= 16000);
alter table public.events  drop constraint if exists events_notes_check;
alter table public.events  add  constraint events_notes_check  check (char_length(notes) <= 16000);
alter table public.events  drop constraint if exists events_location_check;
alter table public.events  add  constraint events_location_check check (char_length(location) <= 4000);
alter table public.recipes drop constraint if exists recipes_notes_check;
alter table public.recipes add  constraint recipes_notes_check check (char_length(notes) <= 16000);

-- -----------------------------------------------------------------------------
-- Key tables
-- -----------------------------------------------------------------------------
create table if not exists public.user_public_keys (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  public_key text not null check (char_length(public_key) between 100 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.user_private_keys (
  user_id             uuid primary key references public.profiles (id) on delete cascade,
  wrapped_private_key text not null check (char_length(wrapped_private_key) between 100 and 8000),
  salt                text not null check (char_length(salt) between 16 and 100),
  iv                  text not null check (char_length(iv) between 12 and 40),
  iterations          integer not null check (iterations >= 100000),
  created_at          timestamptz not null default now()
);

create table if not exists public.family_keys (
  family_id   uuid not null,
  user_id     uuid not null,
  wrapped_key text not null check (char_length(wrapped_key) between 100 and 2000),
  wrapped_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (family_id, user_id),
  -- Leaving the family removes that person's copy of the key.
  foreign key (family_id, user_id) references public.family_members (family_id, user_id) on delete cascade
);

create table if not exists public.family_recovery (
  family_id   uuid primary key references public.families (id) on delete cascade,
  wrapped_key text not null check (char_length(wrapped_key) between 20 and 2000),
  salt        text not null check (char_length(salt) between 16 and 100),
  iv          text not null check (char_length(iv) between 12 and 40),
  iterations  integer not null check (iterations >= 100000),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.user_public_keys  enable row level security;
alter table public.user_private_keys enable row level security;
alter table public.family_keys       enable row level security;
alter table public.family_recovery   enable row level security;

-- Public keys: readable by people you share a family with (so admins can share
-- the family key with you). Only you can create or replace yours.
drop policy if exists user_public_keys_select on public.user_public_keys;
create policy user_public_keys_select on public.user_public_keys for select to authenticated
  using (user_id = (select auth.uid()) or public.shares_family_with(user_id));
drop policy if exists user_public_keys_write on public.user_public_keys;
create policy user_public_keys_write on public.user_public_keys for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Private keys (password-encrypted): only the owner, ever.
drop policy if exists user_private_keys_own on public.user_private_keys;
create policy user_private_keys_own on public.user_private_keys for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Family key copies: you read your own; admins can see who has one and share it.
drop policy if exists family_keys_select on public.family_keys;
create policy family_keys_select on public.family_keys for select to authenticated
  using (user_id = (select auth.uid()) or public.is_family_admin(family_id));
drop policy if exists family_keys_insert on public.family_keys;
create policy family_keys_insert on public.family_keys for insert to authenticated
  with check (public.is_family_admin(family_id) and wrapped_by = (select auth.uid()) and public.user_in_family(family_id, user_id));
drop policy if exists family_keys_delete on public.family_keys;
create policy family_keys_delete on public.family_keys for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_family_admin(family_id));

-- Recovery copy: admins only.
drop policy if exists family_recovery_admin on public.family_recovery;
create policy family_recovery_admin on public.family_recovery for all to authenticated
  using (public.is_family_admin(family_id))
  with check (public.is_family_admin(family_id) and created_by = (select auth.uid()));

revoke all on public.user_public_keys, public.user_private_keys, public.family_keys, public.family_recovery from anon;

do $$
declare t text;
begin
  foreach t in array array['family_keys', 'user_public_keys'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
