// backend/contracts/opsNotifications.v1.js — Phase 12.1
// Channels: slack (required), email (optional stub). Rate limit + dedupe.

const CHANNELS = Object.freeze({ slack: "slack", email: "email" });

const EVENT_TYPES = Object.freeze({
  INCIDENT_OPENED: "INCIDENT_OPENED",
  INCIDENT_ESCALATED: "INCIDENT_ESCALATED",
  KILL_SWITCH_ENABLED: "KILL_SWITCH_ENABLED",
  AUTOPILOT_ACTION_FAILED: "AUTOPILOT_ACTION_FAILED",
  HIGH_SEVERITY_DECISION: "HIGH_SEVERITY_DECISION",
});

function isSlackEnabled() {
  return process.env.OPS_NOTIFY_SLACK === "1" || process.env.OPS_NOTIFY_SLACK === "true";
}

function isEmailEnabled() {
  return process.env.OPS_NOTIFY_EMAIL === "1" || process.env.OPS_NOTIFY_EMAIL === "true";
}

function getSlackWebhookUrl() {
  return process.env.OPS_SLACK_WEBHOOK_URL || "";
}

function getSlackWebhookUrlCritical() {
  return process.env.OPS_SLACK_WEBHOOK_URL_CRITICAL || "";
}

function getEmailTo() {
  return process.env.OPS_EMAIL_TO || "";
}

function getEmailFrom() {
  return process.env.OPS_EMAIL_FROM || "";
}

function getMaxNotificationsPerHour() {
  return parseInt(process.env.OPS_NOTIFY_MAX_PER_HOUR || "10", 10) || 10;
}
function getDedupeWindowMinutes() {
  return parseInt(process.env.OPS_NOTIFY_DEDUPE_MINUTES || "60", 10) || 60;
}
const MAX_NOTIFICATIONS_PER_HOUR = getMaxNotificationsPerHour();
const DEDUPE_WINDOW_MINUTES = getDedupeWindowMinutes();

function getMessageTemplate(eventType) {
  const templates = {
    INCIDENT_OPENED: { title: "Ops incident opened", body: "An incident was opened." },
    INCIDENT_ESCALATED: { title: "Ops incident escalated", body: "An incident was escalated." },
    KILL_SWITCH_ENABLED: { title: "Ops kill-switch enabled", body: "Manual kill-switch was enabled." },
    AUTOPILOT_ACTION_FAILED: { title: "Ops autopilot action failed", body: "An autopilot action failed." },
    HIGH_SEVERITY_DECISION: { title: "Ops high-severity decision", body: "A high-severity decision was made." },
  };
  return templates[eventType] || { title: "Ops event", body: String(eventType) };
}

module.exports = {
  CHANNELS,
  EVENT_TYPES,
  isSlackEnabled,
  isEmailEnabled,
  getSlackWebhookUrl,
  getSlackWebhookUrlCritical,
  getEmailTo,
  getEmailFrom,
  getMaxNotificationsPerHour,
  getDedupeWindowMinutes,
  MAX_NOTIFICATIONS_PER_HOUR,
  DEDUPE_WINDOW_MINUTES,
  getMessageTemplate,
};
