# Phase 12 — Notifications + Tiny Admin UI (locked)

**Objective:** Rate-limited notifications (Slack-first) for key ops events; minimal admin UI to view status, incidents, audits, and use Phase 11 controls. No expansion of autopilot authority.

---

## 12.1 Notifications

### Event types

| Event | When emitted |
|-------|----------------------|
| `INCIDENT_OPENED` | New OPEN incident created (executor OPEN_INCIDENT or verifier escalation new incident) |
| `INCIDENT_ESCALATED` | Escalation (verifier): new or appended to existing incident |
| `KILL_SWITCH_ENABLED` | POST /api/ops/kill-switch with `enabled: true` |
| `AUTOPILOT_ACTION_FAILED` | Executor returns FAILED for an action |
| `HIGH_SEVERITY_DECISION` | (Optional; not wired by default) |

### Env vars

- **OPS_NOTIFY_SLACK** — `1` or `true` to enable Slack.
- **OPS_SLACK_WEBHOOK_URL** — Required if Slack enabled. Incoming webhook URL.
- **OPS_NOTIFY_EMAIL** — Optional; stub (not implemented).
- **OPS_NOTIFY_MAX_PER_HOUR** — Max notifications per hour (default 10).
- **OPS_NOTIFY_DEDUPE_MINUTES** — Per-event-type dedupe window in minutes (default 60).

### Rate limit and dedupe

- **Global:** No more than `OPS_NOTIFY_MAX_PER_HOUR` SENT notifications per hour.
- **Per incident + event:** Same `dedupeKey` (event type + incident id + channel) is never sent twice.
- **Per event type:** At most one SENT of a given event type within the dedupe window (default 60 min).

All attempts are logged in **OpsNotificationLog** (eventType, incidentId, dedupeKey, channel, result: SENT | SKIPPED | FAILED, errorMessage).

### Slack message content

- Environment (NODE_ENV)
- Incident type + severity
- Latest decision/playbookId and last actionType + result
- Top 3 errorCodes and counts (from snapshot)
- Link hint: “View ops status: GET /api/ops/status (or /admin/ops)”

### Tests / verification

- **Canonical command:** `npm run test:backend -- backend/tests/opsNotifier.test.js` (or run full backend suite: `npm run test:backend`).

### Rollback

- **Disable notifications:** Set `OPS_NOTIFY_SLACK=0` or leave `OPS_SLACK_WEBHOOK_URL` unset. No code change; notifications are skipped and logged as SKIPPED.
- Notifications are side-effect free: if the notifier fails, it logs FAILED and does not fail the tick or the request.

---

## 12.2 Admin UI

### Endpoint

- **GET /admin/ops** — Serves a single HTML page (backend-only minimal). No auth on the page load; data is loaded via API with admin token.

### What the page shows (read-only)

- **Automation state:** Level (L0/L1/L2), dry-run flag, manual kill-switch, open incident count.
- **Last decision:** incidentType, severity, confidence, playbookId (from GET /api/ops/status).
- **Open incidents:** List (type, severity, createdAt, status) from GET /api/ops/incidents.
- **Recent audits:** Last 50 OpsActionAudit rows; filter by SUCCESS / FAILED / DRY_RUN via GET /api/ops/audits?result=.

### Minimal controls (Phase 12.2b)

- **Set automation level:** POST /api/ops/level with `{ level: "L0"|"L1"|"L2" }`. Confirm dialog before send.
- **Toggle kill-switch:** POST /api/ops/kill-switch with `{ enabled: true|false }`. Confirm dialog.
- Manual override (POST /api/ops/override) can be added in the UI the same way; only allowlisted actions are accepted by the API.

### Auth

- All API calls require admin auth (Bearer token). The page uses a token input (or `?token=…` / sessionStorage) and sends `Authorization: Bearer <token>` on each request.

### Rollback

- UI is read-only for data and only triggers existing Phase 11 endpoints. Safe to leave in place. To remove, delete the route and the view file.

---

## Files

- **backend/contracts/opsNotifications.v1.js** — Event types, enable flags, destinations, rate/dedupe config, message templates.
- **backend/models/OpsNotificationLog.js** — Audit log for every notification attempt.
- **backend/services/opsNotifier.js** — notify(), shouldNotify(), formatSlackMessage(), notifySafe().
- **backend/services/slackWebhook.js** — sendSlack(webhookUrl, payload); timeout 5s.
- **backend/views/admin-ops.html** — Single HTML page for /admin/ops.
- **backend/routes/ops.js** — GET /api/ops/incidents, GET /api/ops/audits; notification wiring on kill-switch.
- **backend/services/opsActionExecutor.js** — INCIDENT_OPENED after OPEN_INCIDENT; AUTOPILOT_ACTION_FAILED on FAILED.
- **backend/services/opsVerifier.js** — INCIDENT_ESCALATED and INCIDENT_OPENED (when new) after escalation.
