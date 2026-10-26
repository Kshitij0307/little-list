begin;

-- Repair active descendants left behind by deletions made before this migration.
with recursive hidden as (
  select task.id, task.user_id, task.deleted_at as deletion_time
  from public.tasks task where task.deleted_at is not null
  union
  select child.id, child.user_id, coalesce(child.deleted_at, hidden.deletion_time)
  from public.tasks child join hidden on child.parent_id = hidden.id
    and child.user_id is not distinct from hidden.user_id
)
update public.tasks task set deleted_at = hidden.deletion_time
from hidden where task.id = hidden.id and task.deleted_at is null;

-- Share the hierarchy lock with parent validation, including direct API writes.
create function public.lock_task_deletion_tree() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(20261015, 1);
  return new;
end;
$$;
create trigger tasks_lock_deletion_tree before update of deleted_at on public.tasks
for each row when (old.deleted_at is distinct from new.deleted_at)
execute function public.lock_task_deletion_tree();

create function public.cascade_task_deletion() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.deleted_at is null and new.parent_id is not null and not exists (
    select 1 from public.tasks parent where parent.id = new.parent_id
      and parent.user_id is not distinct from new.user_id and parent.deleted_at is null
  ) then
    raise exception 'Parent task is deleted' using errcode = '23514';
  end if;

  -- Keep separately deleted branches deleted. Undo follows only its own timestamp.
  with recursive descendants as (
    select child.id from public.tasks child
    where child.parent_id = new.id and child.user_id is not distinct from new.user_id
      and case when new.deleted_at is null then child.deleted_at = old.deleted_at
        else child.deleted_at is null end
    union
    select child.id from public.tasks child join descendants on child.parent_id = descendants.id
    where child.user_id is not distinct from new.user_id
      and case when new.deleted_at is null then child.deleted_at = old.deleted_at
        else child.deleted_at is null end
  )
  update public.tasks child set deleted_at = new.deleted_at
  where child.id in (select id from descendants);
  return null;
end;
$$;
create trigger tasks_cascade_deletion after update of deleted_at on public.tasks
for each row when (old.deleted_at is distinct from new.deleted_at)
execute function public.cascade_task_deletion();

-- A JSON array is one RPC value, so Supabase's row limit cannot truncate a tree.
drop function public.delete_tasks(uuid[], text, uuid, timestamptz, boolean);
create function public.delete_tasks(
  task_ids uuid[], from_status text, task_parent_id uuid,
  deletion_time timestamptz, restoring boolean
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  affected_ids uuid[];
  result jsonb;
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

  perform pg_advisory_xact_lock(20261015, 1);
  perform task.id from public.tasks task
    where task.id = any(task_ids) and task.user_id = auth.uid()
    order by task.id for update;
  if (select count(*) from public.tasks task
    where task.id = any(task_ids) and task.user_id = auth.uid()
      and task.status = from_status and task.parent_id is not distinct from task_parent_id
      and case when restoring then task.deleted_at = deletion_time else task.deleted_at is null end
  ) <> cardinality(task_ids) then
    raise exception 'Selected tasks changed' using errcode = '23514';
  end if;

  with recursive tree as (
    select task.id from public.tasks task where task.id = any(task_ids) and task.user_id = auth.uid()
    union
    select child.id from public.tasks child join tree on child.parent_id = tree.id
      where child.user_id = auth.uid()
        and case when restoring then child.deleted_at = deletion_time else child.deleted_at is null end
  ) select array_agg(id) into affected_ids from tree;
  perform task.id from public.tasks task where task.id = any(affected_ids)
    order by task.id for update;

  -- The trigger handles descendants for both batch and individual updates.
  update public.tasks task set deleted_at = case when restoring then null else deletion_time end
    where task.id = any(task_ids) and task.user_id = auth.uid();
  select jsonb_agg(to_jsonb(task) order by task.id) into result from public.tasks task
    where task.id = any(affected_ids) and task.user_id = auth.uid();
  return result;
end;
$$;
revoke all on function public.delete_tasks(uuid[], text, uuid, timestamptz, boolean) from public, anon;
grant execute on function public.delete_tasks(uuid[], text, uuid, timestamptz, boolean) to authenticated;
revoke all on function public.lock_task_deletion_tree() from public, anon;
revoke all on function public.cascade_task_deletion() from public, anon;

commit;
