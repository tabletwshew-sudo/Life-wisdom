-- =============================================================================
-- Family Hub — Phase 4: food & drink (recipes, ideas, meal planner, shopping)
--
--   * recipes: food and drinks. "Ideas" (links / things to try) are recipes
--     with is_idea = true, so an idea can be turned into a full recipe later.
--   * Favourites are per person (everyone stars their own).
--   * meal_plans: one recipe (or free text, e.g. "Takeaway") per day per meal.
--   * shopping_items: one shared live list per family.
--   * Recipe photos live in a PRIVATE storage bucket, in a folder named after
--     the family id; only members of that family can read them.
-- =============================================================================

create table if not exists public.recipes (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 100),
  kind          text not null default 'food' check (kind in ('food', 'drink')),
  is_idea       boolean not null default false,
  emoji         text not null default '🍽️' check (char_length(emoji) between 1 and 16),
  description   text not null default '' check (char_length(description) <= 500),
  photo_path    text check (photo_path is null or char_length(photo_path) <= 200),
  ingredients   text[] not null default '{}' check (cardinality(ingredients) <= 100),
  steps         text[] not null default '{}' check (cardinality(steps) <= 60),
  prep_minutes  smallint check (prep_minutes is null or prep_minutes between 0 and 1440),
  cook_minutes  smallint check (cook_minutes is null or cook_minutes between 0 and 1440),
  servings      smallint check (servings is null or servings between 1 and 100),
  tags          text[] not null default '{}' check (cardinality(tags) <= 20),
  -- Free text. May hold "enc:..." ciphertext when end-to-end encryption is on.
  notes         text not null default '' check (char_length(notes) <= 6000),
  source_url    text check (source_url is null or (char_length(source_url) <= 1000 and source_url ~* '^https?://')),
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists recipes_family_idx on public.recipes (family_id);

create table if not exists public.recipe_favourites (
  recipe_id  uuid not null references public.recipes (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  family_id  uuid not null references public.families (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recipe_id, user_id)
);

create table if not exists public.meal_plans (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families (id) on delete cascade,
  plan_date    date not null,
  slot         text not null check (slot in ('breakfast', 'lunch', 'dinner')),
  recipe_id    uuid references public.recipes (id) on delete set null,
  custom_title text check (custom_title is null or char_length(custom_title) between 1 and 100),
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (family_id, plan_date, slot),
  constraint meal_plans_has_something check (recipe_id is not null or custom_title is not null)
);

create table if not exists public.shopping_items (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 120),
  quantity     text not null default '' check (char_length(quantity) <= 40),
  aisle        text not null default 'Other' check (char_length(aisle) <= 30),
  checked      boolean not null default false,
  checked_by   uuid references public.profiles (id) on delete set null,
  checked_at   timestamptz,
  source       text not null default 'manual' check (source in ('manual', 'meal_plan', 'recipe')),
  for_recipes  text[] not null default '{}' check (cardinality(for_recipes) <= 20),
  added_by     uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists shopping_items_family_idx on public.shopping_items (family_id);

-- -----------------------------------------------------------------------------
-- Helpers + triggers
-- -----------------------------------------------------------------------------
create or replace function public.try_uuid(t text)
returns uuid language sql immutable set search_path = '' as $$
  select case when t ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then t::uuid end;
$$;

create or replace function public.can_manage_recipe(rid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.recipes r
    where r.id = rid and (
      public.is_family_admin(r.family_id)
      or (r.created_by = (select auth.uid()) and public.can_add(r.family_id, 'recipes'))
    )
  );
$$;

create or replace function public.clean_text_array(a text[], max_items int, max_len int)
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(x order by i), '{}')
  from (
    select public.clean_text(v, max_len) as x, i
    from unnest(coalesce(a, '{}')) with ordinality as t(v, i)
  ) s
  where x <> '' and i <= max_items;
$$;

create or replace function public.validate_recipe()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.title := public.clean_text(new.title, 100);
  new.description := public.clean_text(new.description, 500);
  new.notes := public.clean_text(new.notes, 6000);
  new.emoji := coalesce(nullif(public.clean_text(new.emoji, 16), ''), '🍽️');
  new.ingredients := public.clean_text_array(new.ingredients, 100, 200);
  new.steps := public.clean_text_array(new.steps, 60, 2000);
  new.tags := (select coalesce(array_agg(distinct lower(t)), '{}') from unnest(public.clean_text_array(new.tags, 20, 30)) t);
  new.source_url := nullif(btrim(new.source_url), '');
  if new.title = '' then raise exception 'Recipe title is required'; end if;
  -- Photos must be inside this family's folder.
  if new.photo_path is not null and split_part(new.photo_path, '/', 1) <> new.family_id::text then
    raise exception 'Photo belongs to another family';
  end if;
  if tg_op = 'UPDATE' then
    new.family_id := old.family_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists recipes_validate on public.recipes;
create trigger recipes_validate before insert or update on public.recipes
  for each row execute function public.validate_recipe();

create or replace function public.validate_meal_plan()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.custom_title := nullif(public.clean_text(new.custom_title, 100), '');
  if new.recipe_id is not null and not exists (
    select 1 from public.recipes r where r.id = new.recipe_id and r.family_id = new.family_id) then
    raise exception 'Recipe belongs to another family';
  end if;
  if tg_op = 'UPDATE' then new.family_id := old.family_id; end if;
  return new;
end $$;
drop trigger if exists meal_plans_validate on public.meal_plans;
create trigger meal_plans_validate before insert or update on public.meal_plans
  for each row execute function public.validate_meal_plan();

create or replace function public.validate_shopping_item()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.name := public.clean_text(new.name, 120);
  new.quantity := public.clean_text(new.quantity, 40);
  new.aisle := coalesce(nullif(public.clean_text(new.aisle, 30), ''), 'Other');
  new.for_recipes := public.clean_text_array(new.for_recipes, 20, 100);
  if new.name = '' then raise exception 'Item name is required'; end if;
  -- Who ticked it and when is recorded by the server.
  if new.checked and (tg_op = 'INSERT' or not old.checked) then
    new.checked_by := auth.uid();
    new.checked_at := now();
  elsif not new.checked then
    new.checked_by := null;
    new.checked_at := null;
  end if;
  if tg_op = 'UPDATE' then
    new.family_id := old.family_id;
    new.added_by := old.added_by;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists shopping_items_validate on public.shopping_items;
create trigger shopping_items_validate before insert or update on public.shopping_items
  for each row execute function public.validate_shopping_item();

create or replace function public.recipe_child_family()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select r.family_id into new.family_id from public.recipes r where r.id = new.recipe_id;
  return new;
end $$;
drop trigger if exists recipe_favourites_family on public.recipe_favourites;
create trigger recipe_favourites_family before insert on public.recipe_favourites
  for each row execute function public.recipe_child_family();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.recipes           enable row level security;
alter table public.recipe_favourites enable row level security;
alter table public.meal_plans        enable row level security;
alter table public.shopping_items    enable row level security;

-- recipes: everyone reads; add if allowed; edit/delete admin or creator
drop policy if exists recipes_select on public.recipes;
create policy recipes_select on public.recipes for select to authenticated
  using (public.is_family_member(family_id));
drop policy if exists recipes_insert on public.recipes;
create policy recipes_insert on public.recipes for insert to authenticated
  with check (public.can_add(family_id, 'recipes') and created_by = (select auth.uid()));
drop policy if exists recipes_update on public.recipes;
create policy recipes_update on public.recipes for update to authenticated
  using (public.can_manage_recipe(id)) with check (public.is_family_member(family_id));
drop policy if exists recipes_delete on public.recipes;
create policy recipes_delete on public.recipes for delete to authenticated
  using (public.can_manage_recipe(id));

-- favourites: read the family's; add/remove only your own
drop policy if exists recipe_favourites_select on public.recipe_favourites;
create policy recipe_favourites_select on public.recipe_favourites for select to authenticated
  using (public.is_family_member(family_id));
drop policy if exists recipe_favourites_insert on public.recipe_favourites;
create policy recipe_favourites_insert on public.recipe_favourites for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_family_member(family_id));
drop policy if exists recipe_favourites_delete on public.recipe_favourites;
create policy recipe_favourites_delete on public.recipe_favourites for delete to authenticated
  using (user_id = (select auth.uid()));

-- meal plans: everyone reads; planners = admins, or members allowed to add recipes
drop policy if exists meal_plans_select on public.meal_plans;
create policy meal_plans_select on public.meal_plans for select to authenticated
  using (public.is_family_member(family_id));
drop policy if exists meal_plans_insert on public.meal_plans;
create policy meal_plans_insert on public.meal_plans for insert to authenticated
  with check (public.can_add(family_id, 'recipes') and created_by = (select auth.uid()));
drop policy if exists meal_plans_update on public.meal_plans;
create policy meal_plans_update on public.meal_plans for update to authenticated
  using (public.can_add(family_id, 'recipes')) with check (public.can_add(family_id, 'recipes'));
drop policy if exists meal_plans_delete on public.meal_plans;
create policy meal_plans_delete on public.meal_plans for delete to authenticated
  using (public.can_add(family_id, 'recipes'));

-- shopping: everyone reads and can tick; add if allowed; delete own items (admins: any)
drop policy if exists shopping_items_select on public.shopping_items;
create policy shopping_items_select on public.shopping_items for select to authenticated
  using (public.is_family_member(family_id));
drop policy if exists shopping_items_insert on public.shopping_items;
create policy shopping_items_insert on public.shopping_items for insert to authenticated
  with check (public.can_add(family_id, 'shopping') and added_by = (select auth.uid()));
drop policy if exists shopping_items_update on public.shopping_items;
create policy shopping_items_update on public.shopping_items for update to authenticated
  using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));
drop policy if exists shopping_items_delete on public.shopping_items;
create policy shopping_items_delete on public.shopping_items for delete to authenticated
  using (public.is_family_admin(family_id) or (public.can_add(family_id, 'shopping') and (added_by = (select auth.uid()) or checked)));

-- -----------------------------------------------------------------------------
-- Private photo storage: <family_id>/<random>.jpg
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-photos', 'recipe-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "recipe photos: family can read" on storage.objects;
create policy "recipe photos: family can read" on storage.objects for select to authenticated
  using (bucket_id = 'recipe-photos' and public.is_family_member(public.try_uuid((storage.foldername(name))[1])));
drop policy if exists "recipe photos: allowed members can upload" on storage.objects;
create policy "recipe photos: allowed members can upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'recipe-photos' and public.can_add(public.try_uuid((storage.foldername(name))[1]), 'recipes'));
drop policy if exists "recipe photos: uploader or admin can delete" on storage.objects;
create policy "recipe photos: uploader or admin can delete" on storage.objects for delete to authenticated
  using (bucket_id = 'recipe-photos' and (
    (owner_id = (select auth.uid())::text and public.is_family_member(public.try_uuid((storage.foldername(name))[1])))
    or public.is_family_admin(public.try_uuid((storage.foldername(name))[1]))));

-- -----------------------------------------------------------------------------
-- Privileges + realtime
-- -----------------------------------------------------------------------------
revoke all on public.recipes, public.recipe_favourites, public.meal_plans, public.shopping_items from anon;
revoke all on function public.try_uuid(text), public.can_manage_recipe(uuid), public.clean_text_array(text[], int, int) from anon, public;
grant execute on function public.try_uuid(text), public.can_manage_recipe(uuid), public.clean_text_array(text[], int, int) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['recipes', 'recipe_favourites', 'meal_plans', 'shopping_items'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
