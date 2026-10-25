-- Run separately in SQL Editor AFTER signing in once and checking your user UUID.
-- Replace the placeholder below. This transfers only unassigned legacy tasks.
begin;
do $$
declare
  owner_id uuid := '439d0b0a-876f-4c57-a9dc-b8aa926e347c';
begin
  if not exists (select 1 from auth.users where id = owner_id) then
    raise exception 'That Auth user does not exist';
  end if;
  lock table public.tasks in share row exclusive mode;
  update public.tasks set user_id = owner_id where user_id is null;
end;
$$;
commit;
