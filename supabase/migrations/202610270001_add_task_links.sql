begin;

alter table public.tasks
  add column link_url text,
  add constraint tasks_link_url_check check (
    link_url is null or (
      char_length(link_url) <= 2048
      and link_url ~* '^https?://[^[:space:]]+$'
    )
  );

-- Task updates use column-level grants; ownership remains enforced by RLS.
grant update (link_url) on public.tasks to authenticated;

commit;
