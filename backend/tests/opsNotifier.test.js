// backend/tests/opsNotifier.test.js — Phase 12.1.6
const mongoose = require("mongoose");
const OpsNotificationLog = require("../models/OpsNotificationLog");
const opsNotifier = require("../services/opsNotifier");
const { EVENT_TYPES } = require("../contracts/opsNotifications.v1");

describe("opsNotifier", () => {
  const baseEvent = {
    type: EVENT_TYPES.INCIDENT_OPENED,
    incidentId: new mongoose.Types.ObjectId(),
    incidentType: "TEST",
    severity: "medium",
  };

  beforeAll(() => {
    process.env.OPS_NOTIFY_SLACK = "0";
    process.env.OPS_SLACK_WEBHOOK_URL = "";
  });

  afterEach(async () => {
    await OpsNotificationLog.deleteMany({});
  });

  test("enabled flag off → SKIPPED", async () => {
    process.env.OPS_NOTIFY_SLACK = "0";
    process.env.OPS_SLACK_WEBHOOK_URL = "";
    const result = await opsNotifier.notify({ ...baseEvent });
    expect(result.sent).toBe(false);
    expect(result.skipped).toBeDefined();
    const log = await OpsNotificationLog.findOne({ eventType: EVENT_TYPES.INCIDENT_OPENED }).lean();
    expect(log).toBeDefined();
    expect(log.result).toBe("SKIPPED");
  });

  test("dedupe: same dedupeKey prevents duplicate send", async () => {
    process.env.OPS_NOTIFY_SLACK = "1";
    process.env.OPS_SLACK_WEBHOOK_URL = "https://hooks.slack.com/invalid";
    await OpsNotificationLog.create({
      eventType: baseEvent.type,
      incidentId: baseEvent.incidentId,
      dedupeKey: opsNotifier.dedupeKey(baseEvent),
      channel: "slack",
      result: "SENT",
    });
    const result = await opsNotifier.notify({ ...baseEvent });
    expect(result.sent).toBe(false);
    expect(result.skipped).toBe("rate_limit_or_dedupe");
    const logs = await OpsNotificationLog.find({ eventType: EVENT_TYPES.INCIDENT_OPENED }).lean();
    expect(logs.length).toBe(2);
    expect(logs.some((l) => l.result === "SKIPPED")).toBe(true);
  });

  test("failure to send Slack logs FAILED without throwing", async () => {
    process.env.OPS_NOTIFY_SLACK = "1";
    process.env.OPS_SLACK_WEBHOOK_URL = "https://httpstat.us/500";
    const event = { ...baseEvent, incidentId: new mongoose.Types.ObjectId() };
    let threw = false;
    try {
      await opsNotifier.notify(event);
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(false);
    const log = await OpsNotificationLog.findOne({ dedupeKey: opsNotifier.dedupeKey(event) }).lean();
    expect(log).toBeDefined();
    expect(log.result).toBe("FAILED");
  });

  test("max/hour limit enforced", async () => {
    const orig = process.env.OPS_NOTIFY_MAX_PER_HOUR;
    process.env.OPS_NOTIFY_MAX_PER_HOUR = "2";
    process.env.OPS_NOTIFY_SLACK = "1";
    process.env.OPS_SLACK_WEBHOOK_URL = "https://hooks.slack.com/fake";
    const since = new Date(Date.now() - 30 * 60 * 1000);
    await OpsNotificationLog.create([
      { eventType: "A", incidentId: null, dedupeKey: "a:1", channel: "slack", result: "SENT", createdAt: since },
      { eventType: "B", incidentId: null, dedupeKey: "b:2", channel: "slack", result: "SENT", createdAt: since },
    ]);
    const event = { ...baseEvent, incidentId: new mongoose.Types.ObjectId() };
    const result = await opsNotifier.notify(event);
    expect(result.sent).toBe(false);
    expect(result.skipped).toBe("rate_limit_or_dedupe");
    if (orig !== undefined) process.env.OPS_NOTIFY_MAX_PER_HOUR = orig;
    else delete process.env.OPS_NOTIFY_MAX_PER_HOUR;
  });

  test("notifySafe never throws", async () => {
    process.env.OPS_NOTIFY_SLACK = "1";
    process.env.OPS_SLACK_WEBHOOK_URL = "https://invalid.url.example";
    const event = { ...baseEvent, incidentId: new mongoose.Types.ObjectId() };
    await expect(opsNotifier.notifySafe(event)).resolves.toBeDefined();
  });

  test("high severity event uses OPS_SLACK_WEBHOOK_URL_CRITICAL when set", () => {
    process.env.OPS_SLACK_WEBHOOK_URL = "https://default.webhook";
    process.env.OPS_SLACK_WEBHOOK_URL_CRITICAL = "https://critical.webhook";
    const highEvent = { type: EVENT_TYPES.INCIDENT_ESCALATED, severity: "high" };
    expect(opsNotifier.getSlackWebhookForEvent(highEvent)).toBe("https://critical.webhook");
    expect(opsNotifier.getSlackWebhookForEvent({ type: EVENT_TYPES.KILL_SWITCH_ENABLED })).toBe(
      "https://critical.webhook"
    );
    expect(opsNotifier.getSlackWebhookForEvent({ type: EVENT_TYPES.INCIDENT_OPENED, severity: "high" })).toBe(
      "https://critical.webhook"
    );
    expect(opsNotifier.getSlackWebhookForEvent({ ...baseEvent })).toBe("https://default.webhook");
    delete process.env.OPS_SLACK_WEBHOOK_URL_CRITICAL;
  });
});
