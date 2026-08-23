/**
 * Integration: POST /api/webhooks/stripe (B3) — mocked signature verification.
 */
jest.mock("../config/stripe", () => {
  const actual = jest.requireActual("../config/stripe");
  return {
    ...actual,
    isStripeWebhookConfigured: jest.fn(),
    constructStripeWebhookEvent: jest.fn(),
    getStripeClient: jest.fn(),
  };
});

const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const StripeWebhookEvent = require("../models/StripeWebhookEvent");
const {
  isStripeWebhookConfigured,
  constructStripeWebhookEvent,
  getStripeClient,
} = require("../config/stripe");

describe("POST /api/webhooks/stripe (B3)", () => {
  const mockRetrieve = jest.fn();
  let adminUserId;

  beforeAll(async () => {
    const adminUser = await User.create({
      firstName: "Admin",
      lastName: "Grant",
      email: "stripe-b3-admin-grant@test.com",
      password: bcrypt.hashSync("password123", 10),
      userType: "student",
      subscriptionV2: {
        status: "trialing",
        provider: "admin",
        planId: "admin-pass-7d",
        expiresAt: new Date(Date.now() + 86400000 * 7),
      },
      stripeBilling: { customerId: "cus_admin_stripe" },
    });
    adminUserId = adminUser._id;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await StripeWebhookEvent.deleteMany({});
    delete process.env.STRIPE_LIVE_MODE_ENABLED;
    process.env.STRIPE_SECRET_KEY = "sk_test_webhook_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_dummy";
    isStripeWebhookConfigured.mockReturnValue(true);
    getStripeClient.mockReturnValue({
      subscriptions: { retrieve: mockRetrieve },
    });
  });

  test("503 when webhook secret not configured", async () => {
    isStripeWebhookConfigured.mockReturnValue(false);
    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .send("{}");
    expect(res.status).toBe(503);
  });

  test("flag off + livemode=false → accepted", async () => {
    const periodEnd = Math.floor(Date.now() / 1000) + 86400;
    constructStripeWebhookEvent.mockReturnValue({
      id: "evt_integration_paid",
      type: "invoice.paid",
      livemode: false,
      data: {
        object: {
          id: "in_integration",
          customer: "cus_admin_stripe",
          subscription: "sub_integration",
          metadata: { letsReviseUserId: String(adminUserId) },
          lines: { data: [{ period: { end: periodEnd } }] },
          status_transitions: { paid_at: periodEnd - 10 },
        },
      },
    });
    mockRetrieve.mockResolvedValue({
      id: "sub_integration",
      customer: "cus_admin_stripe",
      status: "active",
      current_period_end: periodEnd,
      cancel_at_period_end: false,
      metadata: { letsReviseUserId: String(adminUserId), planId: "letsrevise_pro" },
      items: { data: [{ price: { id: "price_test" } }] },
    });

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", "sig_test")
      .send(JSON.stringify({ id: "evt_integration_paid" }));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(constructStripeWebhookEvent).toHaveBeenCalledTimes(1);
  });

  test("invoice.paid webhook activates paidThrough; admin grant subscriptionV2 unchanged", async () => {
    const periodEnd = Math.floor(Date.now() / 1000) + 86400;
    constructStripeWebhookEvent.mockReturnValue({
      id: "evt_integration_paid",
      type: "invoice.paid",
      livemode: false,
      data: {
        object: {
          id: "in_integration",
          customer: "cus_admin_stripe",
          subscription: "sub_integration",
          metadata: { letsReviseUserId: String(adminUserId) },
          lines: { data: [{ period: { end: periodEnd } }] },
          status_transitions: { paid_at: periodEnd - 10 },
        },
      },
    });
    mockRetrieve.mockResolvedValue({
      id: "sub_integration",
      customer: "cus_admin_stripe",
      status: "active",
      current_period_end: periodEnd,
      cancel_at_period_end: false,
      metadata: { letsReviseUserId: String(adminUserId), planId: "letsrevise_pro" },
      items: { data: [{ price: { id: "price_test" } }] },
    });

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", "sig_test")
      .send(JSON.stringify({ id: "evt_integration_paid" }));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    const user = await User.findById(adminUserId).lean();
    expect(user.subscriptionV2.provider).toBe("admin");
    expect(user.stripeBilling.paidThrough).toEqual(new Date(periodEnd * 1000));
  });

  test("customer.subscription.deleted syncs status without clearing admin grant", async () => {
    constructStripeWebhookEvent.mockReturnValue({
      id: "evt_integration_deleted",
      type: "customer.subscription.deleted",
      livemode: false,
      data: {
        object: {
          id: "sub_integration",
          customer: "cus_admin_stripe",
          status: "canceled",
          metadata: { letsReviseUserId: String(adminUserId), planId: "letsrevise_pro" },
        },
      },
    });
    mockRetrieve.mockResolvedValue({
      id: "sub_integration",
      customer: "cus_admin_stripe",
      status: "canceled",
      current_period_end: Math.floor(Date.now() / 1000) + 3600,
      cancel_at_period_end: true,
      metadata: { letsReviseUserId: String(adminUserId), planId: "letsrevise_pro" },
      items: { data: [{ price: { id: "price_test" } }] },
    });

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", "sig_test")
      .send("{}");

    expect(res.status).toBe(200);

    const user = await User.findById(adminUserId).lean();
    expect(user.subscriptionV2.provider).toBe("admin");
    expect(user.stripeBilling.status).toBe("canceled");
  });

  test("flag off + livemode=true → 403 without processing", async () => {
    const periodEnd = Math.floor(Date.now() / 1000) + 86400;
    constructStripeWebhookEvent.mockReturnValue({
      id: "evt_integration_live_blocked",
      type: "invoice.paid",
      livemode: true,
      data: {
        object: {
          id: "in_live_blocked",
          customer: "cus_admin_stripe",
          subscription: "sub_live_blocked",
          metadata: { letsReviseUserId: String(adminUserId) },
          lines: { data: [{ period: { end: periodEnd } }] },
          status_transitions: { paid_at: periodEnd - 10 },
        },
      },
    });

    const before = await User.findById(adminUserId).lean();

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", "sig_live_test")
      .send(JSON.stringify({ id: "evt_integration_live_blocked" }));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("STRIPE_LIVE_EVENT_BLOCKED");
    expect(mockRetrieve).not.toHaveBeenCalled();
    expect(getStripeClient).not.toHaveBeenCalled();

    const after = await User.findById(adminUserId).lean();
    expect(after.stripeBilling?.paidThrough).toEqual(before.stripeBilling?.paidThrough);

    const record = await StripeWebhookEvent.findOne({ eventId: "evt_integration_live_blocked" });
    expect(record).toBeNull();
  });

  test("flag on + livemode=true → accepted", async () => {
    process.env.STRIPE_LIVE_MODE_ENABLED = "1";
    constructStripeWebhookEvent.mockReturnValue({
      id: "evt_integration_live_allowed",
      type: "customer.subscription.updated",
      livemode: true,
      data: {
        object: {
          id: "sub_live_allowed",
          customer: "cus_admin_stripe",
          status: "active",
          metadata: { letsReviseUserId: String(adminUserId), planId: "letsrevise_pro" },
        },
      },
    });
    mockRetrieve.mockResolvedValue({
      id: "sub_live_allowed",
      customer: "cus_admin_stripe",
      status: "active",
      current_period_end: Math.floor(Date.now() / 1000) + 86400,
      cancel_at_period_end: false,
      metadata: { letsReviseUserId: String(adminUserId), planId: "letsrevise_pro" },
      items: { data: [{ price: { id: "price_live" } }] },
    });

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", "sig_live_ok")
      .send(JSON.stringify({ id: "evt_integration_live_allowed" }));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  test("flag on + livemode=false → 403 STRIPE_TEST_EVENT_BLOCKED", async () => {
    process.env.STRIPE_LIVE_MODE_ENABLED = "1";
    constructStripeWebhookEvent.mockReturnValue({
      id: "evt_integration_test_blocked",
      type: "invoice.paid",
      livemode: false,
      data: { object: { id: "in_test_blocked", customer: "cus_admin_stripe" } },
    });

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", "sig_test_blocked")
      .send(JSON.stringify({ id: "evt_integration_test_blocked" }));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("STRIPE_TEST_EVENT_BLOCKED");
    expect(getStripeClient).not.toHaveBeenCalled();

    const record = await StripeWebhookEvent.findOne({ eventId: "evt_integration_test_blocked" });
    expect(record).toBeNull();
  });

  test("kill switch: live webhook verified while flag off → 403 not signature 400", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_kill_switch";
    delete process.env.STRIPE_LIVE_MODE_ENABLED;
    constructStripeWebhookEvent.mockReturnValue({
      id: "evt_kill_switch_live",
      type: "invoice.paid",
      livemode: true,
      data: { object: { id: "in_kill", customer: "cus_admin_stripe" } },
    });

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", "sig_kill_switch")
      .send(JSON.stringify({ id: "evt_kill_switch_live" }));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("STRIPE_LIVE_EVENT_BLOCKED");
    expect(constructStripeWebhookEvent).toHaveBeenCalledTimes(1);
    expect(getStripeClient).not.toHaveBeenCalled();
  });
});
