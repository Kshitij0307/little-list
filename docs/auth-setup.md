# Google login and private notebooks

Cloud mode uses Google through Supabase Auth. Supabase handles Google identities and sessions; the app handles the login UI, cookie refresh, protected routes, and task operations. The database enforces which account owns each task.

## What changed

- `/login` offers **Continue with Google** in the app's light/dark notebook style.
- `/auth/callback` exchanges Supabase's single-use OAuth code for a cookie session. Redirects use the configured `APP_URL`, never a URL supplied by the visitor.
- `src/proxy.ts` refreshes sessions before pages and API handlers run. Session cookies are HTTP-only because authentication runs entirely on the server.
- The notebook layout verifies signed token claims before rendering. Account changes remount the shared task provider. Returning to an existing tab refreshes tasks once and compares the verified account ID in the response with the account already on screen. Sign-out removes the current browser session. Another device remains signed in.
- The task repository verifies signed token claims on each operation and uses that account's Supabase client. Unauthenticated task requests return `401`; expired sessions send the browser back to login.
- The cloud notebook layout loads initial tasks on the server using its verified session and passes them into the shared task provider. Home and task detail reloads render with that data; hydration does not fetch it again. Later refreshes still use the task API. An initial database failure shows an inline retry action, and local mode continues to read browser storage after mounting.
- Tasks have a `user_id` referencing Supabase Auth users. Row Level Security allows authenticated users to select, insert, and update only their own tasks. Ownership cannot be changed by an authenticated client. Physical deletion is not granted; existing soft deletion and undo continue working.
- A composite foreign key prevents a subtask from belonging to another user's parent task. Existing ancestry checks remain in place.
- No separate profile table, external state library, or password database is needed.

Local mode remains a browser-only development/demo notebook without login. It does not provide separate accounts on one shared browser and is not automatically imported into cloud storage.

## 1. Create the Google OAuth client

In [Google Cloud Console](https://console.cloud.google.com/), create or select a project, then open **Google Auth Platform** (older navigation may call this **APIs & Services → OAuth consent screen / Credentials**).

1. Configure the app name, support email, and audience. For a personal app, you can keep the OAuth app in Testing and add your Google account as a test user. Add other testers explicitly before inviting them.
2. Create an OAuth client with application type **Web application**.
3. Add your app origins under **Authorized JavaScript origins**:
   - `http://localhost:3000`
   - Your production HTTPS origin, such as `https://your-app.vercel.app`.
4. Add the **Supabase callback URL** under **Authorized redirect URIs**. Copy it from the Google provider panel in Supabase. It normally looks like `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
5. Copy the Google client ID and client secret into Supabase in the next step. Do not put the Google client secret in app source, the browser, or Git.

There are two different callbacks: **Google → Supabase** uses the Supabase `/auth/v1/callback` URL. **Supabase → our app** uses our `/auth/callback` URL. Putting the app callback into Google's redirect URI field will break this flow.

Reference: [Supabase Google login guide](https://supabase.com/docs/guides/auth/social-login/auth-google).

## 2. Configure Supabase Auth

In the existing Supabase project:

1. Open **Authentication → Sign In / Providers → Google** (dashboard labels may vary).
2. Enable Google and paste the Google OAuth client ID and secret. Save.
3. In **Authentication → URL Configuration**, set **Site URL** to the production app origin.
4. Add exact redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://YOUR_PRODUCTION_DOMAIN/auth/callback`
5. Add preview deployment callbacks only when you intentionally want previews to use this database. Avoid broadly allowing unrelated URLs.
6. Under project **Settings → API Keys**, copy the **publishable** key (`sb_publishable_...`) and project URL.

Google handles sign-in; no email/password forms or custom email delivery setup are required for this feature. A Google OAuth app in Testing only admits configured test users. For an audience beyond those testers, configure Google's publishing/verification requirements as applicable. Supabase signup restrictions also need to allow the intended users.

## 3. Set application environment variables

In `.env.local`:

```env
APP_STORAGE_MODE=cloud
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
APP_URL=http://localhost:3000
```

Restart the local app after editing environment variables.

Set the same variables in Vercel with `APP_URL` set to your exact production HTTPS origin. Remove the obsolete `SUPABASE_SERVICE_ROLE_KEY` from the app's Vercel configuration. The new implementation does not use that key, and substituting a secret key for the publishable key is explicitly rejected.

`APP_URL` is explicit so an untrusted request host cannot determine an OAuth redirect. Use each environment's actual URL; the production URL will send local login callbacks to production if copied into local configuration.

## 4. Apply the ownership migration during a coordinated release

**Review and approve the database change before running it.** First export/back up existing cloud tasks. The migration is a separate operation from pushing code to GitHub or deploying on Vercel.

For an existing project where the first two migrations are already applied, run only:

```text
supabase/migrations/202610260001_private_notebooks.sql
```

Open that file, copy its complete contents into Supabase SQL Editor, and run it once. For a fresh database, run all migration files in filename order.

This migration adds ownership and policies, keeps existing tasks unassigned, and revokes the old service-role table grants. **The old deployment's cloud API will stop working after this migration, until the new authenticated version is deployed.** Use a short maintenance window: back up, configure Auth and deployment variables, apply the reviewed migration, deploy the matching application, then verify login. Do not keep an old deployment serving shared cloud data alongside the private version. Preview deployments pointed at the same project are affected too.

An unassigned legacy task is invisible to all signed-in users. There is no automatic first-user claim and no public task-claim endpoint.

## 5. Assign your existing cloud tasks to yourself

1. Sign in with your Google account once. This creates your user entry in **Supabase → Authentication → Users**. Your notebook may initially be empty; old tasks are still preserved.
2. Find that exact email and copy its **User UID**. The Google account ID, email address, and Supabase project ID are not this UUID.
3. Open `supabase/admin/assign-legacy-tasks.sql` locally. Replace `REPLACE_WITH_YOUR_AUTH_USER_UUID` with your User UID in a copy of the script in SQL Editor.
4. Review the UUID and run the script once. Do not commit a personalized copy.
5. Refresh the notebook. It should now contain your old tasks and their subtask relationships.

This explicit administrator script assigns **only rows whose `user_id` is null**. It checks the user exists and runs in a transaction. It does not move tasks already owned by another account. It also updates existing task timestamps through the existing database trigger, so `updated_at` reflects the assignment time; creation and completion timestamps are preserved.

## 6. Verify with two accounts

Use separate browser profiles or a normal window plus a private window:

1. Sign in as account A. Confirm your old tasks are present and add a task with a subtask.
2. Sign in as account B. Its notebook must be empty initially. Add a distinct task.
3. In B's browser, open A's `/tasks/ID` URL. It should show not-found without A's task details.
4. Attempts to update A's task ID as B should return `404`. Attempts to attach B's task to A's parent must fail. Anonymous `/api/tasks` requests should return `401`.
5. Sign out, use Back, and switch between open tabs. Signed-out users should return to login on the next task request; switching accounts should discard the previous account's in-memory notebook when the task refresh completes.
6. Sign in as A on phone and laptop. Both should load A's same cloud notebook. The app refreshes when returning to a tab; it does not implement live collaboration/push updates.

Automated tests cover session verification, callback errors, owner-scoped queries, input validation, and existing task behavior. They do not replace testing actual Google credentials and deployed database policies with two real accounts.

## Security model and limits

The UI asks for login, the API verifies signed token claims, and Postgres independently enforces ownership through RLS. Application query filters provide an additional safeguard. A publishable key identifies the Supabase project; it does not grant access to another user's rows. Supabase project administrators retain administrative access; this is account privacy, not end-to-end encryption. Token verification checks signature and expiry; a session revoked remotely may remain usable until its current access token expires.

`getClaims()` normally verifies tokens locally using cached public keys when the Supabase project uses asymmetric signing keys. Projects using a legacy symmetric signing key still require an Auth network call. Returning to a tab keeps its existing notebook visible while tasks refresh; a changed account ID clears that state and reloads the notebook for the current account.

Keep authenticated responses private and uncached. Do not use shared response caching for task lists, sessions, or OAuth callbacks. Do not reintroduce service-role clients into normal user requests.

References: [Supabase cookie-based sessions](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
