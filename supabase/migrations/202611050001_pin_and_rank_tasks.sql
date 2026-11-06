begin;

alter table public.tasks rename column starred to pinned;
alter table public.tasks add column rank text collate "C";

create function public.task_rank_encode(value bigint) returns text
language plpgsql immutable strict set search_path = '' as $$
declare
  alphabet constant text := '0123456789abcdefghijklmnopqrstuvwxyz';
  encoded text := '';
  remaining bigint := value;
begin
  if value <= 0 or value >= 4738381338321616895 then
    raise exception 'Task rank is outside the supported range' using errcode = '23514';
  end if;
  while remaining > 0 loop
    encoded := substr(alphabet, (remaining % 36)::integer + 1, 1) || encoded;
    remaining := remaining / 36;
  end loop;
  return lpad(encoded, 12, '0');
end;
$$;

create function public.task_rank_decode(value text) returns bigint
language plpgsql immutable strict set search_path = '' as $$
declare
  alphabet constant text := '0123456789abcdefghijklmnopqrstuvwxyz';
  decoded bigint := 0;
  character text;
begin
  if value !~ '^[0-9a-z]{12}$' then
    raise exception 'Invalid task rank' using errcode = '23514';
  end if;
  foreach character in array regexp_split_to_array(value, '') loop
    decoded := decoded * 36 + strpos(alphabet, character) - 1;
  end loop;
  return decoded;
end;
$$;

with ordered as (
  select id,
    row_number() over (
      partition by user_id, parent_id, status, pinned
      order by case when status = 'done' then completed_at end desc nulls last,
        created_at desc, id desc
    ) as position
  from public.tasks
)
update public.tasks task
set rank = public.task_rank_encode(ordered.position * 2176782336)
from ordered where ordered.id = task.id;

alter table public.tasks alter column rank set not null;
alter table public.tasks add constraint tasks_rank_format
  check (rank ~ '^[0-9a-z]{12}$');
create index tasks_active_rank_idx
  on public.tasks(user_id, parent_id, status, pinned desc, rank, id)
  where deleted_at is null;

create function public.place_task_at_scope_start() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  first_value bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(
    coalesce(new.user_id::text, 'unowned') || ':' || coalesce(new.parent_id::text, 'root') || ':' ||
    new.status || ':' || new.pinned::text, 0));
  if tg_op = 'UPDATE' and new.status is not distinct from old.status
    and new.parent_id is not distinct from old.parent_id
    and new.pinned is not distinct from old.pinned then
    return new;
  end if;
  select min(public.task_rank_decode(task.rank)) into first_value
  from public.tasks task
  where task.user_id is not distinct from new.user_id
    and task.parent_id is not distinct from new.parent_id
    and task.status = new.status and task.pinned = new.pinned
    and task.deleted_at is null and task.id <> new.id;
  new.rank := public.task_rank_encode(
    case
      when first_value is null then 2176782336
      when first_value > 2176782336 then first_value - 2176782336
      else first_value / 2
    end
  );
  return new;
end;
$$;
create trigger tasks_place_at_scope_start before insert or update of status, parent_id, pinned
on public.tasks for each row execute function public.place_task_at_scope_start();

create function public.move_task_rank(
  task_id uuid, before_id uuid, after_id uuid,
  destination_status text, destination_parent_id uuid, destination_pinned boolean
) returns public.tasks
language plpgsql security definer set search_path = '' as $$
declare
  moved public.tasks;
  lower_value bigint := 0;
  upper_value bigint := 4738381338321616895;
  next_value bigint;
begin
  if auth.uid() is null or destination_status not in ('todo', 'in_progress', 'done')
    or destination_pinned is null or task_id = before_id or task_id = after_id then
    raise exception 'Invalid task move' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    auth.uid()::text || ':' || coalesce(destination_parent_id::text, 'root') || ':' ||
    destination_status || ':' || destination_pinned::text, 0));

  select * into moved from public.tasks task
  where task.id = task_id and task.user_id = auth.uid() and task.deleted_at is null
  for update;
  if not found or moved.status <> destination_status
    or moved.parent_id is distinct from destination_parent_id
    or moved.pinned <> destination_pinned then
    raise exception 'Task scope changed' using errcode = '23514';
  end if;

  if before_id is not null then
    select public.task_rank_decode(task.rank) into lower_value
    from public.tasks task where task.id = before_id and task.user_id = auth.uid()
      and task.deleted_at is null and task.status = destination_status
      and task.parent_id is not distinct from destination_parent_id
      and task.pinned = destination_pinned and task.id <> task_id;
    if not found then raise exception 'Previous task changed' using errcode = '23514'; end if;
  end if;
  if after_id is not null then
    select public.task_rank_decode(task.rank) into upper_value
    from public.tasks task where task.id = after_id and task.user_id = auth.uid()
      and task.deleted_at is null and task.status = destination_status
      and task.parent_id is not distinct from destination_parent_id
      and task.pinned = destination_pinned and task.id <> task_id;
    if not found then raise exception 'Next task changed' using errcode = '23514'; end if;
  elsif before_id is not null and lower_value + 2176782336 < upper_value then
    upper_value := lower_value + 4353564672;
  end if;

  if lower_value >= upper_value or exists (
    select 1 from public.tasks task where task.user_id = auth.uid()
      and task.parent_id is not distinct from destination_parent_id
      and task.status = destination_status and task.pinned = destination_pinned
      and task.deleted_at is null and task.id <> task_id
      and public.task_rank_decode(task.rank) > lower_value
      and public.task_rank_decode(task.rank) < upper_value
  ) then
    raise exception 'Task neighbours changed' using errcode = '23514';
  end if;
  next_value := (lower_value + upper_value) / 2;
  if next_value = lower_value or next_value = upper_value then
    with ordered as (
      select task.id, row_number() over (order by task.rank, task.id) as position
      from public.tasks task where task.user_id = auth.uid()
        and task.parent_id is not distinct from destination_parent_id
        and task.status = destination_status and task.pinned = destination_pinned
        and task.deleted_at is null
    )
    update public.tasks task set rank = public.task_rank_encode(ordered.position * 2176782336)
    from ordered where task.id = ordered.id;
    lower_value := 0;
    upper_value := 4738381338321616895;
    if before_id is not null then
      select public.task_rank_decode(task.rank) into lower_value
      from public.tasks task where task.id = before_id;
    end if;
    if after_id is not null then
      select public.task_rank_decode(task.rank) into upper_value
      from public.tasks task where task.id = after_id;
    elsif before_id is not null then
      upper_value := least(lower_value + 4353564672, 4738381338321616895);
    end if;
    next_value := (lower_value + upper_value) / 2;
  end if;

  update public.tasks task set rank = public.task_rank_encode(next_value)
  where task.id = task_id returning task.* into moved;
  return moved;
end;
$$;

revoke all on function public.task_rank_encode(bigint) from public, anon, authenticated;
revoke all on function public.task_rank_decode(text) from public, anon, authenticated;
revoke all on function public.place_task_at_scope_start() from public, anon, authenticated;
revoke all on function public.move_task_rank(uuid, uuid, uuid, text, uuid, boolean)
  from public, anon;
grant execute on function public.move_task_rank(uuid, uuid, uuid, text, uuid, boolean)
  to authenticated;

commit;
