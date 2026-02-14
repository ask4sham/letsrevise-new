# Phase 9F — Slot engine revision generation locked

`generateRevisionForLesson()` uses the locked OpenAI Slot Generation Engine when permitted; otherwise falls back to heuristic. Kill-switch dominates; allowlist and deterministic rollout apply. Engine telemetry is persisted on each draft for debugging.

**Tag:** `phase-9f-slot-engine-revision-locked`

---

## Order of gates (deny-by-default)

1. **Phase 9E kill-switch** — `DISABLE_AI_REVISION_GENERATION=1` → service throws; route returns 503. Dominates everything.
2. **Slot engine kill-switch** — `SLOTGEN_AI_KILL=true` → script returns STUB; service uses heuristic (or throws if no-fallback).
3. **Feature flag** — `FEATURE_SLOTGEN_AI=true` required for script to run AI (service passes this to child).
4. **Allowlist** — `slot-generation-allowlist.v1.json`: `enabled: true` and a rule matching the job (subject, level, board, kind `revision`). Rule **phase9f-revision** (auditable). Deny-by-default when disabled.
5. **Rollout** — `SLOTGEN_AI_ROLLOUT_PERCENT` (0–100). Deterministic bucket from `jobId`; job only runs AI if bucket < percent (0 = no gate).
6. **Metadata** — Job spec must have `metadata.allowAI: true`.

When any gate blocks: script returns STUB → service returns heuristic (or throws if `REVISION_NO_FALLBACK=1`).

---

## Observability: “engine unavailable” vs “engine denied”

- On **STUB** or non-completed, the service logs **one structured line** (info): `[revision-engine] {"status","errorCode","jobId","kind","rolloutBucket"}` so you can see whether the block was allowlist, rollout, or kill-switch.
- **LessonRevisionDraft.engine** stores the last run: `status`, `errorCode`, `jobId`, `kind`, `path`, `latencyMs`, `executorVersion`, `rolloutBucket`. Enables “why did this draft get heuristic?” without trawling server logs.

---

## REVISION_NO_FALLBACK (staging verification)

- **REVISION_NO_FALLBACK=1** (default off): when the engine returns STUB or fails (or output validation fails), the service **throws** instead of falling back.
- Route returns **503** with `code: "REVISION_ENGINE_UNAVAILABLE"` and `errorCode` (e.g. `NOT_ALLOWLISTED`, `ROLLOUT_EXCLUDED`, `KILL_SWITCH`). Use in staging to confirm the OpenAI path is exercised.

---

## Output validation

- Before accepting engine output, the service runs **validateRevisionOutput()**: `flashcards` must be an array of items with `front`/`back` strings; `quiz` must have finite `timeSeconds` and `questions` array with valid items. If invalid → treat as STUB (fallback or throw if no-fallback).

---

## Child process env (locked down)

- The spawned script receives **only**: `PATH`, `NODE_ENV`, `FEATURE_SLOTGEN_AI`, `SLOTGEN_AI_KILL`, `SLOTGEN_AI_ROLLOUT_PERCENT`, `SLOTGEN_ALLOWLIST_PATH`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`. No full `process.env` pass-through (reduces credential leakage and surprises).

---

## Wiring

- **backend/services/generateRevision.js**
  - Builds revision job spec; spawns script with **minimal env**; parses stdout and **stderr** (telemetry). If COMPLETED and **validateRevisionOutput** passes → return output + engine telemetry. Else → log structured line, then heuristic + telemetry or throw (no-fallback).
- **LessonRevisionDraft**
  - **engine** (Mixed): `{ status, errorCode, jobId, kind, path, latencyMs, executorVersion, rolloutBucket }` (and optional `source: "heuristic"` when fallback used). Bounded; no huge prompts.
- **scripts/run-slot-generation-openai.js**
  - When `jobs[0].kind === "revision"`, uses **slot-generation-prompt.revision.openai.v1.md**. Same allowlist (rule **phase9f-revision**), rollout, kill-switch, telemetry.

---

## Schema and allowlist

- **slot-generation.v1.schema.json** — `kind` enum includes **"revision"**.
- **slot-generation-allowlist.v1.json** — Rule **phase9f-revision**: `kinds: ["revision"]`, `appliesTo` subject/level/board/specVersion. Allowlist remains `enabled: false` by default.

---

## Tests

- **scripts/__tests__/run-slot-generation-openai.test.js** — Phase 9F: revision job returns schema-valid result (STUB when allowlist disabled).
- **backend/tests/revisionDraft.integration.test.js** — Generate creates draft with **engine** telemetry; allowlist disabled → draft.engine.status STUB; **REVISION_NO_FALLBACK=1** + allowlist disabled → 503 **REVISION_ENGINE_UNAVAILABLE** with **errorCode**.

---

## Tagging (one-time)

After CI is green, run each command on its own line (copy/paste-safe):

```
git tag -a phase-9f-slot-engine-revision-locked -m "Phase 9F slot engine revision locked: kind revision, prompt, allowlist, wiring, telemetry, tests"

git push origin phase-9f-slot-engine-revision-locked
```
