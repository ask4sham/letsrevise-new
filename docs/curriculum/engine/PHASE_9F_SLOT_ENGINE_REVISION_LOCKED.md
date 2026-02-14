# Phase 9F — Slot engine revision generation locked

`generateRevisionForLesson()` uses the locked OpenAI Slot Generation Engine when permitted; otherwise falls back to heuristic. Kill-switch dominates; allowlist and deterministic rollout apply.

**Tag:** `phase-9f-slot-engine-revision-locked`

---

## Order of gates (deny-by-default)

1. **Phase 9E kill-switch** — `DISABLE_AI_REVISION_GENERATION=1` → service throws; route returns 503. Dominates everything.
2. **Slot engine kill-switch** — `SLOTGEN_AI_KILL=true` → script returns STUB; service uses heuristic.
3. **Feature flag** — `FEATURE_SLOTGEN_AI=true` required for script to run AI (otherwise STUB).
4. **Allowlist** — `slot-generation-allowlist.v1.json`: `enabled: true` and a rule matching the job (subject, level, board, kind `revision`). Deny-by-default when disabled.
5. **Rollout** — `SLOTGEN_AI_ROLLOUT_PERCENT` (0–100). Deterministic bucket from `jobId`; job only runs AI if bucket < percent (0 = no gate).
6. **Metadata** — Job spec must have `metadata.allowAI: true`.

When any gate blocks: script returns STUB → service returns heuristic output (pipeline still works).

---

## Wiring

- **backend/services/generateRevision.js**
  - Builds a **revision** job spec (slot-generation.v1) from the lesson: `jobId` = lesson id, `kind: "revision"`, `input` = lesson context (title, subject, level, board, topic, pages).
  - Spawns **scripts/run-slot-generation-openai.js** with spec on stdin, cwd = repo root.
  - Parses stdout. If `status === "COMPLETED"` and `output` has `flashcards` or `quiz` → return output. Else → **heuristic fallback** (same as Phase 9E).
- **scripts/run-slot-generation-openai.js**
  - When `jobs[0].kind === "revision"`, uses **slot-generation-prompt.revision.openai.v1.md** (output = `{ flashcards, quiz }`).
  - Same allowlist, rollout, kill-switch, and telemetry as other kinds.

---

## Schema and allowlist

- **slot-generation.v1.schema.json** — `kind` enum includes **"revision"**.
- **slot-generation-allowlist.v1.json** — Rule `phase9f-revision`: `kinds: ["revision"]`, `appliesTo` subject/level/board/specVersion. Allowlist remains `enabled: false` by default (STUB/heuristic until enabled).

---

## Telemetry and result schema

- Script emits telemetry (stderr) per existing slot-generation-telemetry.v1 schema.
- Result validates against **slot-generation-result.v1.schema.json** (`output` object or null).

---

## Tests

- **scripts/__tests__/run-slot-generation-openai.test.js** — Phase 9F: revision job returns schema-valid result (STUB when allowlist disabled).
- **backend/tests/revisionDraft.integration.test.js** — Unchanged; generate-revision still creates draft (slot returns STUB → heuristic; pipeline green).

---

## Tagging (one-time)

After CI is green, run each command on its own line (copy/paste-safe):

```
git tag -a phase-9f-slot-engine-revision-locked -m "Phase 9F slot engine revision: allowlist, rollout, kill-switch, heuristic fallback"

git push origin phase-9f-slot-engine-revision-locked
```
