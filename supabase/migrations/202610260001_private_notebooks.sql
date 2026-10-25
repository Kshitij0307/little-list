begin;

-- Null owners are allowed only to preserve existing tasks for explicit admin assignment.
alter table public.tasks
  add column user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  add constraint tasks_owner_id_unique unique (user_id, id),
  add constraint tasks_parent_same_owner foreign key (user_id, parent_id)
    references public.tasks(user_id, id) on delete restrict;

create index tasks_owner_active_created_idx
  on public.tasks(user_id, created_at desc, id desc) where deleted_at is null;

-- All application data access now uses the signed-in user's JWT, never service_role.
revoke all on public.tasks from anon, authenticated, service_role;
grant select, insert on public.tasks to authenticated;
grant update (title, notes, status, starred, focus_today, due_date, parent_id, deleted_at)
  on public.tasks to authenticated;

create policy tasks_select_own on public.tasks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy tasks_insert_own on public.tasks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy tasks_update_own on public.tasks
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Preserve ancestry checks while restricting parent lookup to the same owner.
create or replace function public.validate_task_parent() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(20261015, 1);
  if new.parent_id is null then return new; end if;
  if not exists (
    select 1 from public.tasks where id = new.parent_id
      and user_id is not distinct from new.user_id and deleted_at is null
  ) then
    raise exception 'Parent task not found' using errcode = '23514';
  end if;
  if exists (
    with recursive ancestors as (
      select id, parent_id from public.tasks where id = new.parent_id
        and user_id is not distinct from new.user_id
      union
      select task.id, task.parent_id from public.tasks task
      join ancestors ancestor on task.id = ancestor.parent_id
      where task.user_id is not distinct from new.user_id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'A task cannot be its own subtask' using errcode = '23514';
  end if;
  return new;
end;
$$;

commit;
