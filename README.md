# Little List

Little List is a calm, responsive task manager for capturing everyday work without unnecessary clutter. Its warm notebook-inspired interface works across desktop and mobile, with light, dark, and system themes.

## Features

- Organize tasks across **Todo**, **In progress**, and **Done**.
- Move tasks between statuses while preserving their details.
- Select multiple tasks within one status tab and move or soft-delete them together, including in subtask lists. Selection uses the existing circle while normal completion stays unchanged; one Undo reverses a batch. On the main list, Select tasks sits beside Focus today.
- Add notes, an optional web link, due dates, stars, and a **Focus today** flag.
- Save a post, reel, article, or other web page with context in its task notes, then open the saved link from task details. Links work on subtasks too.
- Open every task at its own shareable `/tasks/[id]` route.
- Break work into nested subtasks or move an existing task beneath another task.
- Track each task's subtasks in their own Todo, In progress, and Done tabs.
- Search task titles and notes within the active status.
- Sort active tasks by importance and completed tasks by completion time.
- Undo recent additions, edits, moves, and deletions.
- Export the current task list as JSON.
- Use keyboard shortcuts: `N` for a new task and `/` for search.
- Choose a light, dark, or system-matched theme.
- Sign in with Google for a private cloud notebook, shared across your own devices.
- Store tasks in the browser for a login-free local development mode.

## Technology

- [Next.js](https://nextjs.org/) with the App Router
- [React](https://react.dev/) and TypeScript
- [Supabase](https://supabase.com/) Postgres for optional cloud persistence
- [Zod](https://zod.dev/) for runtime validation
- [Radix UI](https://www.radix-ui.com/) primitives and Lucide icons
- CSS Modules for component styles, shared theme tokens, and Tailwind CSS base styles
- Vitest for automated tests

## Getting started

### Requirements

- Node.js 24 LTS, or Node.js 22.13 or newer
- npm

### Run locally

```sh
npm install
cp .env.example .env.local
npm run dev
```

Open the local address printed in the terminal. The example configuration sets `APP_STORAGE_MODE=local`, which stores tasks in the browser. Browser storage is specific to each browser and device.

## Supabase setup

Supabase is optional in local mode. Cloud mode uses Google sign-in and database-enforced task ownership. Follow [the authentication setup guide](docs/auth-setup.md) to configure Google, Supabase, environment variables, migrations, and your existing tasks.

Cloud configuration:

```env
APP_STORAGE_MODE=cloud
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
APP_URL=http://localhost:3000
```

Use your deployed HTTPS origin for `APP_URL` on Vercel. The app no longer uses `SUPABASE_SERVICE_ROLE_KEY`: normal task access uses the signed-in user's session and Row Level Security. Never substitute a secret key for the publishable key.

Browser-local tasks are not automatically copied to Supabase. Existing cloud tasks require an explicit administrator assignment to your account, described in the setup guide.

For task links on an existing cloud database, review and apply [the task links migration](supabase/migrations/202610270001_add_task_links.sql) before using this version. It adds an optional `link_url` column and allows authenticated users to update it under the existing ownership policies. Older tasks keep their notes and have no link until one is added. Local mode needs no database migration. Links accept full HTTP or HTTPS URLs; remove a saved link by clearing the field and saving.

Cloud bulk moves and deletion require [the batch actions migration](supabase/migrations/202610270002_batch_task_status.sql). Its transactions lock and validate the selected rows under the existing ownership policies before changing anything. Stale, inaccessible, or out-of-scope selections fail as a whole. Undo checks the selected roots’ deletion timestamp, status, and parent, then restores the descendants marked by that same deletion. Local mode saves the batch in one browser-storage write. If an earlier version of this batch migration is already installed, rerun the updated script to add the deletion operation.

## Available commands

```sh
npm run dev          # Start the development server
npm run build        # Create a production build
npm run start        # Run the production build
npm run typecheck    # Check TypeScript
npm run lint         # Run ESLint and the formatting check
npm test             # Run the test suite
npm run format       # Format changed files
npm run format:check # Check formatting without changing files
```

## Project structure

```text
src/
  app/                         Routes, layouts, global styles, and API handlers
  components/                  Shared interface and theme components
  features/tasks/
    client/                    Browser and cloud storage gateways
    components/                Workspace, list, form, subtasks, and scoped CSS modules
    domain/                    Task types, validation, sorting, and rules
    hooks/                     Shared task provider, mutations, undo, and local form drafts
    server/                    Database repository and HTTP helpers
  lib/                         Shared utilities
supabase/migrations/           Versioned database changes
tests/                         Domain, persistence, API, and regression tests
```

The interface talks to a storage gateway, allowing the same task experience to work with browser storage or the server API. API handlers validate incoming data before the repository writes to Supabase. Database constraints provide an additional layer of data integrity.

## Deployment

Little List can be deployed as a standard Next.js application on Vercel:

1. Push the repository to a Git provider.
2. Import the repository into Vercel.
3. Keep the detected Next.js build settings.
4. Set `APP_STORAGE_MODE=cloud`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `APP_URL` in the desired Vercel environments.
5. Apply the Supabase migrations before using the deployed application.

With `APP_STORAGE_MODE=local`, each browser has its own list without login; it is not an account-isolation mode on a shared device. In cloud mode, Google login is required and each account can access only its own tasks. Coordinate the authentication migration and deployment as described in [the setup guide](docs/auth-setup.md).

## Data behavior

For cloud notebooks, apply [the cascading deletion migration](supabase/migrations/202610270003_cascade_task_deletion.sql) after the batch actions migration. It adds database protection for individual and bulk deletion and marks any existing active descendants of deleted parents as deleted. Local browser data is repaired automatically when read. The batch RPC returns a single JSON array so large subtrees are not truncated by Supabase’s row limit.

- Changes appear immediately and roll back if persistence fails.
- One mutation runs at a time; overlapping writes are rejected while a save is in progress.
- The app refreshes cloud data when the page opens or regains focus.
- Forms preserve unsaved edits during refresh, update untouched fields from the latest task, and save only edited fields. Concurrent changes to the same field use last-write-wins behavior.
- Deletion is soft and includes every nested subtask across all statuses. One-step Undo restores that group, leaving previously deleted branches deleted, and survives navigation within the notebook. A subtask cannot be restored beneath a deleted parent.
- Completing a parent task does not automatically complete its subtasks.
- Bulk selection stays within the current status and parent. Select all affects the visible filtered rows, up to 500 at a time; changing tabs, search, or focus filters clears selection. Successful moves exit selection mode, while failed moves restore the rows and keep selection for retry. Undo reverses the batch only if its tasks still belong to that parent and destination status. As with individual status changes, completion timestamps are recalculated on reopening or completing tasks.
