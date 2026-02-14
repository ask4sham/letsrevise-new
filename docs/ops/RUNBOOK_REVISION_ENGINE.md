# Runbook: Revision (AI) engine alerts — Phase 10.2

Alerts map directly to `draft.engine.errorCode` and metrics. No heuristics.

---

## Spike: ENGINE_SPAWN_FAILED

**Alert id:** `SPIKE_ENGINE_SPAWN_FAILED`

### What it means

The revision slot engine **child process is failing to start** (or crashing immediately). Revisions are falling back to heuristic; no AI is running.

### Likely causes

- Script missing or wrong path (e.g. `scripts/run-slot-generation-openai.js` not found from server cwd)
- Wrong working directory when spawning (server cwd ≠ repo root)
- Node not on `PATH` or wrong Node version
- Env not passed correctly (e.g. `FEATURE_SLOTGEN_AI`, `OPENAI_API_KEY` missing) — script may exit before making a call
- Allowlist file path wrong or unreadable (script may exit early)

### What to check first

1. **Server logs** — Look for `[revision-engine]` lines with `errorCode: "ENGINE_SPAWN_FAILED"`. Confirm it’s not a one-off (e.g. cold start).
2. **Process cwd** — Backend spawns with `cwd: repoRoot`. Ensure the process running the API has correct working directory (e.g. in systemd/docker, set `WorkingDirectory`).
3. **Script path** — Resolved as `path.resolve(backend/services/__dirname, '../../scripts/run-slot-generation-openai.js')`. Ensure that path exists on the host.
4. **Run script by hand** — From repo root: `node scripts/run-slot-generation-openai.js` with stdin JSON job; confirm it runs and prints JSON to stdout.

### When to flip kill-switch

- If **all** revision requests are ENGINE_SPAWN_FAILED and you can’t fix cwd/path/env quickly: set **DISABLE_AI_REVISION_GENERATION=1** (or **SLOTGEN_AI_KILL=true**) so the system fails fast and users get a clear “revision unavailable” instead of silent heuristic.
- Use kill-switch to stop the bleed while you fix infra; re-enable after deploy/cwd/path fix.

---

## Spike: OPENAI_* failures

**Alert id:** `SPIKE_OPENAI_FAILURES`

### What it means

The engine **is** running and calling OpenAI, but a high proportion of calls are failing (HTTP errors, timeouts, invalid response shape, etc.). Revisions are falling back to heuristic.

### Likely causes

- **OPENAI_API_KEY** invalid, expired, or rate-limited
- **OPENAI_BASE_URL** wrong or proxy down
- Model name/endpoint changed or unavailable
- Response not valid JSON or missing expected fields (model behaviour)
- Network/timeouts between server and OpenAI

### What to check first

1. **Metrics** — `GET /api/admin/revision-metrics`: inspect `byErrorCode` for `OPENAI_HTTP_ERROR`, `OPENAI_REQUEST_FAILED`, `OPENAI_NON_JSON_RESPONSE`, etc.
2. **Server logs** — `[revision-engine]` and script stderr; look for HTTP status and error bodies.
3. **OpenAI status / quota** — Check status page and account usage/limits.
4. **Key and base URL** — Confirm env vars are set and correct for the environment (staging vs prod).

### When to flip kill-switch

- If **all** revision requests are failing with OPENAI_* and you can’t fix key/network/model quickly: set **SLOTGEN_AI_KILL=true** (or **DISABLE_AI_REVISION_GENERATION=1**) so users get a clear “revision unavailable” and you avoid burning quota on repeated failures.
- Re-enable after key/network/model is fixed.

---

## Zero COMPLETED revisions over N hours

**Alert id:** `ZERO_COMPLETED_OVER_N_HOURS`

### What it means

There have been revision **attempts** in the last N hours (default 4), but **no** outcome was COMPLETED. Everyone is getting STUB (heuristic fallback) or errors.

### Likely causes

- Allowlist disabled or no job matching → NOT_ALLOWLISTED
- Rollout percent 0 or bucket excludes all current jobs → ROLLOUT_EXCLUDED
- Kill-switch on → KILL_SWITCH
- ENGINE_SPAWN_FAILED or OPENAI_* (see runbooks above)
- Combination of the above

### What to check first

1. **Metrics** — `GET /api/admin/revision-metrics`: `byErrorCode` and `lastCompletedAt`. Tells you whether the cause is gating (NOT_ALLOWLISTED, ROLLOUT_EXCLUDED, KILL_SWITCH) vs infra/OpenAI.
2. **Config** — Allowlist enabled? Rollout percent &gt; 0? SLOTGEN_AI_KILL and DISABLE_AI_REVISION_GENERATION not set?
3. If gating is intentional (e.g. rollout at 0%), this alert may be expected; consider increasing rollout or enabling allowlist when ready.

### When to flip kill-switch

- Usually **don’t** flip kill-switch for “zero COMPLETED” alone — it might be intentional (rollout 0%). Flip only if you’ve confirmed infra/OpenAI is broken and you want to fail fast (see OPENAI_* / ENGINE_SPAWN_FAILED runbooks).
