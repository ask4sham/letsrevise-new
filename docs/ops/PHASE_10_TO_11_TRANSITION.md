# Phase 10 → Phase 11 transition

**Boundary rule (critical):**

- **Phase 10 = Observe + Explain**
- **Phase 11 = Act (safely, reversibly)**

Do not move logic across this boundary accidentally. Phase 10 never executes control actions; Phase 11 consumes Phase 10’s signals and may execute allowed actions only.

---

## What Phase 10 hands off to Phase 11

**Inputs Phase 11 can rely on (authoritative signals):**

| Input | Source | Description |
|-------|--------|-------------|
| revisionMetrics snapshot | `GET /api/admin/revision-metrics` or `revisionMetrics.getSnapshot()` | attempts, completed, stub, byErrorCode, lastCompletedAt, recent |
| errorCode distribution | Same snapshot / logs | NOT_ALLOWLISTED, ROLLOUT_EXCLUDED, KILL_SWITCH, ENGINE_SPAWN_FAILED, OPENAI_*, etc. |
| alert flags | `GET /api/admin/revision-alerts` or `revisionMetrics.evaluateAlerts()` | ok, alerts[] with id, message, runbookRef |
| runbook identifiers | Alerts + docs/ops/RUNBOOK_REVISION_ENGINE.md | Map alert id to human procedure |
| config-based controls | config/revision-engine.json (and env fallback) | killSwitch, rolloutPercent, allowlistPath |

Phase 10 does not change these interfaces without a deliberate versioned change. **Phase 10 interfaces are frozen** for Phase 11 integration.

---

## Phase 11 responsibilities (and only these)

**Allowed automatic actions (initial set):**

- Reduce rollout percent
- Set rollout to 0
- Enable kill-switch (config or env)
- Open incident record
- Notify admin
- Verify improvement (e.g. re-check metrics after N minutes)

**Explicitly forbidden (still human-only):**

- Deploy code
- Modify prompts
- Change pricing
- Moderate content
- Handle payments
- Publish lessons

Phase 11 must not perform any of the forbidden actions. Remediation is limited to rollout and kill-switch plus incident/notification/verify.

---

## Phase 11 integration checklist

Before starting Phase 11, ensure:

1. **Freeze Phase 10 interfaces**
   - revisionMetrics API: `recordOutcome`, `getSnapshot`, `countInRecent`, `evaluateAlerts`
   - Alert semantics: `SPIKE_ENGINE_SPAWN_FAILED`, `SPIKE_OPENAI_FAILURES`, `ZERO_COMPLETED_OVER_N_HOURS`
   - Config file schema: `{ killSwitch?, rolloutPercent?, allowlistPath? }`
   - Admin endpoints: `GET /api/admin/revision-metrics`, `GET /api/admin/revision-alerts` (read-only)

2. **Treat Phase 10 alerts as read-only signals**
   - Phase 11 **consumes** alerts (e.g. polls or subscribes to evaluation result).
   - Phase 10 **never** executes actions; it only produces alerts.

3. **Implement Ops Autopilot as a separate module**
   - e.g. `backend/ops/*`
   - No logic added to the revision engine (generateRevision.js remains observe-only from Phase 11’s perspective).
   - No coupling to product routes; ops acts via config and audit only.

---

## Example: clean Phase 11 usage of Phase 10

**Phase 10 produces (conceptually):**

```json
{
  "ok": false,
  "alerts": [
    {
      "id": "SPIKE_OPENAI_FAILURES",
      "message": "18 OPENAI_* failures in last 100 outcomes",
      "runbookRef": "docs/ops/RUNBOOK_REVISION_ENGINE.md#spike-openai_failures"
    }
  ]
}
```

Phase 11 may enrich with severity and window (e.g. from metrics):

```json
{
  "alertId": "SPIKE_OPENAI_FAILURES",
  "severity": "high",
  "errorCodes": ["OPENAI_HTTP_ERROR"],
  "windowMinutes": 10
}
```

**Phase 11 decides:**

- Confidence high → allowed action: reduce rollout.

**Phase 11 executes:**

- Write `config/revision-engine.json` (or equivalent) with `rolloutPercent → 1`.
- Log audit record (e.g. OpsActionAudit).
- Wait 10 minutes.
- Re-evaluate metrics; verify error rate drops.
- If not improved → escalate (notify admin, open incident); do not take further automatic destructive action.

**Phase 10 stays untouched:** no new code in revisionMetrics, generateRevision, or admin routes for remediation.

---

## When ready to start Phase 11

1. Create **OpsIncident** and **OpsActionAudit** models (or equivalent) for audit trail.
2. Implement a **single safe playbook** first (e.g. `SPIKE_OPENAI_FAILURES` → reduce rollout, then verify).
3. Verify the **detect → act → verify → escalate** loop with the scenarios in PHASE_10_SCENARIO_VALIDATION.md.

Phase 10 is done and correct. Do not add remediation logic there.

---

## Production hardening (Phase 11)

- **runTick() must run single-flight across the cluster.** Use the DB tick lock (`OpsTickLock`): only one node may run a tick at a time; lock has TTL (e.g. 2–5 minutes). If the lock is held, skip the tick and log. Prevents duplicate actions when cron fires twice or multiple instances run.
- **Start in dry-run before enabling L1 on production.** Set `OPS_DRY_RUN=1`. The autopilot still computes decisions and logs “would execute” (action type + payload) but does not write config or open incidents. Run for 24–48 hours to confirm rules and no false positives, then remove dry-run and set L1.
