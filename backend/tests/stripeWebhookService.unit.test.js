/**
 * Unit tests: Stripe webhook service (B3 — mocked Stripe API).
 */
jest.mock("../config/stripe", () => ({
  LETSREVISE_PRO_PLAN_ID: "letsrevise_pro",
  getStripeConfig: jest.fn(),
  getStripeClient: jest.fn(),
}));

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const StripeWebhookEvent = require("../models/StripeWebhookEvent");
const { getStripeConfig, getStripeClient } = require("../config/stripe");
const {
  handleCheckoutSessionCompleted,
  handleInvoicePaid,
  handleStripeWebhookEvent,
} = require("../services/stripeWebhookService");

describe("stripeWebhookService (B3)", () => {
  let userId;
  const mockRetrieve = jest.fn();

  beforeAll(async () => {
    const user = await User.create({
      firstName: "Webhook",
      lastName: "Student",
      email: "stripe-b3-webhook-unit@test.com",
      password: bcrypt.hashSync("password123", 10),
      userType: "student",
      stripeBilling: { customerId: "cus_webhook_unit" },
    });
    userId = user._id;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await StripeWebhookEvent.deleteMany({});
    getStripeConfig.mockReturnValue({
      priceIdLetsRevisePro: "price_test_letsrevise_pro_499",
    });
    getStripeClient.mockReturnValue({
      subscriptions: { retrieve: mockRetrieve },
    });
  });

  test("checkout.session.completed binds ids without paidThrough", async () => {
    await handleCheckoutSessionCompleted({
      id: "cs_test",
      customer: "cus_webhook_unit",
      subscription: "sub_checkout_bind",
      client_reference_id: String(userId),
      metadata: { letsReviseUserId: String(userId), planId: "letsrevise_pro" },
    });

    const user = await User.findById(userId).lean();
    expect(user.stripeBilling.subscriptionId).toBe("sub_checkout_bind");
    expect(user.stripeBilling.planId).toBe("letsrevise_pro");
    expect(user.stripeBilling.paidThrough).toBeFalsy();
    expect(user.subscriptionV2?.provider).toBeFalsy();
  });

  test("invoice.paid on active subscription advances paidThrough via atomic update", async () => {
    const periodEnd = Math.floor(Date.now() / 1000) + 86400;
    mockRetrieve.mockResolvedValue({
      id: "sub_paid",
      customer: "cus_webhook_unit",
      status: "active",
      current_period_end: periodEnd,
      cancel_at_period_end: false,
      metadata: { letsReviseUserId: String(userId), planId: "letsrevise_pro" },
      items: { data: [{ price: { id: "price_test" } }] },
    });

    const saveSpy = jest.spyOn(User.prototype, "save");

    await handleInvoicePaid({
      id: "in_test",
      customer: "cus_webhook_unit",
      subscription: "sub_paid",
      created: periodEnd - 120,
      metadata: { letsReviseUserId: String(userId) },
      lines: { data: [{ period: { end: periodEnd } }] },
      status_transitions: { paid_at: periodEnd - 30 },
    });

    expect(saveSpy).not.toHaveBeenCalled();
    saveSpy.mockRestore();

    const user = await User.findById(userId).lean();
    expect(user.stripeBilling.status).toBe("active");
    expect(user.stripeBilling.paidThrough).toEqual(new Date(periodEnd * 1000));
    expect(user.stripeBilling.lastInvoicePaidAt).toEqual(new Date((periodEnd - 30) * 1000));
    expect(user.subscriptionV2?.provider).toBeFalsy();
  });

  test("duplicate processed webhook does not mutate again", async () => {
    const event = {
      id: "evt_duplicate_test",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_dup",
          customer: "cus_webhook_unit",
          subscription: "sub_dup",
          client_reference_id: String(userId),
          metadata: { letsReviseUserId: String(userId), planId: "letsrevise_pro" },
        },
      },
    };

    await handleStripeWebhookEvent(event);
    await User.updateOne(
      { _id: userId },
      { $set: { "stripeBilling.subscriptionId": "sub_mutated_once" } }
    );

    const second = await handleStripeWebhookEvent(event);
    expect(second.duplicate).toBe(true);

    const user = await User.findById(userId).lean();
    expect(user.stripeBilling.subscriptionId).toBe("sub_mutated_once");
  });

  test("failed event record is retryable", async () => {
    await StripeWebhookEvent.create({
      eventId: "evt_retry_test",
      type: "checkout.session.completed",
      status: "failed",
      errorMessage: "previous failure",
    });

    const event = {
      id: "evt_retry_test",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_retry",
          customer: "cus_webhook_unit",
          subscription: "sub_retry",
          client_reference_id: String(userId),
          metadata: { letsReviseUserId: String(userId), planId: "letsrevise_pro" },
        },
      },
    };

    const result = await handleStripeWebhookEvent(event);
    expect(result.duplicate).toBe(false);

    const record = await StripeWebhookEvent.findOne({ eventId: "evt_retry_test" }).lean();
    expect(record.status).toBe("processed");
  });
});
