-- =============================================================================
-- Family Hub — Phase 5: notifications, reminders and Web Push
--
--   * notifications: the in-app notification centre. Rows are created only by
--     the server (triggers and the reminder job); each person sees only theirs.
--   * notification_prefs: per person, per family settings.
--   * push_subscriptions: one row per device that allowed notifications.
--   * generate_due_notifications(): run every minute by the "send-reminders"
--     Edge Function (scheduled with pg_cron). It creates task/event reminders
--     and daily summaries; the function then sends them as Web Push.
-- =============================================================================

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('task_assigned', 'event_invited', 'recipe_added', 'task_reminder', 'event_reminder', 'daily_summary', 'test')),
  title       text not null check (char_length(title) <= 150),
  body        text not null default '' check (char_length(body) <= 400),
  link        text not null default '/' check (link ~ '^/[^/]' or link = '/'),
  actor_id    uuid references public.profiles (id) on delete set null,
  dedupe_key  text,
  created_at  timestamptz not null default now(),
  read_at     timestamptz,
  pushed_at   timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unpushed_idx on public.notifications (created_at) where pushed_at is null;
create unique index if not exists notifications_dedupe on public.notifications (user_id, dedupe_key) where dedupe_key is not null;

create table if not exists public.notification_prefs (
  user_id            uuid not null references public.profiles (id) on delete cascade,
  family_id          uuid not null references public.families (id) on delete cascade,
  daily_summary      boolean not null default true,
  daily_summary_time time not null default '07:30',
  assignment_alerts  boolean not null default true,
  task_reminders     boolean not null default true,
  event_reminders    boolean not null default true,
  new_recipe_alerts  boolean not null default false,
  updated_at         timestamptz not null default now(),
  primary key (user_id, family_id)
);

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  endpoint     text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh       text not null check (char_length(p256dh) between 20 and 200),
  auth         text not null check (char_length(auth) between 8 and 100),
  device_label text not null default '' check (char_length(device_label) <= 80),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- A person's preferences (defaults if they never changed anything).
create or replace function public.prefs_for(p_user uuid, p_family uuid)
returns public.notification_prefs language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p from public.notification_prefs p where p.user_id = p_user and p.family_id = p_family),
    row(p_user, p_family, true, '07:30'::time, true, true, true, false, now())::public.notification_prefs
  );
$$;

-- '15:30' → '3:30pm', '09:00' → '9am'
create or replace function public.friendly_time(t time)
returns text language sql immutable set search_path = '' as $$
  select case when t is null then '' else
    ltrim(to_char(t, 'HH12'), '0') ||
    case when extract(minute from t) = 0 then '' else to_char(t, ':MI') end ||
    case when extract(hour from t) < 12 then 'am' else 'pm' end
  end;
$$;

-- Never put encrypted text ("enc:...") into a notification.
create or replace function public.safe_text(t text)
returns text language sql immutable set search_path = '' as $$
  select case when t is null or t like 'enc:%' then '' else t end;
$$;

create or replace function public.notify(
  p_family uuid, p_user uuid, p_kind text, p_title text, p_body text, p_link text, p_actor uuid, p_dedupe text
) returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (family_id, user_id, kind, title, body, link, actor_id, dedupe_key)
  values (p_family, p_user, p_kind, left(p_title, 150), left(coalesce(p_body, ''), 400), p_link, p_actor, p_dedupe)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
$$;

-- -----------------------------------------------------------------------------
-- Instant notifications: assigned a chore / invited to an event / new recipe
-- -----------------------------------------------------------------------------
create or replace function public.on_task_assigned()
returns trigger language plpgsql security definer set search_path = '' as $$
declare t public.tasks; actor text;
begin
  if new.assigned_by is null or new.assigned_by = new.user_id then return new; end if;
  if not (public.prefs_for(new.user_id, new.family_id)).assignment_alerts then return new; end if;
  select * into t from public.tasks where id = new.task_id;
  select coalesce(nullif(display_name, ''), 'Someone') into actor from public.profiles where id = new.assigned_by;
  perform public.notify(new.family_id, new.user_id, 'task_assigned',
    actor || ' gave you a chore: ' || t.emoji || ' ' || t.title,
    case when t.repeat = 'once' then 'On ' || to_char(t.start_date, 'FMDay FMDD FMMonth') else 'Repeats ' || replace(t.repeat, 'weekdays', 'on chosen days') end
      || case when t.due_time is not null then ' at ' || public.friendly_time(t.due_time) else '' end,
    '/tasks', new.assigned_by, 'assigned:' || new.task_id || ':' || new.user_id);
  return new;
end $$;
drop trigger if exists task_assignees_notify on public.task_assignees;
create trigger task_assignees_notify after insert on public.task_assignees
  for each row execute function public.on_task_assigned();

create or replace function public.on_event_invited()
returns trigger language plpgsql security definer set search_path = '' as $$
declare e public.events; actor text; emoji text;
begin
  if new.added_by is null or new.added_by = new.user_id then return new; end if;
  if not (public.prefs_for(new.user_id, new.family_id)).assignment_alerts then return new; end if;
  select * into e from public.events where id = new.event_id;
  select coalesce(t.emoji, '📅') into emoji from public.event_types t where t.id = e.type_id;
  select coalesce(nullif(display_name, ''), 'Someone') into actor from public.profiles where id = new.added_by;
  perform public.notify(new.family_id, new.user_id, 'event_invited',
    actor || ' added you to: ' || coalesce(emoji, '📅') || ' ' || e.title,
    to_char(e.start_date, 'FMDay FMDD FMMonth') || case when not e.all_day then ' at ' || public.friendly_time(e.start_time) else '' end,
    '/calendar?view=day&date=' || e.start_date, new.added_by, 'invited:' || new.event_id || ':' || new.user_id);
  return new;
end $$;
drop trigger if exists event_attendees_notify on public.event_attendees;
create trigger event_attendees_notify after insert on public.event_attendees
  for each row execute function public.on_event_invited();

create or replace function public.on_recipe_added()
returns trigger language plpgsql security definer set search_path = '' as $$
declare m record; actor text;
begin
  select coalesce(nullif(display_name, ''), 'Someone') into actor from public.profiles where id = new.created_by;
  for m in select fm.user_id from public.family_members fm where fm.family_id = new.family_id and fm.user_id <> new.created_by loop
    if (public.prefs_for(m.user_id, new.family_id)).new_recipe_alerts then
      perform public.notify(new.family_id, m.user_id, 'recipe_added',
        actor || ' added a ' || case when new.is_idea then 'new idea' when new.kind = 'drink' then 'new drink' else 'new recipe' end || ': ' || new.emoji || ' ' || new.title,
        '', '/food/recipe/' || new.id, new.created_by, 'recipe:' || new.id);
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists recipes_notify on public.recipes;
create trigger recipes_notify after insert on public.recipes
  for each row execute function public.on_recipe_added();

-- -----------------------------------------------------------------------------
-- Scheduled reminders. Called every minute by the send-reminders function.
-- Looks back `p_window` so a late or missed run still sends (once — dedupe).
-- -----------------------------------------------------------------------------
create or replace function public.generate_due_notifications(p_now timestamptz default now(), p_window interval default '10 minutes')
returns integer language plpgsql security definer set search_path = '' as $$
declare
  f record; t record; e record; u record; d date; fire timestamp; local_now timestamp; today date;
  n integer := 0; before_count integer;
  emoji text; dinner text; chores int; evs int;
begin
  select count(*) into before_count from public.notifications;
  for f in select id, timezone from public.families loop
    local_now := p_now at time zone f.timezone;
    today := local_now::date;

    -- Task reminders (up to 7 days ahead)
    for t in select * from public.tasks where family_id = f.id and reminder_minutes is not null and archived_at is null loop
      for d in select generate_series(today, today + 7, '1 day')::date loop
        fire := (d + coalesce(t.due_time, '08:00'::time)) - make_interval(mins => t.reminder_minutes);
        continue when fire > local_now or fire <= local_now - p_window;
        continue when not public.occurs_on(t.repeat, t.repeat_days, t.start_date, t.repeat_until, d);
        for u in
          select a.user_id from public.task_assignees a where a.task_id = t.id
          union all
          select m.user_id from public.family_members m
           where m.family_id = f.id and not exists (select 1 from public.task_assignees a where a.task_id = t.id)
        loop
          continue when not (public.prefs_for(u.user_id, f.id)).task_reminders;
          -- Already done? Then no reminder.
          continue when exists (select 1 from public.task_completions c where c.task_id = t.id and c.occurrence_date = d
                                 and (c.for_user is null or c.for_user = u.user_id));
          perform public.notify(f.id, u.user_id, 'task_reminder',
            '⏰ ' || t.emoji || ' ' || t.title,
            case when d = today then 'Due today' else 'Due ' || to_char(d, 'FMDay') end
              || case when t.due_time is not null then ' at ' || public.friendly_time(t.due_time) else '' end,
            '/tasks?view=day&date=' || d, null, 'task:' || t.id || ':' || d || ':' || u.user_id);
        end loop;
      end loop;
    end loop;

    -- Event reminders (up to 14 days ahead)
    for e in select * from public.events where family_id = f.id and reminder_minutes is not null loop
      for d in select generate_series(today, today + 14, '1 day')::date loop
        fire := (d + coalesce(e.start_time, '09:00'::time)) - make_interval(mins => e.reminder_minutes);
        continue when fire > local_now or fire <= local_now - p_window;
        continue when e.repeat <> 'once' and exists (select 1 from public.event_exceptions x where x.event_id = e.id and x.skip_date = d);
        continue when not public.occurs_on(e.repeat, '{}'::smallint[], e.start_date, e.repeat_until, d);
        select coalesce(et.emoji, '📅') into emoji from public.event_types et where et.id = e.type_id;
        for u in
          select a.user_id from public.event_attendees a where a.event_id = e.id
          union all
          select m.user_id from public.family_members m
           where m.family_id = f.id and not exists (select 1 from public.event_attendees a where a.event_id = e.id)
        loop
          continue when not (public.prefs_for(u.user_id, f.id)).event_reminders;
          perform public.notify(f.id, u.user_id, 'event_reminder',
            coalesce(emoji, '📅') || ' ' || e.title,
            case when d = today then 'Today' when d = today + 1 then 'Tomorrow' else to_char(d, 'FMDay FMDD FMMonth') end
              || case when e.all_day then '' else ' at ' || public.friendly_time(e.start_time) end
              || case when public.safe_text(e.location) <> '' then ' · ' || left(e.location, 60) else '' end,
            '/calendar?view=day&date=' || d, null, 'event:' || e.id || ':' || d || ':' || u.user_id);
        end loop;
      end loop;
    end loop;

    -- Daily summary at each person's chosen time
    for u in select m.user_id from public.family_members m where m.family_id = f.id loop
      declare p public.notification_prefs := public.prefs_for(u.user_id, f.id);
      begin
        continue when not p.daily_summary;
        fire := today + p.daily_summary_time;
        continue when fire > local_now or fire <= local_now - p_window;
        select count(*) into chores from public.tasks tk
         where tk.family_id = f.id and tk.archived_at is null
           and public.occurs_on(tk.repeat, tk.repeat_days, tk.start_date, tk.repeat_until, today)
           and (exists (select 1 from public.task_assignees a where a.task_id = tk.id and a.user_id = u.user_id)
                or not exists (select 1 from public.task_assignees a where a.task_id = tk.id));
        select count(*) into evs from public.events ev
         where ev.family_id = f.id
           and exists (select 1 from generate_series(0, ev.end_date - ev.start_date) s(k)
                       where public.occurs_on(ev.repeat, '{}'::smallint[], ev.start_date, ev.repeat_until, today - s.k)
                         and not exists (select 1 from public.event_exceptions x where x.event_id = ev.id and x.skip_date = today - s.k));
        select coalesce(r.title, mp.custom_title) into dinner from public.meal_plans mp
          left join public.recipes r on r.id = mp.recipe_id
         where mp.family_id = f.id and mp.plan_date = today and mp.slot = 'dinner';
        perform public.notify(f.id, u.user_id, 'daily_summary',
          '☀️ Your day',
          concat_ws(' · ',
            case chores when 0 then 'No chores' when 1 then '1 chore' else chores || ' chores' end,
            case evs when 0 then null when 1 then '1 event' else evs || ' events' end,
            case when dinner is not null then 'Dinner: ' || dinner end),
          '/', null, 'summary:' || today || ':' || u.user_id);
      end;
    end loop;
  end loop;

  -- Tidy up: keep 60 days of history.
  delete from public.notifications where created_at < p_now - interval '60 days';
  select count(*) - before_count into n from public.notifications;
  return greatest(n, 0);
end $$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.notifications      enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.push_subscriptions enable row level security;

-- Notifications: you see, mark read and delete only your own. No direct inserts.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and public.is_family_member(family_id));
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- Only read_at may be changed by the user.
create or replace function public.guard_notification_update()
returns trigger language plpgsql set search_path = '' as $$
declare r timestamptz := new.read_at;
begin
  if current_user = 'authenticated' then
    new := old;
    new.read_at := r;
  end if;
  return new;
end $$;
drop trigger if exists notifications_guard on public.notifications;
create trigger notifications_guard before update on public.notifications
  for each row execute function public.guard_notification_update();

drop policy if exists notification_prefs_all on public.notification_prefs;
create policy notification_prefs_all on public.notification_prefs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_family_member(family_id));

drop policy if exists push_subscriptions_all on public.push_subscriptions;
create policy push_subscriptions_all on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Send a test notification to yourself (the Edge Function pushes it).
create or replace function public.send_test_notification(p_family uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare id uuid;
begin
  if not public.is_family_member(p_family) then raise exception 'Not a member of this family' using errcode = '42501'; end if;
  insert into public.notifications (family_id, user_id, kind, title, body, link)
  values (p_family, auth.uid(), 'test', '🔔 Test notification', 'Notifications are working on this device!', '/more/notifications')
  returning notifications.id into id;
  return id;
end $$;

-- -----------------------------------------------------------------------------
-- Privileges + realtime
-- -----------------------------------------------------------------------------
revoke all on public.notifications, public.notification_prefs, public.push_subscriptions from anon;
revoke insert on public.notifications from authenticated;
revoke all on function
  public.prefs_for(uuid, uuid), public.friendly_time(time), public.safe_text(text),
  public.notify(uuid, uuid, text, text, text, text, uuid, text),
  public.generate_due_notifications(timestamptz, interval), public.send_test_notification(uuid)
from anon, public, authenticated;
grant execute on function public.send_test_notification(uuid), public.friendly_time(time), public.safe_text(text) to authenticated;
-- Only the server (service role, used by the Edge Function) can run the reminder job.
grant execute on function public.generate_due_notifications(timestamptz, interval) to service_role;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- pg_cron + pg_net are used to call the send-reminders function every minute.
-- The schedule itself is created by supabase/setup/schedule-reminders.sql
-- (it needs your project URL and a secret, so it isn't part of this migration).
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
