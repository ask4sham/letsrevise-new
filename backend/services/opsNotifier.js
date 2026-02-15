// backend/services/opsNotifier.js — Phase 12.1.2
const OpsNotificationLog = require("../models/OpsNotificationLog");
const slackWebhook = require("./slackWebhook");
const {
  EVENT_TYPES,
  isSlackEnabled,
  getSlackWebhookUrl,
  getSlackWebhookUrlCritical,
  getMaxNotificationsPerHour,
  getDedupeWindowMinutes,
  getMessageTemplate,
} = require("../contracts/opsNotifications.v1");

/**
 * Choose webhook URL: critical webhook when event is high-severity / escalated / kill-switch; else default.
 */
function getSlackWebhookForEvent(event) {
  const criticalUrl = getSlackWebhookUrlCritical();
  const useCritical =
    event.type === EVENT_TYPES.INCIDENT_ESCALATED ||
    event.type === EVENT_TYPES.KILL_SWITCH_ENABLED ||
    (event.severity && String(event.severity).toLowerCase() === "high");
  if (useCritical && criticalUrl) return criticalUrl;
  return getSlackWebhookUrl();
}

function DEDUPE_WINDOW_MS() {
  return getDedupeWindowMinutes() * 60 * 1000;
}

function dedupeKey(event) {
  const incidentId = (event.incidentId && event.incidentId.toString()) || "";
  return `${event.type}:${incidentId}:${event.channel || "slack"}`;
}

/**
 * Check global max per hour.
 */
async function countSentInLastHour() {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  return OpsNotificationLog.countDocuments({ result: "SENT", createdAt: { $gte: since } });
}

/**
 * Check per-incident-type dedupe: already sent this event type in window?
 */
async function lastSentForEventType(eventType) {
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS());
  const doc = await OpsNotificationLog.findOne({
    eventType,
    result: "SENT",
    createdAt: { $gte: since },
  })
    .sort({ createdAt: -1 })
    .lean();
  return doc?.createdAt ? new Date(doc.createdAt) : null;
}

/**
 * Check per-incident-id dedupe: already sent this exact dedupeKey?
 */
async function alreadySentDedupeKey(key) {
  const doc = await OpsNotificationLog.findOne({ dedupeKey: key, result: "SENT" }).lean();
  return !!doc;
}

/**
 * Returns true if we should send (not rate limited, not deduped).
 */
async function shouldNotify(event) {
  if (!event || !event.type) return false;
  if (!EVENT_TYPES[event.type]) return false;

  const channel = event.channel || "slack";
  if (channel === "slack" && (!isSlackEnabled() || !getSlackWebhookUrl())) {
    return false;
  }

  const count = await countSentInLastHour();
  if (count >= getMaxNotificationsPerHour()) return false;

  const key = dedupeKey(event);
  if (await alreadySentDedupeKey(key)) return false;

  const lastType = await lastSentForEventType(event.type);
  if (lastType && Date.now() - lastType.getTime() < DEDUPE_WINDOW_MS()) return false;

  return true;
}

/**
 * Format Slack block kit / text payload. Includes env, incident type/severity, decision/playbookId, last actionType+result, top 3 errorCodes, link hint.
 */
function formatSlackMessage(event) {
  const tpl = getMessageTemplate(event.type);
  const env = process.env.NODE_ENV || "development";
  const lines = [
    `*${tpl.title}*`,
    tpl.body,
    `*Environment:* ${env}`,
  ];
  if (event.incidentType) lines.push(`*Incident type:* ${event.incidentType}`);
  if (event.severity) lines.push(`*Severity:* ${event.severity}`);
  if (event.playbookId) lines.push(`*Playbook:* ${event.playbookId}`);
  if (event.decisionId) lines.push(`*Decision:* ${event.decisionId}`);
  if (event.actionType) lines.push(`*Last action:* ${event.actionType} → ${event.result || "—"}`);
  if (event.errorMessage) lines.push(`*Error:* ${event.errorMessage}`);
  if (event.errorCodes && event.errorCodes.length > 0) {
    const top = event.errorCodes.slice(0, 3).map((c) => `${c.code}: ${c.count}`).join(", ");
    lines.push(`*Top errorCodes:* ${top}`);
  } else if (event.byErrorCode && typeof event.byErrorCode === "object") {
    const entries = Object.entries(event.byErrorCode)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, 3);
    if (entries.length) {
      const top = entries.map((c) => `${c.code}: ${c.count}`).join(", ");
      lines.push(`*Top errorCodes:* ${top}`);
    }
  }
  lines.push("View ops status: GET /api/ops/status (or /admin/ops)");

  return {
    text: tpl.title,
    blocks: [{ type: "section", text: { type: "mrkdwn", text: lines.join("\n") } }],
  };
}

/**
 * Send notification. Side-effect free: on failure, log FAILED and do not throw.
 * Returns { sent: boolean, skipped?: string, failed?: string }.
 */
async function notify(event) {
  const channel = event.channel || "slack";
  const key = dedupeKey(event);

  const logEntry = {
    eventType: event.type,
    incidentId: event.incidentId || null,
    dedupeKey: key,
    channel,
    result: "SKIPPED",
    errorMessage: null,
  };

  if (channel === "slack" && !isSlackEnabled()) {
    await OpsNotificationLog.create(logEntry);
    return { sent: false, skipped: "slack_disabled" };
  }
  if (channel === "slack" && !getSlackWebhookUrl()) {
    await OpsNotificationLog.create(logEntry);
    return { sent: false, skipped: "no_webhook_url" };
  }

  const ok = await shouldNotify(event);
  if (!ok) {
    logEntry.result = "SKIPPED";
    logEntry.errorMessage = "rate_limit_or_dedupe";
    await OpsNotificationLog.create(logEntry);
    return { sent: false, skipped: "rate_limit_or_dedupe" };
  }

  if (channel === "slack") {
    const payload = formatSlackMessage(event);
    const webhookUrl = getSlackWebhookForEvent(event);
    const { ok: sendOk, error } = await slackWebhook.sendSlack(webhookUrl, payload);
    if (sendOk) {
      logEntry.result = "SENT";
      await OpsNotificationLog.create(logEntry);
      return { sent: true };
    }
    logEntry.result = "FAILED";
    logEntry.errorMessage = error || "Unknown error";
    await OpsNotificationLog.create(logEntry);
    return { sent: false, failed: logEntry.errorMessage };
  }

  logEntry.result = "SKIPPED";
  logEntry.errorMessage = "channel_not_implemented";
  await OpsNotificationLog.create(logEntry);
  return { sent: false, skipped: "channel_not_implemented" };
}

/**
 * Fire-and-forget: notify and never throw. Use from Phase 11 flows so notification failure does not fail the tick.
 */
async function notifySafe(event) {
  try {
    return await notify(event);
  } catch (e) {
    console.error("[ops-notifier] notify failed:", e && e.message ? e.message : e);
    try {
      await OpsNotificationLog.create({
        eventType: event?.type || "UNKNOWN",
        incidentId: event?.incidentId || null,
        dedupeKey: event ? dedupeKey(event) : "unknown",
        channel: event?.channel || "slack",
        result: "FAILED",
        errorMessage: e && e.message ? e.message : String(e),
      });
    } catch (logErr) {
      console.error("[ops-notifier] failed to log FAILED:", logErr);
    }
    return { sent: false, failed: e && e.message ? e.message : String(e) };
  }
}

module.exports = {
  notify,
  notifySafe,
  shouldNotify,
  formatSlackMessage,
  dedupeKey,
  getSlackWebhookForEvent,
};
