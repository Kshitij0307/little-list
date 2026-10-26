begin;

-- Every selected row is validated and locked before any status changes.
create or replace function public.move_tasks(
  task_ids uuid[], from_status text, to_status text, task_parent_id uuid
) returns setof public.tasks
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if task_ids is null or cardinality(task_ids) not between 1 and 500
    or from_status is null or from_status not in ('todo', 'in_progress', 'done')
    or to_status is null or to_status not in ('todo', 'in_progress', 'done')
    or from_status = to_status
    or (select count(distinct id) from unnest(task_ids) id) <> cardinality(task_ids)
  then
    raise exception 'Invalid task selection' using errcode = '23514';
  end if;

  perform task.id from public.tasks task
    where task.id = any(task_ids) and task.user_id = auth.uid()
    order by task.id for update;

  if (select count(*) from public.tasks task
    where task.id = any(task_ids) and task.user_id = auth.uid()
      and task.deleted_at is null and task.status = from_status
      and task.parent_id is not distinct from task_parent_id
  ) <> cardinality(task_ids) then
    raise exception 'Selected tasks changed' using errcode = '23514';
  end if;

  return query update public.tasks task set status = to_status
    where task.id = any(task_ids) and task.user_id = auth.uid()
    returning task.*;
end;
$$;

revoke all on function public.move_tasks(uuid[], text, text, uuid) from public, anon;
grant execute on function public.move_tasks(uuid[], text, text, uuid) to authenticated;

-- Soft deletion and its undo use the same scoped, all-or-nothing transaction.
create or replace function public.delete_tasks(
  task_ids uuid[], from_status text, task_parent_id uuid,
  deletion_time timestamptz, restoring boolean
) returns setof public.tasks
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if task_ids is null or cardinality(task_ids) not between 1 and 500
    or from_status is null or from_status not in ('todo', 'in_progress', 'done')
    or deletion_time is null or restoring is null
    or (select count(distinct id) from unnest(task_ids) id) <> cardinality(task_ids)
  then
    raise exception 'Invalid task selection' using errcode = '23514';
  end if;

  perform task.id from public.tasks task
    where task.id = any(task_ids) and task.user_id = auth.uid()
    order by task.id for update;

  if (select count(*) from public.tasks task
    where task.id = any(task_ids) and task.user_id = auth.uid()
      and task.status = from_status
      and task.parent_id is not distinct from task_parent_id
      and case when restoring then task.deleted_at = deletion_time else task.deleted_at is null end
  ) <> cardinality(task_ids) then
    raise exception 'Selected tasks changed' using errcode = '23514';
  end if;

  return query update public.tasks task
    set deleted_at = case when restoring then null else deletion_time end
    where task.id = any(task_ids) and task.user_id = auth.uid()
    returning task.*;
end;
$$;
revoke all on function public.delete_tasks(uuid[], text, uuid, timestamptz, boolean) from public, anon;
grant execute on function public.delete_tasks(uuid[], text, uuid, timestamptz, boolean) to authenticated;

commit;
