alter table public.todos
add column if not exists position bigint;

with ranked_todos as (
  select id, row_number() over (order by created_at desc, id) * 1000 as new_position
  from public.todos
)
update public.todos
set position = ranked_todos.new_position
from ranked_todos
where public.todos.id = ranked_todos.id
  and public.todos.position is null;

alter table public.todos
alter column position set default 0;

alter table public.todos
alter column position set not null;
