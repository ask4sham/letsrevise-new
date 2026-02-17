# Phase 10 — Launch checklist (www)

All items must be true before considering www launch. No new AI features; operational hardening only.

---

## Pre-launch (must all be true)

- [ ] **AI revision metrics visible** — `GET /api/admin/revision-metrics` returns attempts, completed, stub, byErrorCode, lastCompletedAt.
- [ ] **ErrorCode distribution visible** — Metrics include `byErrorCode` so you can see NOT_ALLOWLISTED, ROLLOUT_EXCLUDED, ENGINE_SPAWN_FAILED, OPENAI_*, etc.
- [ ] **Alerts firing correctly in staging** — Poll `GET /api/admin/revision-alerts`; simulate ENGINE_SPAWN_FAILED or zero COMPLETED and confirm alerts appear; runbook links work.
- [ ] **Kill-switch verified** — Set `DISABLE_AI_REVISION_GENERATION=1` or config `killSwitch: true` (or `SLOTGEN_AI_KILL=true`); generate-revision returns 503 or STUB. Revert and confirm normal behaviour.
- [ ] **Rollout percent adjustable without code** — Change `config/revision-engine.json` `rolloutPercent` (or env `SLOTGEN_AI_ROLLOUT_PERCENT`); next request uses new value (no redeploy).
- [ ] **Support messaging in place** — 503 responses include `messageForUser`; 200 with STUB can show `messageForUser`; internal FAQ exists (`docs/ops/SUPPORT_FAQ_REVISION.md`).
- [ ] **First rollout at ≤5%** — Enable allowlist; set rollout to 1–5%. Observe for 24–48h.
- [ ] **No unexplained ENGINE_SPAWN_FAILED spikes** — If spawn failures occur, diagnose (cwd, path, env) before increasing rollout.

---

## Controlled public enablement (10.5)

**Initial settings**

- Allowlist enabled (rule phase9f-revision matching your target subject/level/board).
- Rollout = 1–5% (config file or `SLOTGEN_AI_ROLLOUT_PERCENT`).
- Heuristic fallback ON (default; do not set `REVISION_NO_FALLBACK=1` in production).
- `OPENAI_API_KEY` and `FEATURE_SLOTGEN_AI=true` set so the script can call OpenAI.

**Observe 24–48 hours**

- Watch `GET /api/admin/revision-metrics`: errorCode distribution, COMPLETED vs STUB ratio.
- Confirm no spike in ENGINE_SPAWN_FAILED or OPENAI_*; if so, fix before increasing rollout.
- Use `GET /api/admin/revision-alerts` (or your alerting) to catch issues early.

**Gradually increase rollout**

- Increase rollout percent (e.g. 5% → 10% → 25% → 50% → 100%) as long as metrics and alerts are healthy.
- Keep kill-switch available at all times (config file or env); flip if you need to stop AI immediately.

---

## Day-by-day (optional)

- **Day 1:** Deploy Phase 10 (metrics, alerts, runbooks, config file, support FAQ). Verify metrics and alerts in staging. Enable allowlist + 5% rollout in staging; run staging recipe from PHASE_9F doc.
- **Day 2:** Production deploy. Set rollout 1–5%. No public announcement yet; internal/limited traffic only. Monitor metrics and alerts.
- **Day 3–4:** Observe. If stable, plan rollout increase. If ENGINE_SPAWN_FAILED or OPENAI_* spike, fix and keep rollout low.
- **Day 5+:** Increase rollout stepwise. When confident, treat as “launched” for www; keep runbooks and kill-switch in place.

---

## After Phase 10

- You are safe to launch on www.
- You can scale rollout deliberately.
- You can explain every failure mode (errorCode + runbook).
- You can stop the system instantly (kill-switch) if needed.

Next: define what “launch” means (e.g. private beta vs public www) and communicate it to users and support.
