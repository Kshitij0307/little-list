begin;

drop trigger if exists tasks_pin_color on public.tasks;
drop function if exists public.set_task_pin_color();
alter table public.tasks drop constraint if exists tasks_pin_color_check;
alter table public.tasks drop column if exists pin_color;

commit;
