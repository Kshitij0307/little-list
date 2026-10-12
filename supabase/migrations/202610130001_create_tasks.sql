create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  notes text not null default '' check (char_length(notes) <= 5000),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  starred boolean not null default false,
  focus_today boolean not null default false,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz
);

create index tasks_active_created_idx on public.tasks (created_at desc) where deleted_at is null;

-- Browser clients have no table access. Only the server-held service role can access it.
alter table public.tasks enable row level security;
revoke all on public.tasks from anon, authenticated;
grant select, insert, update on public.tasks to service_role;

create function public.set_task_timestamps() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.status = 'done' then
    if TG_OP = 'INSERT' then
      new.completed_at := now();
    elsif old.status <> 'done' then
      new.completed_at := now();
    else
      new.completed_at := old.completed_at;
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_timestamps before insert or update on public.tasks
for each row execute function public.set_task_timestamps();
