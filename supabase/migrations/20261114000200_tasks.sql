-- =============================================================================
-- Family Hub — Phase 2: tasks (chores), categories, completions, "NEW" tracking
--
-- How recurring tasks work
--   * A task stores a repeat rule (once / daily / weekdays / weekly /
--     fortnightly / monthly / yearly) starting on `start_date`.
--   * Each day the rule matches is an "occurrence". When someone ticks it off a
--     row is written to task_completions for that date, so ticking today's
--     never ticks tomorrow's.
--   * A past occurrence with no completion is "missed" (red cross). Because
--     history is computed from the rule + completions, it is kept forever.
--   * Changing the schedule of a task that already has history "splits" it:
--     the old task ends yesterday and a new one starts today (update_task()).
--     So editing never rewrites the past.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Categories (shared by tasks now, and events later)
-- -----------------------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 30),
  emoji      text not null default '🏷️' check (char_length(emoji) between 1 and 16),
  colour     text not null default '#0072B2' check (colour ~ '^#[0-9A-Fa-f]{6}$'),
  sort       smallint not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists categories_family_idx on public.categories (family_id);

-- -----------------------------------------------------------------------------
-- Tasks
-- -----------------------------------------------------------------------------
create table if not exists public.tasks (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references public.families (id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 80),
  -- Free text. May hold "enc:..." ciphertext when end-to-end encryption is on.
  notes            text not null default '' check (char_length(notes) <= 6000),
  emoji            text not null default '✅' check (char_length(emoji) between 1 and 16),
  category_id      uuid references public.categories (id) on delete set null,
  colour           text check (colour is null or colour ~ '^#[0-9A-Fa-f]{6}$'),
  start_date       date not null,
  due_time         time,
  repeat           text not null default 'once'
                   check (repeat in ('once', 'daily', 'weekdays', 'weekly', 'fortnightly', 'monthly', 'yearly')),
  -- For repeat = 'weekdays': 0 = Sunday … 6 = Saturday
  repeat_days      smallint[] not null default '{}',
  repeat_until     date,
  -- 'any': one tick for the whole task; 'each': every assignee ticks their own
  completion_mode  text not null default 'each' check (completion_mode in ('any', 'each')),
  points           smallint not null default 1 check (points between 0 and 100),
  -- Minutes before due time (or before 08:00 for untimed tasks). NULL = no reminder.
  reminder_minutes integer check (reminder_minutes is null or reminder_minutes between 0 and 10080),
  archived_at      timestamptz,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint tasks_repeat_days_valid check (repeat_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  constraint tasks_weekdays_need_days check (repeat <> 'weekdays' or cardinality(repeat_days) > 0)
);
create index if not exists tasks_family_idx on public.tasks (family_id);

create table if not exists public.task_assignees (
  task_id     uuid not null references public.tasks (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  family_id   uuid not null references public.families (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index if not exists task_assignees_family_idx on public.task_assignees (family_id);

create table if not exists public.task_completions (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references public.tasks (id) on delete cascade,
  family_id       uuid not null references public.families (id) on delete cascade,
  occurrence_date date not null,
  -- Whose occurrence this is ('each' mode). NULL for 'any' mode tasks.
  for_user        uuid references public.profiles (id) on delete cascade,
  completed_by    uuid references public.profiles (id) on delete set null,
  completed_at    timestamptz not null default now(),
  points          smallint not null default 0
);
create unique index if not exists task_completions_unique
  on public.task_completions (task_id, occurrence_date, coalesce(for_user, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists task_completions_family_date_idx on public.task_completions (family_id, occurrence_date);

-- Which items each person has already looked at (drives the "NEW" badge).
create table if not exists public.seen_items (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  item_type text not null check (item_type in ('task', 'event', 'recipe')),
  item_id   uuid not null,
  seen_at   timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);
create index if not exists seen_items_family_idx on public.seen_items (family_id, user_id);

-- -----------------------------------------------------------------------------
-- Recurrence — must match src/lib/tasks/recurrence.ts (tests compare them).
-- -----------------------------------------------------------------------------
create or replace function public.occurs_on(
  p_repeat text, p_days smallint[], p_start date, p_until date, p_date date
) returns boolean language plpgsql immutable set search_path = '' as $$
declare
  last_dom int;
begin
  if p_date < p_start or (p_until is not null and p_date > p_until) then
    return false;
  end if;
  case p_repeat
    when 'once' then return p_date = p_start;
    when 'daily' then return true;
    when 'weekdays' then return extract(dow from p_date)::smallint = any (p_days);
    when 'weekly' then return (p_date - p_start) % 7 = 0;
    when 'fortnightly' then return (p_date - p_start) % 14 = 0;
    when 'monthly' then
      -- 31st → last day of shorter months
      last_dom := extract(day from (date_trunc('month', p_date) + interval '1 month - 1 day'))::int;
      return extract(day from p_date)::int = least(extract(day from p_start)::int, last_dom);
    when 'yearly' then
      if extract(month from p_date) <> extract(month from p_start) then return false; end if;
      last_dom := extract(day from (date_trunc('month', p_date) + interval '1 month - 1 day'))::int;
      return extract(day from p_date)::int = least(extract(day from p_start)::int, last_dom); -- 29 Feb → 28 Feb
    else return false;
  end case;
end $$;

create or replace function public.task_occurs_on(p_task public.tasks, p_date date)
returns boolean language sql immutable set search_path = '' as $$
  select public.occurs_on(p_task.repeat, p_task.repeat_days, p_task.start_date, p_task.repeat_until, p_date);
$$;

create or replace function public.family_today(fid uuid)
returns date language sql stable security definer set search_path = '' as $$
  select (now() at time zone f.timezone)::date from public.families f where f.id = fid;
$$;

-- -----------------------------------------------------------------------------
-- Permission helpers
-- -----------------------------------------------------------------------------
create or replace function public.can_add(fid uuid, what text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_family_admin(fid) or (
    public.is_family_member(fid) and exists (
      select 1 from public.families f where f.id = fid and case what
        when 'tasks' then f.members_can_add_tasks
        when 'events' then f.members_can_add_events
        when 'recipes' then f.members_can_add_recipes
        when 'shopping' then f.members_can_add_shopping
        else false end
    )
  );
$$;

create or replace function public.user_in_family(fid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.family_members m where m.family_id = fid and m.user_id = uid);
$$;

-- Can the current user manage (edit/delete/assign) this task?
create or replace function public.can_manage_task(tid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tasks t
    where t.id = tid and (
      public.is_family_admin(t.family_id)
      or (t.created_by = (select auth.uid()) and public.can_add(t.family_id, 'tasks'))
    )
  );
$$;

-- Can the current user tick this occurrence?
--   Admins: anything. Others: their own occurrence, or an 'any'-mode task
--   they are assigned to (or that is assigned to nobody).
create or replace function public.can_complete(tid uuid, p_for_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tasks t
    where t.id = tid and public.is_family_member(t.family_id) and (
      public.is_family_admin(t.family_id)
      or (t.completion_mode = 'each' and p_for_user = (select auth.uid()))
      -- 'any' mode, or nobody assigned: one shared tick
      or (p_for_user is null and (t.completion_mode = 'any' or not exists (select 1 from public.task_assignees a where a.task_id = t.id)) and (
            exists (select 1 from public.task_assignees a where a.task_id = t.id and a.user_id = (select auth.uid()))
            or not exists (select 1 from public.task_assignees a where a.task_id = t.id)))
    )
  );
$$;

-- -----------------------------------------------------------------------------
-- Triggers: validation, cleaning, family_id consistency
-- -----------------------------------------------------------------------------
create or replace function public.validate_category()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.name := public.clean_text(new.name, 30);
  new.emoji := coalesce(nullif(public.clean_text(new.emoji, 16), ''), '🏷️');
  if new.name = '' then raise exception 'Category name is required'; end if;
  if tg_op = 'UPDATE' then new.family_id := old.family_id; new.created_by := old.created_by; end if;
  return new;
end $$;
drop trigger if exists categories_validate on public.categories;
create trigger categories_validate before insert or update on public.categories
  for each row execute function public.validate_category();

create or replace function public.validate_task()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.title := public.clean_text(new.title, 80);
  new.notes := public.clean_text(new.notes, 6000);
  new.emoji := coalesce(nullif(public.clean_text(new.emoji, 16), ''), '✅');
  if new.title = '' then raise exception 'Task title is required'; end if;
  if new.repeat = 'once' then new.repeat_until := null; end if;
  if new.repeat <> 'weekdays' then new.repeat_days := '{}'; end if;
  select array_agg(distinct d order by d) into new.repeat_days from unnest(new.repeat_days) d;
  new.repeat_days := coalesce(new.repeat_days, '{}');
  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id = new.category_id and c.family_id = new.family_id) then
    raise exception 'Category belongs to another family';
  end if;
  if tg_op = 'UPDATE' then
    new.family_id := old.family_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists tasks_validate on public.tasks;
create trigger tasks_validate before insert or update on public.tasks
  for each row execute function public.validate_task();

create or replace function public.task_child_family()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select t.family_id into new.family_id from public.tasks t where t.id = new.task_id;
  return new;
end $$;
drop trigger if exists task_assignees_family on public.task_assignees;
create trigger task_assignees_family before insert or update on public.task_assignees
  for each row execute function public.task_child_family();
drop trigger if exists task_completions_family on public.task_completions;
create trigger task_completions_family before insert or update on public.task_completions
  for each row execute function public.task_child_family();

-- Completions: must be a real occurrence, not in the future, right mode, stamped by server.
create or replace function public.validate_completion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare t public.tasks;
begin
  select * into t from public.tasks where id = new.task_id;
  if not public.task_occurs_on(t, new.occurrence_date) then
    raise exception 'This task is not due on %', new.occurrence_date;
  end if;
  if new.occurrence_date > public.family_today(t.family_id) then
    raise exception 'You can’t tick off a future day';
  end if;
  if t.completion_mode = 'any' then
    new.for_user := null;
  elsif new.for_user is null then
    -- 'each' mode with nobody assigned behaves like 'any'
    if exists (select 1 from public.task_assignees a where a.task_id = t.id) then
      raise exception 'Choose whose task this is';
    end if;
  elsif not public.user_in_family(t.family_id, new.for_user) then
    raise exception 'That person is not in this family';
  end if;
  new.completed_by := auth.uid();
  new.completed_at := now();
  new.points := t.points;
  return new;
end $$;
drop trigger if exists task_completions_validate on public.task_completions;
create trigger task_completions_validate before insert on public.task_completions
  for each row execute function public.validate_completion();

-- Default categories for every family (new and existing).
create or replace function public.add_default_categories(fid uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.categories (family_id, name, emoji, colour, sort)
  select fid, v.name, v.emoji, v.colour, v.sort
  from (values
    ('Chores', '🧹', '#0072B2', 1), ('Kitchen', '🍽️', '#E69F00', 2), ('Pets', '🐾', '#009E73', 3),
    ('School', '🎒', '#7B61FF', 4), ('Bedroom', '🛏️', '#CC79A7', 5), ('Outdoors', '🌳', '#1B998B', 6)
  ) as v(name, emoji, colour, sort)
  where not exists (select 1 from public.categories c where c.family_id = fid);
$$;

create or replace function public.families_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.add_default_categories(new.id);
  return new;
end $$;
drop trigger if exists families_defaults on public.families;
create trigger families_defaults after insert on public.families
  for each row execute function public.families_after_insert();

select public.add_default_categories(id) from public.families;

-- -----------------------------------------------------------------------------
-- RPCs: create / update / delete a task together with its assignees (atomic).
-- SECURITY INVOKER: the RLS policies below still apply to every statement.
-- -----------------------------------------------------------------------------
create or replace function public.apply_task_fields(t public.tasks, d jsonb)
returns public.tasks language plpgsql immutable set search_path = '' as $$
begin
  if d ? 'title' then t.title := d ->> 'title'; end if;
  if d ? 'notes' then t.notes := coalesce(d ->> 'notes', ''); end if;
  if d ? 'emoji' then t.emoji := d ->> 'emoji'; end if;
  if d ? 'category_id' then t.category_id := nullif(d ->> 'category_id', '')::uuid; end if;
  if d ? 'colour' then t.colour := nullif(d ->> 'colour', ''); end if;
  if d ? 'start_date' then t.start_date := (d ->> 'start_date')::date; end if;
  if d ? 'due_time' then t.due_time := nullif(d ->> 'due_time', '')::time; end if;
  if d ? 'repeat' then t.repeat := d ->> 'repeat'; end if;
  if d ? 'repeat_days' then
    t.repeat_days := coalesce((select array_agg(x::smallint) from jsonb_array_elements_text(d -> 'repeat_days') x), '{}');
  end if;
  if d ? 'repeat_until' then t.repeat_until := nullif(d ->> 'repeat_until', '')::date; end if;
  if d ? 'completion_mode' then t.completion_mode := d ->> 'completion_mode'; end if;
  if d ? 'points' then t.points := (d ->> 'points')::smallint; end if;
  if d ? 'reminder_minutes' then t.reminder_minutes := nullif(d ->> 'reminder_minutes', '')::int; end if;
  return t;
end $$;

create or replace function public.set_task_assignees(p_task uuid, p_assignees uuid[])
returns void language plpgsql set search_path = '' as $$
begin
  delete from public.task_assignees where task_id = p_task and not (user_id = any (coalesce(p_assignees, '{}')));
  insert into public.task_assignees (task_id, user_id, assigned_by)
  select p_task, u, auth.uid() from unnest(coalesce(p_assignees, '{}')) u
  on conflict (task_id, user_id) do nothing;
end $$;

create or replace function public.create_task(p_family uuid, p_data jsonb, p_assignees uuid[] default '{}')
returns uuid language plpgsql set search_path = '' as $$
declare
  t public.tasks;
begin
  t.family_id := p_family;
  t.created_by := auth.uid();
  t.start_date := public.family_today(p_family);
  t.notes := '';
  t.emoji := '✅';
  t.repeat := 'once';
  t.repeat_days := '{}';
  t.completion_mode := 'each';
  t.points := 1;
  t := public.apply_task_fields(t, p_data);
  insert into public.tasks (family_id, title, notes, emoji, category_id, colour, start_date, due_time, repeat,
                            repeat_days, repeat_until, completion_mode, points, reminder_minutes, created_by)
  values (t.family_id, t.title, t.notes, t.emoji, t.category_id, t.colour, t.start_date, t.due_time, t.repeat,
          t.repeat_days, t.repeat_until, t.completion_mode, t.points, t.reminder_minutes, t.created_by)
  returning id into t.id;
  perform public.set_task_assignees(t.id, p_assignees);
  return t.id;
end $$;

-- Returns the id of the task that now represents the series (new id if split).
create or replace function public.update_task(p_task uuid, p_data jsonb, p_assignees uuid[] default null)
returns uuid language plpgsql set search_path = '' as $$
declare
  old_t public.tasks;
  new_t public.tasks;
  today date;
  schedule_changed boolean;
  assignees_changed boolean := false;
  new_id uuid;
begin
  select * into old_t from public.tasks where id = p_task;
  if not found then raise exception 'Task not found'; end if;
  if not public.can_manage_task(p_task) then raise exception 'You can’t edit this task' using errcode = '42501'; end if;
  today := public.family_today(old_t.family_id);
  new_t := public.apply_task_fields(old_t, p_data);

  if p_assignees is not null then
    assignees_changed := (select coalesce(array_agg(user_id order by user_id), '{}') from public.task_assignees where task_id = p_task)
                         is distinct from (select coalesce(array_agg(u order by u), '{}') from unnest(p_assignees) u);
  end if;
  schedule_changed := (new_t.repeat, new_t.repeat_days, new_t.start_date, new_t.completion_mode)
                      is distinct from (old_t.repeat, old_t.repeat_days, old_t.start_date, old_t.completion_mode)
                      or assignees_changed;

  -- Split only if the schedule changed AND the task already has past days.
  if schedule_changed and old_t.repeat <> 'once' and old_t.start_date < today then
    update public.tasks set repeat_until = today - 1 where id = p_task;
    new_id := public.create_task(old_t.family_id,
      to_jsonb(new_t) - 'id' - 'family_id' - 'created_by' - 'created_at' - 'updated_at' - 'archived_at'
        || jsonb_build_object('start_date', greatest(new_t.start_date, today)),
      coalesce(p_assignees, (select array_agg(user_id) from public.task_assignees where task_id = p_task)));
    -- Keep today's ticks if they still fit the new task.
    update public.task_completions c set task_id = new_id
     where c.task_id = p_task and c.occurrence_date >= today;
    return new_id;
  end if;

  update public.tasks set
    title = new_t.title, notes = new_t.notes, emoji = new_t.emoji, category_id = new_t.category_id,
    colour = new_t.colour, start_date = new_t.start_date, due_time = new_t.due_time, repeat = new_t.repeat,
    repeat_days = new_t.repeat_days, repeat_until = new_t.repeat_until, completion_mode = new_t.completion_mode,
    points = new_t.points, reminder_minutes = new_t.reminder_minutes
  where id = p_task;
  if p_assignees is not null then perform public.set_task_assignees(p_task, p_assignees); end if;
  return p_task;
end $$;

-- Delete: with keep_history the task stops from today but past ticks/crosses stay.
create or replace function public.delete_task(p_task uuid, p_keep_history boolean default true)
returns void language plpgsql set search_path = '' as $$
declare t public.tasks;
begin
  select * into t from public.tasks where id = p_task;
  if not found then return; end if;
  if not public.can_manage_task(p_task) then raise exception 'You can’t delete this task' using errcode = '42501'; end if;
  if p_keep_history and t.start_date < public.family_today(t.family_id) then
    update public.tasks set archived_at = now(), repeat_until = public.family_today(t.family_id) - 1 where id = p_task;
    delete from public.task_completions where task_id = p_task and occurrence_date >= public.family_today(t.family_id);
  else
    delete from public.tasks where id = p_task;
  end if;
end $$;

create or replace function public.mark_seen(p_family uuid, p_type text, p_ids uuid[])
returns void language sql set search_path = '' as $$
  insert into public.seen_items (user_id, family_id, item_type, item_id, seen_at)
  select auth.uid(), p_family, p_type, i, now() from unnest(p_ids) i
  on conflict (user_id, item_type, item_id) do update set seen_at = now();
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.categories       enable row level security;
alter table public.tasks            enable row level security;
alter table public.task_assignees   enable row level security;
alter table public.task_completions enable row level security;
alter table public.seen_items       enable row level security;

-- categories: anyone in the family reads; admins (or members if allowed to add tasks) write
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories for select to authenticated
  using (public.is_family_member(family_id));
drop policy if exists categories_insert on public.categories;
create policy categories_insert on public.categories for insert to authenticated
  with check (public.can_add(family_id, 'tasks') and created_by = (select auth.uid()));
drop policy if exists categories_update on public.categories;
create policy categories_update on public.categories for update to authenticated
  using (public.is_family_admin(family_id) or (created_by = (select auth.uid()) and public.can_add(family_id, 'tasks')))
  with check (public.is_family_member(family_id));
drop policy if exists categories_delete on public.categories;
create policy categories_delete on public.categories for delete to authenticated
  using (public.is_family_admin(family_id) or (created_by = (select auth.uid()) and public.can_add(family_id, 'tasks')));

-- tasks
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (public.is_family_member(family_id));
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.can_add(family_id, 'tasks') and created_by = (select auth.uid()));
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (public.can_manage_task(id)) with check (public.is_family_member(family_id));
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.can_manage_task(id));

-- task_assignees: assignee must be in the same family
drop policy if exists task_assignees_select on public.task_assignees;
create policy task_assignees_select on public.task_assignees for select to authenticated
  using (public.is_family_member(family_id));
drop policy if exists task_assignees_insert on public.task_assignees;
create policy task_assignees_insert on public.task_assignees for insert to authenticated
  with check (public.can_manage_task(task_id) and public.user_in_family(family_id, user_id));
drop policy if exists task_assignees_delete on public.task_assignees;
create policy task_assignees_delete on public.task_assignees for delete to authenticated
  using (public.can_manage_task(task_id));

-- task_completions
drop policy if exists task_completions_select on public.task_completions;
create policy task_completions_select on public.task_completions for select to authenticated
  using (public.is_family_member(family_id));
drop policy if exists task_completions_insert on public.task_completions;
create policy task_completions_insert on public.task_completions for insert to authenticated
  with check (public.can_complete(task_id, for_user));
drop policy if exists task_completions_update on public.task_completions;
create policy task_completions_update on public.task_completions for update to authenticated
  using (public.can_manage_task(task_id)) with check (public.can_manage_task(task_id));
drop policy if exists task_completions_delete on public.task_completions;
create policy task_completions_delete on public.task_completions for delete to authenticated
  using (completed_by = (select auth.uid()) or public.is_family_admin(family_id));

-- seen_items: only your own
drop policy if exists seen_items_all on public.seen_items;
create policy seen_items_all on public.seen_items for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_family_member(family_id));

-- -----------------------------------------------------------------------------
-- Privileges + realtime
-- -----------------------------------------------------------------------------
revoke all on public.categories, public.tasks, public.task_assignees, public.task_completions, public.seen_items from anon;
revoke all on function
  public.occurs_on(text, smallint[], date, date, date), public.task_occurs_on(public.tasks, date), public.family_today(uuid),
  public.can_add(uuid, text), public.user_in_family(uuid, uuid), public.can_manage_task(uuid), public.can_complete(uuid, uuid),
  public.add_default_categories(uuid), public.apply_task_fields(public.tasks, jsonb), public.set_task_assignees(uuid, uuid[]),
  public.create_task(uuid, jsonb, uuid[]), public.update_task(uuid, jsonb, uuid[]), public.delete_task(uuid, boolean),
  public.mark_seen(uuid, text, uuid[])
from anon, public;
grant execute on function
  public.occurs_on(text, smallint[], date, date, date), public.task_occurs_on(public.tasks, date), public.family_today(uuid),
  public.can_add(uuid, text), public.user_in_family(uuid, uuid), public.can_manage_task(uuid), public.can_complete(uuid, uuid),
  public.apply_task_fields(public.tasks, jsonb), public.set_task_assignees(uuid, uuid[]),
  public.create_task(uuid, jsonb, uuid[]), public.update_task(uuid, jsonb, uuid[]), public.delete_task(uuid, boolean),
  public.mark_seen(uuid, text, uuid[])
to authenticated;

do $$
declare t text;
begin
  foreach t in array array['categories', 'tasks', 'task_assignees', 'task_completions'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
