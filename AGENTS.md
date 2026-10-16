# Agent guidelines

- Read this file and relevant project documentation before making changes. Follow existing patterns and keep changes focused on the request.
- Ask before committing or pushing. Show the changes and wait for the user's approval before either action.
- Do not deploy, publish, or apply database migrations without the user's approval.
- For code changes, add or update tests for the behavior and run the relevant checks. For documentation-only changes, tests are not needed.
- Format every changed code or documentation file with Prettier before it is considered ready. Run `npm run format` to format changed files; `npm run format:check` is a required blocker and runs in pull request CI.
- Do not expose secrets or include private data in code, tests, logs, or documentation.
- Explain what changed and mention any checks that could not be completed.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
