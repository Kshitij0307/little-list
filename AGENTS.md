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

## Preferred design direction

- Keep current and future pages part of the same calm, refined notebook interface. The approved login is the visual reference: warm paper, a subtle notebook margin, layered paper edges, restrained borders, and generous but purposeful spacing. Use paper details on primary notebook and page-state surfaces; do not repeat them around every row, field, or button.
- Use the shared theme tokens in `src/app/globals.css`: warm cream and olive in light mode, warm charcoal and sage in dark mode. Support light, dark, and system themes from the start. Avoid unrelated palettes, glossy effects, heavy shadows, or decorative gradients.
- Use regular-weight serif typography for prominent page headings and readable sans-serif text for controls, labels, and task content. Keep typography, corner radii, icon sizes, spacing, and button treatments consistent across related components.
- The font pairing is Georgia (with Times New Roman and serif fallbacks) for page and section headings, and Arial/Helvetica/sans-serif for task content, controls, and supporting text. Use the shared `--font-heading`, `--font-body`, and `--text-*` tokens from `src/app/globals.css`; keep font choices and the size scale centralized. Use the shared Brand and paper surface styles rather than recreating them on individual pages.
- Retain the Feather brand mark and the existing Lucide icon family. Reuse shared branding, buttons, fields, menus, and page-state components when their responsibilities match. Style components with CSS Modules and shared tokens instead of introducing parallel styles or new UI dependencies.
- Use the same Quiet leaf treatment for whole-page loading throughout the app: a centered leaf on a soft olive surface, a calm serif heading, a short status message, and subtle loading dots. Respect reduced-motion preferences and announce meaningful loading state changes accessibly.
- Use task-row skeletons inside the existing notebook when the home task list initially loads. Preserve the surrounding page structure, avoid displaying misleading empty-state messages or zero counts before data arrives, and keep existing tasks visible during ordinary background refreshes when the current account is verified. Do not show private content before session verification succeeds.
- Use the approved Notebook note style for unknown-error pages: paper edges and margin, the olive eyebrow “An unexpected error,” the heading “Something went wrong,” a short recovery message, a primary “Try again” button, and an outlined secondary “Back to notebook” button. Do not add the red warning icon from the earlier design proposal or expose raw exception details.
- Give missing pages a distinct Notebook note 404 treatment: an olive “404,” the heading “A page out of place,” a brief missing-page explanation, and a primary “Back to notebook” action. Keep unavailable private tasks from revealing another account’s data.
- Keep expected form, save, and connection failures close to the affected content with useful recovery actions and preserved drafts. Use the full-page unknown-error treatment when the page cannot continue; do not replace a usable editor with it for a routine failed operation.
- Design for phone and laptop together. Prefer simple layouts that reflow naturally, keep touch targets and keyboard focus clear, maintain readable contrast in both themes, and avoid forced split layouts or visual changes that disrupt existing navigation and editing behavior.
- Keep these approved patterns consistent as the app evolves. Inspect the existing shared components before adding new loading, error, or missing-page treatments. Present proposed visual changes for review when the user asks for designs before implementation.

## Interaction quality and regression prevention

- Proactively check interaction quality when adding or changing UI; do not wait for the user to report inconsistencies. Review related uses of a shared component, including main tasks and subtasks, and fix the shared cause where possible.
- Match cursor feedback to actual behavior: enabled clickable controls and checkbox labels should show a hand cursor; disabled controls should show an unavailable cursor and must not respond or display active hover styling. Keep text-entry cursors on editable text fields. Do not make non-clickable row spacing look clickable.
- Give task-opening areas useful hit areas and restrained theme-based hover feedback. Preserve visible keyboard focus and keyboard activation. Keep completion, star, detach, and menu actions independent so using them cannot accidentally open the task.
- Use touch targets of at least 44 by 44 CSS pixels for small controls on touch layouts. Expand the button or associated label rather than enlarging its icon. Check completed and disabled controls too, and verify that actions fit at narrow phone widths without horizontal overflow.
- Reuse shared buttons and menus for consistent interaction states. When an action removes its own control, such as clearing search, restore focus to the relevant surviving field rather than leaving keyboard users without a useful focus target.
- Routine focus checks and background refreshes must not hide or replace an already visible, verified notebook before a pending click completes. Preserve the selected task route and drafts when verification succeeds. Continue masking private content during hidden-tab and browser-history restoration checks until the account is verified.
- When changing security headers or authentication, verify that native Server Action form submissions still work before hydration or without JavaScript. Preserve origin validation; do not bypass it to conceal request failures. In particular, avoid restoring `Referrer-Policy: no-referrer`, which produces `Origin: null` for native form POSTs; the app uses `same-origin`.
- Verify affected interaction states in the browser, including enabled, hovered, keyboard-focused, and disabled states, in both themes and on laptop and phone layouts. Check computed styles and hit areas when CSS behavior is uncertain; passing unit tests alone does not establish visual correctness. Check a production preview when CSS ordering could affect the result.
- After fixing a recurring bug, add a concise, generally applicable prevention rule here when it teaches something new. Keep lasting behavioral regression coverage where appropriate, following the existing temporary-test policy. Record verified causes and practical checks rather than speculative diagnoses or a running bug diary.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
