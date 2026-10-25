# Agent guidelines

- Read this file and relevant project documentation before making changes. Follow existing patterns and keep changes focused on the request.
- Ask before committing or pushing. Show the changes and wait for the user's approval before either action.
- Do not deploy, publish, or apply database migrations without the user's approval.
- For code changes, add or update tests for the behavior and run the relevant checks. For documentation-only changes, tests are not needed.
- Distinguish one-time verification from lasting regression coverage. When a temporary test or script is useful only for the current investigation, create it, run it, inspect the result, and remove it after successful verification; summarize the result before finishing. Do not add one-time checks to the permanent test suite or CI. Keep tests that protect ongoing behavior or a bug that could recur, and remove obsolete or redundant tests when their coverage is no longer useful.
- Format every changed code or documentation file with Prettier before it is considered ready. Run `npm run format` to format changed files; `npm run format:check` is a required blocker and runs in pull request CI.
- Do not expose secrets or include private data in code, tests, logs, or documentation.
- Explain what changed and mention any checks that could not be completed.
- Treat maintainability as part of delivering a feature: keep responsibilities focused, reuse existing components and domain rules, and remove obsolete code instead of accumulating parallel implementations.
- Extract shared UI and behavior when there is concrete repetition. Prefer small, purpose-specific components and hooks; avoid speculative abstractions, unnecessary dependencies, and splitting files solely to reduce line counts.
- Keep related form fields together when it simplifies updates, validation, and reset behavior. Keep temporary UI state local, derive values instead of storing duplicate state, and define how drafts respond to refreshed data and undo.
- Give shared task data one clear owner. Introduce a provider or external store only when cross-component or cross-route requirements justify it; do not move local form state into a global store just to reduce useState calls.
- When the user requests an audit before implementation, review the relevant code and report findings, priorities, and proposed changes before modifying application code.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
