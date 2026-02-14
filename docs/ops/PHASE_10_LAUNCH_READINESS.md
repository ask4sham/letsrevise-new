# Phase 10 — Launch readiness for www

**Goal:** Make the system operationally safe, observable, controllable, and explainable for public www launch. No new AI features; launch-critical work only.

**See also:**

- **Launch-day scenario validation:** `docs/ops/PHASE_10_SCENARIO_VALIDATION.md` — Five concrete scenarios (baseline, allowlist forgotten, OpenAI outage, infra misconfig, AI silently off) and verification steps. Phase 10 is valid iff every scenario is detectable and admin has a clear next step.
- **Phase 10 → 11 transition:** `docs/ops/PHASE_10_TO_11_TRANSITION.md` — Boundary rule (observe vs act), frozen interfaces, Phase 11 allowed/forbidden actions, integration checklist. No remediation logic in Phase 10.

---

## 10.1 Observability & dashboards

- **Metrics:** In-process counters in `backend/services/revisionMetrics.js`. Recorded on every revision outcome. **Metrics reset on process restart; this is acceptable for Phase 10.** (Persist a rolling hourly summary to DB later if needed — Phase 11+; do not implement now.)
- **GET /api/admin/revision-metrics** (admin only): Returns `attempts`, `completed`, `stub`, `byErrorCode`, `lastCompletedAt`, `recent` (last 100 outcomes). **Read-only diagnostics; control actions are performed via config/env only.**
- **GET /api/admin/revision-alerts** (admin only): **Read-only diagnostics; control actions are performed via config/env only.**
- **Structured log:** Each outcome logs one line `[revision-metric]` with status, errorCode, and cumulative counts for log aggregators.

Answers: *Is AI actually running?* (completed &gt; 0), *Why are revisions falling back?* (byErrorCode), *Is failure increasing?* (recent + alerts).

---

## 10.2 Alerting & runbooks

- **GET /api/admin/revision-alerts** (admin only): Returns `{ ok, alerts }`. Read-only; no control. Conditions:
  - **SPIKE_ENGINE_SPAWN_FAILED** — ≥5 ENGINE_SPAWN_FAILED in last 100 outcomes.
  - **SPIKE_OPENAI_FAILURES** — ≥15 OPENAI_* in last 100 outcomes.
  - **ZERO_COMPLETED_OVER_N_HOURS** — No COMPLETED in last 4 hours despite attempts.

- **Runbook:** `docs/ops/RUNBOOK_REVISION_ENGINE.md` — for each alert: what it means, likely causes, what to check first, when to flip kill-switch.

Wire your alerting (PagerDuty, etc.) to poll `/api/admin/revision-alerts`; if `ok === false`, trigger incident and link runbook.

---

## 10.3 Admin / control plane (minimal)

**Option A — Config file (no redeploy):**

- **Path:** `config/revision-engine.json` (from repo root). Read on every spawn; missing file is ignored.
- **Shape:** `{ "killSwitch": false, "rolloutPercent": 5, "allowlistPath": "" }`.
  - **killSwitch** — `true` → same as `SLOTGEN_AI_KILL=true` (script returns STUB).
  - **rolloutPercent** — 0–100; overrides env.
  - **allowlistPath** — optional path to allowlist JSON; overrides env.
- Copy `config/revision-engine.json.example` to `config/revision-engine.json` and edit. Do not commit real `revision-engine.json` with production values.

**Option B — Environment variables:**

- **DISABLE_AI_REVISION_GENERATION=1** — Phase 9E kill-switch (route returns 503).
- **SLOTGEN_AI_KILL=true** — Slot engine kill-switch (STUB).
- **SLOTGEN_AI_ROLLOUT_PERCENT** — 0–100.
- **SLOTGEN_ALLOWLIST_PATH** — Path to allowlist file. Allowlist file itself has `enabled: true/false` and rules.

Config file overrides env when present. No client-side control; no redeploy-unsafe toggles (file or env change takes effect on next request or process restart).

---

## 10.4 Support & UX messaging

- **API:** Generate-revision response includes `draft.engine` with `status`, `errorCode`. When status is STUB or engine unavailable, frontend can show a short message (e.g. “Revision generated using standard content; AI assist was not used for this lesson.”).
- **503 REVISION_ENGINE_UNAVAILABLE:** Frontend should show a clear “Revision is temporarily unavailable” and avoid “AI is broken” wording.
- **Internal FAQ:** `docs/ops/SUPPORT_FAQ_REVISION.md` — Why didn’t AI generate? What does revision unavailable mean? How do I tell if AI is enabled?

---

## 10.5 Controlled public enablement

- **Initial:** Allowlist enabled, rollout 1–5%, heuristic fallback ON. Observe 24–48h: errorCode distribution, COMPLETED vs STUB ratio.
- **Then:** Gradually increase rollout. Keep kill-switch available at all times.
- **Checklist:** `docs/ops/PHASE_10_LAUNCH_CHECKLIST.md`.

---

## Launch readiness checklist (all must be true)

- [ ] AI revision metrics visible (`GET /api/admin/revision-metrics`)
- [ ] ErrorCode distribution visible in metrics
- [ ] Alerts firing correctly in staging (poll `/api/admin/revision-alerts`)
- [ ] Kill-switch verified (config or env)
- [ ] Rollout percent adjustable without code (config file or env)
- [ ] Support messaging in place (API + FAQ)
- [ ] First rollout at ≤5% observed for 24h
- [ ] No unexplained ENGINE_SPAWN_FAILED spikes
