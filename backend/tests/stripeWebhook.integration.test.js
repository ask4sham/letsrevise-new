/**
 * Integration: POST /api/webhooks/stripe (B3) — mocked signature verification.
 */
jest.mock("../config/stripe", () => {
  const actual = jest.requireActual("../config/stripe");
  return {
    ...actual,
    isStripeWebhookConfigured: jest.fn(),
    getStripeClient: jest.fn(),
  };
});

const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const StripeWebhookEvent = require("../models/StripeWebhookEvent");
const { isStripeWebhookConfigured, getStripeClient } = require("../config/stripe");

describe("POST /api/webhooks/stripe (B3)", () => {
  const mockConstructEvent = jest.fn();
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
    process.env.STRIPE_SECRET_KEY = "sk_test_webhook_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_dummy";
    isStripeWebhookConfigured.mockReturnValue(true);
    getStripeClient.mockReturnValue({
      webhooks: { constructEvent: mockConstructEvent },
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

  test("invoice.paid webhook activates paidThrough; admin grant subscriptionV2 unchanged", async () => {
    const periodEnd = Math.floor(Date.now() / 1000) + 86400;
    const payload = { id: "evt_integration_paid", type: "invoice.paid" };
    mockConstructEvent.mockReturnValue({
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
      .send(JSON.stringify(payload));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    const user = await User.findById(adminUserId).lean();
    expect(user.subscriptionV2.provider).toBe("admin");
    expect(user.stripeBilling.paidThrough).toEqual(new Date(periodEnd * 1000));
  });

  test("customer.subscription.deleted syncs status without clearing admin grant", async () => {
    mockConstructEvent.mockReturnValue({
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

  test("livemode=true signed event is rejected without processing", async () => {
    const periodEnd = Math.floor(Date.now() / 1000) + 86400;
    mockConstructEvent.mockReturnValue({
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

    const after = await User.findById(adminUserId).lean();
    expect(after.stripeBilling?.paidThrough).toEqual(before.stripeBilling?.paidThrough);

    const record = await StripeWebhookEvent.findOne({ eventId: "evt_integration_live_blocked" });
    expect(record).toBeNull();
  });
});
