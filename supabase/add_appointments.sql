create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weeks(id) on delete cascade,
  day text not null check (day in ('Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag')),
  title text not null,
  time_label text,
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

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at
before update on public.appointments
for each row
execute function public.handle_updated_at();

alter table public.appointments enable row level security;

drop policy if exists "authenticated users manage appointments" on public.appointments;
create policy "authenticated users manage appointments"
on public.appointments
for all
to authenticated
using (true)
with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'appointments'
  ) then
    alter publication supabase_realtime add table public.appointments;
  end if;
end
$$;
