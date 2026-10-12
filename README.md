# Little list

A responsive personal todo notebook with warm light and dark themes. Built with Next.js App Router, TypeScript, Tailwind CSS, Radix primitives, and Supabase Postgres.

## Run locally

Use Node.js 24 LTS (`nvm use`), or at least Node.js 22.13.

```sh
npm install
cp .env.example .env.local
npm run dev
```

Open the address printed by Next.js. With both Supabase variables empty, the app uses browser local storage. This mode works immediately, but each browser has a separate list. Clearing browser storage removes that browser's tasks. Export the list to keep a copy.

## Connect the backend

1. Create a free Supabase project.
2. Run `supabase/migrations/202610130001_create_tasks.sql` in its SQL editor (or apply it through the Supabase CLI).
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
4. Restart the app. The footer should say **Cloud storage**.

Use a modern server secret key (`sb_secret_...`) from Supabase **Settings > API Keys** as the value of `SUPABASE_SERVICE_ROLE_KEY`. The variable name is retained for compatibility; the installed Supabase SDK supports modern secret keys. A legacy `service_role` key also works, but Supabase recommends modern secret keys for new setups. Keep it private; never add a `NEXT_PUBLIC_` prefix. Both values are required together. The app does not silently fall back to local storage when a configured backend fails.

Local tasks are not automatically migrated when connecting Supabase. Export them first and recreate them in the cloud notebook. JSON import is not implemented in this version.

## Deploy on Vercel

Push this project to your personal Git repository, import it into Vercel, and use the Next.js preset. Set both server environment variables for Production and any Preview environments that should use cloud storage. Run the database migration before deployment.

Preview deployments using the same Supabase project share production tasks. Leave preview variables unset for isolated browser-local previews, or use a separate database project. No Vercel or Supabase deployment has been created by this repository alone.

This version deliberately has no login or private-link protection. The cloud list is shared by every visitor. The task API is public and permits reading and modifying the list, including from scripts. Origin checks discourage cross-site browser writes; they are not authentication or abuse protection. `noindex` is not access control. Use a dedicated database project and avoid sensitive content. Add authentication and per-user ownership before opening this to an audience.

Supabase free projects can be paused after a seven-day period of low database activity. Resume a paused project in its dashboard. See https://supabase.com/docs/guides/platform/free-project-pausing.

## Organization

```text
src/
  app/                         Pages, layouts, global theme, HTTP route handlers
  components/                  Shared theme controls and accessible UI primitives
  features/tasks/
    domain/                    Types, validation, transitions, date/sort helpers
    server/                    Server-only repository and HTTP error handling
    client/                    Cloud and browser-local storage adapters
    hooks/                     Optimistic updates, rollback, refresh, and undo
    components/                Workspace, task rows, and editor
  lib/                         Shared utilities
supabase/migrations/           Versioned schema, constraints, timestamps, access rules
tests/                         Task rules, persistence, and HTTP regression tests
```

The UI depends on a storage interface, not the Supabase SDK. Route handlers validate requests; the server repository handles database operations. SQL constraints and a trigger enforce task state and completion timestamps. Row-level security blocks direct anonymous database access; the server service role accesses the table.

## Behavior

- Todo, In progress, and Done tabs; any task can move to any status.
- Quick capture; notes, due dates, stars, and a separate Focus today flag.
- Search title and notes within the selected status; starred active tasks sort first, completed tasks sort by completion time.
- Optimistic changes with rollback on failure. Mutations are serialized to avoid conflicting local state updates.
- One-step undo for adding, editing, moving, and deleting. Deletes are soft deletes; undo survives only in the current page session. Soft-deleted records remain in storage; automated cleanup is not configured.
- Light, dark, and system themes, persisted on each device.
- Keyboard shortcuts: `N` to capture, `/` to search, arrows to navigate status tabs.
- Refresh on window focus/visibility and browser storage changes. Cloud synchronization occurs when the app opens or regains focus, not continuously in real time. Concurrent edits use last-write-wins.
- JSON export of currently loaded, non-deleted tasks.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Commit `package-lock.json` for reproducible installations. Supabase integration requires a real project and configured credentials; local tests do not prove a hosted database connection.
