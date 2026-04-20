create extension if not exists pgcrypto;

create table if not exists public.weeks (
  id uuid primary key default gen_random_uuid(),
  kw integer not null,
  start_date date not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weeks(id) on delete cascade,
  day text not null check (day in ('Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag')),
  time text not null check (time in ('Morgen', 'Nachmittag')),
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_id, day, time)
);

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  completed boolean not null default false,
  assigned_to text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_entries_updated_at on public.entries;
create trigger set_entries_updated_at
before update on public.entries
for each row
execute function public.handle_updated_at();

drop trigger if exists set_todos_updated_at on public.todos;
create trigger set_todos_updated_at
before update on public.todos
for each row
execute function public.handle_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.handle_updated_at();

alter table public.weeks enable row level security;
alter table public.entries enable row level security;
alter table public.todos enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "authenticated users manage weeks" on public.weeks;
create policy "authenticated users manage weeks"
on public.weeks
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users manage entries" on public.entries;
create policy "authenticated users manage entries"
on public.entries
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users manage todos" on public.todos;
create policy "authenticated users manage todos"
on public.todos
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users read profiles" on public.profiles;
create policy "authenticated users read profiles"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "users manage own profile" on public.profiles;
create policy "users manage own profile"
on public.profiles
for all
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'weeks'
  ) then
    alter publication supabase_realtime add table public.weeks;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'entries'
  ) then
    alter publication supabase_realtime add table public.entries;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'todos'
  ) then
    alter publication supabase_realtime add table public.todos;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end
$$;
