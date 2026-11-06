begin;

alter table public.tasks add column pin_color text;
alter table public.tasks add constraint tasks_pin_color_check
  check (pin_color is null or pin_color in ('olive', 'berry', 'sage', 'slate', 'cream'));

with ranked as (
  select id,
    row_number() over (
      partition by user_id
      order by rank, id
    ) as position
  from public.tasks
  where pinned and deleted_at is null
)
update public.tasks task
set pin_color = case ((ranked.position - 1) % 5)
  when 0 then 'olive'
  when 1 then 'berry'
  when 2 then 'sage'
  when 3 then 'slate'
  else 'cream'
end
from ranked
where ranked.id = task.id;

create function public.set_task_pin_color() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  pinned_count bigint;
begin
  if not new.pinned then
    new.pin_color := null;
  elsif tg_op = 'INSERT' or old.pinned is distinct from true or new.pin_color is null then
    select count(*) into pinned_count
    from public.tasks task
    where task.user_id is not distinct from new.user_id
      and task.pinned
      and task.deleted_at is null
      and task.id <> new.id;
    new.pin_color := case (pinned_count % 5)
      when 0 then 'olive'
      when 1 then 'berry'
      when 2 then 'sage'
      when 3 then 'slate'
      else 'cream'
    end;
  end if;
  return new;
end;
$$;

create trigger tasks_pin_color
before insert or update of pinned on public.tasks
for each row execute function public.set_task_pin_color();

revoke all on function public.set_task_pin_color() from public, anon, authenticated;

commit;
