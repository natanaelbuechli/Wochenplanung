alter table public.weeks
add column if not exists archived boolean not null default false;
