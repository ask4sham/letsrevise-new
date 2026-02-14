# Phase 11 — Automation levels (policy contract)

**System default: L1 (Safe Autopilot)**

---

## L0 — Observe

- **Behavior:** Detect + recommend only. No automatic actions.
- **Use:** Audit mode, post-incident review, or when human-only control is required.
- **Outputs:** Incidents, recommendations, runbook links. No config changes.

---

## L1 — Safe Autopilot

- **Behavior:** Reversible config toggles only. Rollout percent, kill-switch, allowlist enable (via config file). Actions are rate-limited and cooldown-applied.
- **Use:** Default for Phase 11. Reduces blast radius on OPENAI_* or ENGINE_SPAWN_FAILED without human in the loop for first response.
- **Constraints:** Only actions in the hard allowlist. Verification loop runs after each action; escalate if no improvement.

---

## L2 — Playbook Autopilot

- **Behavior:** Multi-step playbooks with verification gates. May chain: reduce rollout → wait → verify → reduce again or open incident.
- **Use:** When L1 is proven and you want sequenced responses (e.g. reduce to 5%, then 0 if still failing).
- **Constraints:** Each step must be allowlisted; verification required between steps.

---

## L3 — Human required

- **Behavior:** Irreversible or high-stakes actions. Autopilot never executes; it opens an incident and notifies. Human approves and performs action (e.g. deploy, change pricing, moderation).
- **Use:** Any action not in the allowlist (deploy code, modify prompts, payments, publish lessons, moderate content).

---

## Summary

| Level | Detect | Recommend | Reversible config | Multi-step | Irreversible |
|-------|--------|-----------|-------------------|------------|--------------|
| L0    | ✅     | ✅        | ❌                | ❌         | ❌           |
| L1    | ✅     | ✅        | ✅                | ❌         | ❌           |
| L2    | ✅     | ✅        | ✅                | ✅         | ❌           |
| L3    | ✅     | ✅        | ❌                | ❌         | Human only   |

---

## Phase 11 operational rollout

- **Single-flight:** `runTick()` must run single-flight across the cluster. The DB tick lock (`OpsTickLock`) with TTL ensures only one node runs a tick at a time; if the lock is held, the tick is skipped and logged.
- **Dry-run first:** Before enabling L1 on production, set **OPS_DRY_RUN=1**. Decisions are computed and “would execute” is logged; no config writes or incident creation. Optionally set **OPS_DRY_RUN_AUDIT=1** to write audit records with `result: "DRY_RUN"` for governance (prove what would have run over 48h). Run 24–48h, then switch to L1.
- **One action per tick:** By contract, at most one action is executed per tick (first playbook action only). Playbook edits cannot cause multiple actions in a single tick.
