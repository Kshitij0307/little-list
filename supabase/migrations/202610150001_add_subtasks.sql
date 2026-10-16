-- Existing tasks remain on the main list; subtasks retain all normal task fields.
alter table public.tasks
  add column parent_id uuid references public.tasks(id) on delete restrict,
  add constraint tasks_parent_not_self check (parent_id is distinct from id);

create index tasks_parent_idx on public.tasks(parent_id) where parent_id is not null;

create function public.validate_task_parent() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Serialize hierarchy changes to prevent concurrent moves creating a cycle.
  perform pg_advisory_xact_lock(20261015, 1);
  if new.parent_id is null then return new; end if;
  if not exists (select 1 from public.tasks where id = new.parent_id and deleted_at is null) then
    raise exception 'Parent task not found' using errcode = '23514';
  end if;
  if exists (
    with recursive ancestors as (
      select id, parent_id from public.tasks where id = new.parent_id
      union
      select task.id, task.parent_id from public.tasks task
      join ancestors ancestor on task.id = ancestor.parent_id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'A task cannot be its own subtask' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger tasks_validate_parent before insert or update of parent_id on public.tasks
for each row execute function public.validate_task_parent();
