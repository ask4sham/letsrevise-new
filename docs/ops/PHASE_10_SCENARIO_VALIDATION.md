# Phase 10 — Launch-day scenario validation

Realistic, concrete scenarios. Phase 10 is valid **if and only if**: every scenario is detectable, each failure mode has a human-readable explanation, no automatic destructive action is taken, and admin always has a clear next step.

**Alert ID mapping (Phase 10 implementation):**

| Scenario / user term | Phase 10 alert id | Notes |
|----------------------|-------------------|--------|
| OPENAI_ERROR_SPIKE   | `SPIKE_OPENAI_FAILURES` | Same condition: OPENAI_* spike in recent outcomes |
| NO_COMPLETED         | `ZERO_COMPLETED_OVER_N_HOURS` | No COMPLETED in last N hours despite attempts |

---

## Scenario 1: “Everything works” (baseline)

**Situation:** Allowlist enabled, rollout = 5%, OpenAI reachable. COMPLETED revisions flowing.

**Expected system behavior:**

- `revisionMetrics.completed` > 0
- No alerts fired
- `GET /api/admin/revision-alerts` → `{ ok: true, alerts: [] }`
- Drafts show AI-generated content
- `messageForUser` not shown (normal path)

**Verification:**

1. Generate ≥10 revisions (allowlist on, rollout 5%, valid OpenAI).
2. Confirm `GET /api/admin/revision-metrics` shows `completed` incrementing.
3. Confirm `GET /api/admin/revision-alerts` returns `ok: true`, `alerts: []`.
4. Confirm draft `engine.status === "COMPLETED"` and response has no `messageForUser` (or only when STUB).

**Phase 10 verdict:** ✅ Detectable via metrics; no alert is correct; explanation = “AI running normally.”

---

## Scenario 2: Allowlist forgotten (very common)

**Situation:** FEATURE_SLOTGEN_AI=true, rollout = 5%, **allowlist disabled** (default). Admin expects AI but hasn’t enabled allowlist.

**Expected behavior:**

- Slot engine returns STUB + NOT_ALLOWLISTED
- Heuristic fallback used
- `draft.engine.errorCode` = NOT_ALLOWLISTED
- User sees: “Revision generated using standard content…”
- **No alert** (expected, not an incident)

**Verification:**

1. Disable allowlist (or leave default); keep rollout 5%.
2. Generate revision.
3. Confirm `draft.engine.status === "STUB"`, `draft.engine.errorCode === "NOT_ALLOWLISTED"`.
4. Confirm response includes `messageForUser` (“Revision generated using standard content…”).
5. Confirm no alert fired (`revision-alerts` ok or alerts don’t include spawn/OPENAI/zero-completed).
6. Confirm admin can diagnose via `GET /api/admin/revision-metrics` → `byErrorCode.NOT_ALLOWLISTED` visible.

**Phase 10 verdict:** ✅ Detectable via metrics and draft.engine; no alert by design; runbook/FAQ explain “why no AI.”

---

## Scenario 3: OpenAI outage / quota exhausted

**Situation:** Allowlist enabled, rollout > 0. OpenAI returns errors.

**Expected behavior:**

- Slot engine returns OPENAI_* (e.g. OPENAI_HTTP_ERROR, OPENAI_REQUEST_FAILED)
- Fallback used (unless REVISION_NO_FALLBACK=1)
- `revisionMetrics.byErrorCode` OPENAI_* counts spike
- **Alert fires:** `SPIKE_OPENAI_FAILURES` (≥15 OPENAI_* in last 100 outcomes)
- Runbook points to API key / quota / provider status
- **No automatic shutdown** (Phase 10 = observe only)

**Verification:**

1. Simulate OpenAI failure (mock, invalid key, or env that forces script to report OPENAI_*).
2. Generate enough revisions so OPENAI_* in last 100 ≥ 15 (or lower threshold in test).
3. Confirm `GET /api/admin/revision-alerts` returns `ok: false`, alert `id: "SPIKE_OPENAI_FAILURES"`.
4. Confirm runbook entry for “Spike: OPENAI_* failures” describes API key / quota / provider.
5. Confirm no automatic kill-switch or rollout change (Phase 10 does not act).

**Phase 10 verdict:** ✅ Detectable; alert fires; runbook gives next step; no automatic destructive action.

---

## Scenario 4: Infra misconfig (spawn/cwd/env)

**Situation:** Script path wrong, missing node binary, wrong cwd.

**Expected behavior:**

- ENGINE_SPAWN_FAILED
- `revisionMetrics.byErrorCode.ENGINE_SPAWN_FAILED` increments
- **Alert fires:** `SPIKE_ENGINE_SPAWN_FAILED` (≥5 in last 100)
- Runbook says “infra misconfig” and what to check
- Admin can flip kill-switch (config or env)

**Verification:**

1. Break script path (e.g. rename or remove `scripts/run-slot-generation-openai.js` temporarily, or point to wrong cwd).
2. Generate several revisions so ENGINE_SPAWN_FAILED in last 100 ≥ 5.
3. Confirm alert fires: `id: "SPIKE_ENGINE_SPAWN_FAILED"`.
4. Confirm runbook “Spike: ENGINE_SPAWN_FAILED” describes infra/cwd/path and when to flip kill-switch.
5. Confirm admin can fix path/cwd or set kill-switch via config/env.

**Phase 10 verdict:** ✅ Detectable; alert + runbook; admin has clear next step; no auto-remediation.

---

## Scenario 5: AI silently off (dangerous case)

**Situation:** Allowlist enabled, rollout > 0, **FEATURE_SLOTGEN_AI accidentally false** (or script never reaches OpenAI).

**Expected behavior:**

- Zero COMPLETED over 4 hours (all STUB or failures)
- **Alert fires:** `ZERO_COMPLETED_OVER_N_HOURS`
- Admin guided to env/config mismatch (runbook / FAQ)

**Verification:**

1. Set FEATURE_SLOTGEN_AI=false (or otherwise ensure script never returns COMPLETED); keep allowlist enabled, rollout > 0.
2. Generate revisions so there are attempts but no COMPLETED; wait or force `lastCompletedAt` older than 4h (or set `zeroCompletedHours: 0` in test for immediate fire).
3. Confirm alert fires: `id: "ZERO_COMPLETED_OVER_N_HOURS"`.
4. Confirm runbook/FAQ mention checking FEATURE_SLOTGEN_AI and allowlist/rollout/env.

**Phase 10 verdict:** ✅ Detectable; alert fires; human-readable explanation and next step.

---

## Phase 10 verdict check (summary)

| Criterion | Status |
|-----------|--------|
| Every scenario above is detectable | ✅ Metrics + alerts + draft.engine |
| Each failure mode has a human-readable explanation | ✅ Runbook + FAQ + messageForUser |
| No automatic destructive action is taken | ✅ Phase 10 read-only; control via config/env only |
| Admin always has a clear next step | ✅ Runbooks + revision-metrics + revision-alerts |

**Phase 10 is valid for launch-day scenarios.** When implementing Phase 11, use these scenarios to verify that automatic actions (e.g. reduce rollout) are only taken in response to these same signals, and remain reversible and auditable.
