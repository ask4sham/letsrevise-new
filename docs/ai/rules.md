# AI Rules

## File-based memory workflow
- Always read `docs/ai/project-context.md` and `docs/ai/current-task.md` first.
- After any meaningful fix: update `docs/ai/current-task.md` and prepend a short dated note to `docs/ai/dev-log.md`.
- Update `docs/ai/project-context.md` only when architecture, deployment, or environment facts change.
- Keep docs concise and useful; no fluff.

## General
- Read `docs/ai/project-context.md` and `docs/ai/current-task.md` before making changes.
- Prefer small, safe, production-friendly fixes.
- Do not assume routes, env vars, or deployment behavior; inspect the code.

## Backend / API
- Never guess upload endpoints. Verify mounted routers in backend code.
- Keep backend startup resilient; optional integrations like Sentry must not crash deploys.
- Prefer explicit logging during debugging, then remove it after verification.

## Frontend
- Prefer same-origin `/api/...` usage on Netlify when proxying is available.
- Avoid fragile frontend-only URL rewriting when a canonical stored URL can solve the root cause.
- Preserve working production behavior while introducing improvements.

## Media / Uploads
- Prefer storing absolute/canonical asset URLs at insert time.
- Keep support for legacy relative URLs only as a compatibility layer, not as the primary mechanism.
- Avoid unsafe URL protocols such as `javascript:`, `data:`, and `vbscript:`.

## Migrations
- Migrations must support dry-run mode.
- Migrations must be idempotent.
- For nested Mongoose structures, reassign changed structures and use `markModified` where needed.
- Never trust dry-run/apply parity without verifying actual writes.

## Deployments
- After any env or frontend runtime logic changes, redeploy and clear cache where appropriate.
- Verify behavior from the public site, not from admin dashboards.
- If Render is failing, fix startup/runtime errors before debugging higher-level features.

## Cleanup
- Remove temporary debug logs after validation.
- Update `docs/ai/dev-log.md` after meaningful fixes.
- Update `docs/ai/current-task.md` to reflect the new active task.
