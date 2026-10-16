# Little List

Little List is a calm, responsive task manager for capturing everyday work without unnecessary clutter. Its warm notebook-inspired interface works across desktop and mobile, with light, dark, and system themes.

## Features

- Organize tasks across **Todo**, **In progress**, and **Done**.
- Move tasks between statuses while preserving their details.
- Add notes, due dates, stars, and a **Focus today** flag.
- Break work into nested subtasks or move an existing task beneath another task.
- Search task titles and notes within the active status.
- Sort active tasks by importance and completed tasks by completion time.
- Undo recent additions, edits, moves, and deletions.
- Export the current task list as JSON.
- Use keyboard shortcuts: `N` for a new task and `/` for search.
- Choose a light, dark, or system-matched theme.
- Store tasks in the browser or connect a Supabase database for cloud storage.

## Technology

- [Next.js](https://nextjs.org/) with the App Router
- [React](https://react.dev/) and TypeScript
- [Supabase](https://supabase.com/) Postgres for optional cloud persistence
- [Zod](https://zod.dev/) for runtime validation
- [Radix UI](https://www.radix-ui.com/) primitives and Lucide icons
- Tailwind CSS utilities with project-specific global styles
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

Supabase is optional for local development. To enable shared cloud storage:

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Run the files in `supabase/migrations/` in filename order. Apply each migration only once.
4. Copy `.env.example` to `.env.local` if you have not already done so.
5. Select cloud storage and add the project URL and server secret to `.env.local`:

```env
APP_STORAGE_MODE=cloud
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_your_server_secret
```

6. Restart the development server.

Use a modern `sb_secret_...` key from **Supabase → Settings → API Keys**. Keep this value private and never prefix it with `NEXT_PUBLIC_`. When cloud mode and both credentials are configured, the footer displays **Cloud storage**.

Tasks already stored in the browser are not automatically copied to Supabase. Export them before switching storage modes if you want to retain a backup.

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
    components/                Task workspace, rows, and editor
    domain/                    Task types, validation, sorting, and rules
    hooks/                     Task state, optimistic updates, and undo
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
4. Set `APP_STORAGE_MODE=cloud`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in the desired Vercel environments.
5. Apply the Supabase migrations before using the deployed application.

With `APP_STORAGE_MODE=local`, each visitor receives a separate browser-local list. With the current cloud setup, the database list is shared because user accounts and per-user ownership are not implemented yet. Do not store sensitive information or make a cloud-backed deployment public until authentication is added.

## Data behavior

- Changes appear immediately and roll back if persistence fails.
- Mutations run in sequence to avoid conflicting updates in the same browser session.
- The app refreshes cloud data when the page opens or regains focus.
- Concurrent edits use last-write-wins behavior.
- Deletion is soft, and one-step undo is available during the current page session.
- Completing a parent task does not automatically complete its subtasks.
