-- =============================================================================
-- Family Hub — Phase 3: shared calendar (events, event types, attendees)
--
--   * Events can be all-day or timed, span several days, and repeat
--     (daily / weekly / fortnightly / monthly / yearly — e.g. birthdays).
--   * Times are "wall clock" times in the family's time zone.
--   * One date of a repeating event can be skipped (event_exceptions).
--   * Same security model as tasks: family members read; admins (or members
--     if allowed) create; admins or the creator edit/delete.
-- =============================================================================

create table if not exists public.event_types (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 30),
  emoji      text not null default '📌' check (char_length(emoji) between 1 and 16),
  colour     text not null default '#0072B2' check (colour ~ '^#[0-9A-Fa-f]{6}$'),
  sort       smallint not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists event_types_family_idx on public.event_types (family_id);

create table if not exists public.events (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references public.families (id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 100),
  type_id          uuid references public.event_types (id) on delete set null,
  start_date       date not null,
  end_date         date not null,
  all_day          boolean not null default true,
  start_time       time,
  end_time         time,
  -- Free text. May hold "enc:..." ciphertext when end-to-end encryption is on.
  location         text not null default '' check (char_length(location) <= 2000),
  notes            text not null default '' check (char_length(notes) <= 6000),
  colour           text check (colour is null or colour ~ '^#[0-9A-Fa-f]{6}$'),
  repeat           text not null default 'once'
                   check (repeat in ('once', 'daily', 'weekly', 'fortnightly', 'monthly', 'yearly')),
  repeat_until     date,
  reminder_minutes integer check (reminder_minutes is null or reminder_minutes between 0 and 20160),
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint events_dates_valid check (end_date >= start_date and end_date - start_date <= 366),
  constraint events_times_valid check (all_day or start_time is not null)
);
create index if not exists events_family_idx on public.events (family_id, start_date);

create table if not exists public.event_attendees (
  event_id  uuid not null references public.events (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  added_by  uuid references public.profiles (id) on delete set null,
  added_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists event_attendees_family_idx on public.event_attendees (family_id);

-- Skipped dates of a repeating event ("delete just this one").
create table if not exists public.event_exceptions (
  event_id  uuid not null references public.events (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  skip_date date not null,
  primary key (event_id, skip_date)
);

-- -----------------------------------------------------------------------------
-- Helpers + triggers
-- -----------------------------------------------------------------------------
create or replace function public.can_manage_event(eid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events e
    where e.id = eid and (
      public.is_family_admin(e.family_id)
      or (e.created_by = (select auth.uid()) and public.can_add(e.family_id, 'events'))
    )
  );
$$;

create or replace function public.validate_event()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.title := public.clean_text(new.title, 100);
  new.location := public.clean_text(new.location, 2000);
  new.notes := public.clean_text(new.notes, 6000);
  if new.title = '' then raise exception 'Event title is required'; end if;
  if new.end_date is null then new.end_date := new.start_date; end if;
  if new.all_day then
    new.start_time := null;
    new.end_time := null;
  elsif new.end_time is not null and new.end_date = new.start_date and new.end_time < new.start_time then
    raise exception 'The event ends before it starts';
  end if;
  if new.repeat = 'once' then new.repeat_until := null; end if;
  if new.type_id is not null and not exists (
    select 1 from public.event_types t where t.id = new.type_id and t.family_id = new.family_id) then
    raise exception 'Event type belongs to another family';
  end if;
  if tg_op = 'UPDATE' then
    new.family_id := old.family_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists events_validate on public.events;
create trigger events_validate before insert or update on public.events
  for each row execute function public.validate_event();

create or replace function public.validate_event_type()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.name := public.clean_text(new.name, 30);
  new.emoji := coalesce(nullif(public.clean_text(new.emoji, 16), ''), '📌');
  if new.name = '' then raise exception 'Name is required'; end if;
  if tg_op = 'UPDATE' then new.family_id := old.family_id; new.created_by := old.created_by; end if;
  return new;
end $$;
drop trigger if exists event_types_validate on public.event_types;
create trigger event_types_validate before insert or update on public.event_types
  for each row execute function public.validate_event_type();

create or replace function public.event_child_family()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select e.family_id into new.family_id from public.events e where e.id = new.event_id;
  return new;
end $$;
drop trigger if exists event_attendees_family on public.event_attendees;
create trigger event_attendees_family before insert or update on public.event_attendees
  for each row execute function public.event_child_family();
drop trigger if exists event_exceptions_family on public.event_exceptions;
create trigger event_exceptions_family before insert or update on public.event_exceptions
  for each row execute function public.event_child_family();

-- Default event types for every family (new and existing).
create or replace function public.add_default_event_types(fid uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.event_types (family_id, name, emoji, colour, sort)
  select fid, v.name, v.emoji, v.colour, v.sort
  from (values
    ('Birthday', '🎂', '#E5446D', 1), ('Party', '🎉', '#CC79A7', 2), ('Dinner', '🍽️', '#E69F00', 3),
    ('Holiday / trip', '✈️', '#56B4E9', 4), ('Appointment', '🩺', '#D55E00', 5), ('School', '🏫', '#7B61FF', 6),
    ('Sport', '⚽', '#009E73', 7), ('Other', '📌', '#0072B2', 8)
  ) as v(name, emoji, colour, sort)
  where not exists (select 1 from public.event_types t where t.family_id = fid);
$$;

create or replace function public.families_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.add_default_categories(new.id);
  perform public.add_default_event_types(new.id);
  return new;
end $$;

select public.add_default_event_types(id) from public.families;

-- -----------------------------------------------------------------------------
-- RPCs: create / update an event with its attendees (atomic, RLS applies)
-- -----------------------------------------------------------------------------
create or replace function public.apply_event_fields(e public.events, d jsonb)
returns public.events language plpgsql immutable set search_path = '' as $$
begin
  if d ? 'title' then e.title := d ->> 'title'; end if;
  if d ? 'type_id' then e.type_id := nullif(d ->> 'type_id', '')::uuid; end if;
  if d ? 'start_date' then e.start_date := (d ->> 'start_date')::date; end if;
  if d ? 'end_date' then e.end_date := nullif(d ->> 'end_date', '')::date; end if;
  if d ? 'all_day' then e.all_day := (d ->> 'all_day')::boolean; end if;
  if d ? 'start_time' then e.start_time := nullif(d ->> 'start_time', '')::time; end if;
  if d ? 'end_time' then e.end_time := nullif(d ->> 'end_time', '')::time; end if;
  if d ? 'location' then e.location := coalesce(d ->> 'location', ''); end if;
  if d ? 'notes' then e.notes := coalesce(d ->> 'notes', ''); end if;
  if d ? 'colour' then e.colour := nullif(d ->> 'colour', ''); end if;
  if d ? 'repeat' then e.repeat := d ->> 'repeat'; end if;
  if d ? 'repeat_until' then e.repeat_until := nullif(d ->> 'repeat_until', '')::date; end if;
  if d ? 'reminder_minutes' then e.reminder_minutes := nullif(d ->> 'reminder_minutes', '')::int; end if;
  return e;
end $$;

create or replace function public.set_event_attendees(p_event uuid, p_attendees uuid[])
returns void language plpgsql set search_path = '' as $$
begin
  delete from public.event_attendees where event_id = p_event and not (user_id = any (coalesce(p_attendees, '{}')));
  insert into public.event_attendees (event_id, user_id, added_by)
  select p_event, u, auth.uid() from unnest(coalesce(p_attendees, '{}')) u
  on conflict (event_id, user_id) do nothing;
end $$;

create or replace function public.create_event(p_family uuid, p_data jsonb, p_attendees uuid[] default '{}')
returns uuid language plpgsql set search_path = '' as $$
declare e public.events;
begin
  e.family_id := p_family;
  e.created_by := auth.uid();
  e.start_date := public.family_today(p_family);
  e.all_day := true;
  e.location := '';
  e.notes := '';
  e.repeat := 'once';
  e := public.apply_event_fields(e, p_data);
  insert into public.events (family_id, title, type_id, start_date, end_date, all_day, start_time, end_time,
                             location, notes, colour, repeat, repeat_until, reminder_minutes, created_by)
  values (e.family_id, e.title, e.type_id, e.start_date, coalesce(e.end_date, e.start_date), e.all_day, e.start_time,
          e.end_time, e.location, e.notes, e.colour, e.repeat, e.repeat_until, e.reminder_minutes, e.created_by)
  returning id into e.id;
  perform public.set_event_attendees(e.id, p_attendees);
  return e.id;
end $$;

create or replace function public.update_event(p_event uuid, p_data jsonb, p_attendees uuid[] default null)
returns uuid language plpgsql set search_path = '' as $$
declare e public.events;
begin
  select * into e from public.events where id = p_event;
  if not found then raise exception 'Event not found'; end if;
  if not public.can_manage_event(p_event) then raise exception 'You can’t edit this event' using errcode = '42501'; end if;
  e := public.apply_event_fields(e, p_data);
  update public.events set
    title = e.title, type_id = e.type_id, start_date = e.start_date, end_date = coalesce(e.end_date, e.start_date),
    all_day = e.all_day, start_time = e.start_time, end_time = e.end_time, location = e.location, notes = e.notes,
    colour = e.colour, repeat = e.repeat, repeat_until = e.repeat_until, reminder_minutes = e.reminder_minutes
  where id = p_event;
  if p_attendees is not null then perform public.set_event_attendees(p_event, p_attendees); end if;
  return p_event;
end $$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.event_types      enable row level security;
alter table public.events           enable row level security;
alter table public.event_attendees  enable row level security;
alter table public.event_exceptions enable row level security;

drop policy if exists event_types_select on public.event_types;
create policy event_types_select on public.event_types for select to authenticated
  using (public.is_family_member(family_id));
drop policy if exists event_types_insert on public.event_types;
create policy event_types_insert on public.event_types for insert to authenticated
  with check (public.can_add(family_id, 'events') and created_by = (select auth.uid()));
drop policy if exists event_types_update on public.event_types;
create policy event_types_update on public.event_types for update to authenticated
  using (public.is_family_admin(family_id) or (created_by = (select auth.uid()) and public.can_add(family_id, 'events')))
  with check (public.is_family_member(family_id));
drop policy if exists event_types_delete on public.event_types;
create policy event_types_delete on public.event_types for delete to authenticated
  using (public.is_family_admin(family_id) or (created_by = (select auth.uid()) and public.can_add(family_id, 'events')));

drop policy if exists events_select on public.events;
create policy events_select on public.events for select to authenticated
  using (public.is_family_member(family_id));
drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert to authenticated
  with check (public.can_add(family_id, 'events') and created_by = (select auth.uid()));
drop policy if exists events_update on public.events;
create policy events_update on public.events for update to authenticated
  using (public.can_manage_event(id)) with check (public.is_family_member(family_id));
drop policy if exists events_delete on public.events;
create policy events_delete on public.events for delete to authenticated
  using (public.can_manage_event(id));

drop policy if exists event_attendees_select on public.event_attendees;
create policy event_attendees_select on public.event_attendees for select to authenticated
  using (public.is_family_member(family_id));
drop policy if exists event_attendees_insert on public.event_attendees;
create policy event_attendees_insert on public.event_attendees for insert to authenticated
  with check (public.can_manage_event(event_id) and public.user_in_family(family_id, user_id));
drop policy if exists event_attendees_delete on public.event_attendees;
create policy event_attendees_delete on public.event_attendees for delete to authenticated
  using (public.can_manage_event(event_id));

drop policy if exists event_exceptions_select on public.event_exceptions;
create policy event_exceptions_select on public.event_exceptions for select to authenticated
  using (public.is_family_member(family_id));
drop policy if exists event_exceptions_insert on public.event_exceptions;
create policy event_exceptions_insert on public.event_exceptions for insert to authenticated
  with check (public.can_manage_event(event_id));
drop policy if exists event_exceptions_delete on public.event_exceptions;
create policy event_exceptions_delete on public.event_exceptions for delete to authenticated
  using (public.can_manage_event(event_id));

-- -----------------------------------------------------------------------------
-- Privileges + realtime
-- -----------------------------------------------------------------------------
revoke all on public.event_types, public.events, public.event_attendees, public.event_exceptions from anon;
revoke all on function
  public.can_manage_event(uuid), public.add_default_event_types(uuid), public.apply_event_fields(public.events, jsonb),
  public.set_event_attendees(uuid, uuid[]), public.create_event(uuid, jsonb, uuid[]), public.update_event(uuid, jsonb, uuid[])
from anon, public;
grant execute on function
  public.can_manage_event(uuid), public.apply_event_fields(public.events, jsonb), public.set_event_attendees(uuid, uuid[]),
  public.create_event(uuid, jsonb, uuid[]), public.update_event(uuid, jsonb, uuid[])
to authenticated;

do $$
declare t text;
begin
  foreach t in array array['event_types', 'events', 'event_attendees', 'event_exceptions'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
