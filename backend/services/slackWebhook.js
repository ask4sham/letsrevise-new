// backend/services/slackWebhook.js — Phase 12.1.3
const axios = require("axios");

const TIMEOUT_MS = 5000;

/**
 * Send payload to Slack incoming webhook. Returns { ok, error? }.
 * Does not throw; errors are returned.
 */
async function sendSlack(webhookUrl, payload) {
  if (!webhookUrl || typeof webhookUrl !== "string" || !webhookUrl.trim()) {
    return { ok: false, error: "Missing webhook URL" };
  }
  try {
    const res = await axios.post(webhookUrl, payload, {
      timeout: TIMEOUT_MS,
      headers: { "Content-Type": "application/json" },
      validateStatus: () => true,
    });
    if (res.status >= 200 && res.status < 300) return { ok: true };
    return { ok: false, error: `Slack returned ${res.status}: ${res.data?.message || res.statusText || ""}` };
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

module.exports = { sendSlack, TIMEOUT_MS };
