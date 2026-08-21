/**
 * Integration tests: POST /api/subscriptions/create-checkout-session (B2).
 * Stripe SDK is mocked — no real Stripe network calls.
 */
jest.mock("../config/stripe", () => {
  const actual = jest.requireActual("../config/stripe");
  return {
    ...actual,
    isStripeCheckoutConfigured: jest.fn(),
    getStripeClient: jest.fn(),
  };
});

const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const { isStripeCheckoutConfigured, getStripeClient } = require("../config/stripe");

describe("POST /api/subscriptions/create-checkout-session (B2)", () => {
  let token;
  let userId;
  let existingCustomerToken;
  let existingCustomerUserId;
  const mockSessionCreate = jest.fn();
  const mockCustomerCreate = jest.fn();
  const hashedPassword = bcrypt.hashSync("password123", 10);

  beforeAll(async () => {
    const user = await User.create({
      firstName: "Zuri",
      lastName: "NewCustomer",
      email: "stripe-b2-new-customer@test.com",
      password: hashedPassword,
      userType: "student",
    });
    userId = user._id;

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "stripe-b2-new-customer@test.com", password: "password123" });
    token = loginRes.body.token;

    const existing = await User.create({
      firstName: "Zuri",
      lastName: "ExistingCustomer",
      email: "stripe-b2-existing-customer@test.com",
      password: hashedPassword,
      userType: "student",
      stripeBilling: { customerId: "cus_test_preexisting" },
    });
    existingCustomerUserId = existing._id;

    const loginExisting = await request(app)
      .post("/api/auth/login")
      .send({ email: "stripe-b2-existing-customer@test.com", password: "password123" });
    existingCustomerToken = loginExisting.body.token;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_integration_dummy";
    process.env.STRIPE_PRICE_ID_LETSREVISE_PRO = "price_test_letsrevise_pro_499";
    process.env.FRONTEND_URL = "https://app.letsrevise.test";
    isStripeCheckoutConfigured.mockReturnValue(true);
    getStripeClient.mockReturnValue({
      customers: { create: mockCustomerCreate },
      checkout: { sessions: { create: mockSessionCreate } },
    });
    mockCustomerCreate.mockResolvedValue({ id: "cus_test_newly_created" });
    mockSessionCreate.mockResolvedValue({
      id: "cs_test_integration",
      url: "https://checkout.stripe.com/c/pay/cs_test_integration",
    });
  });

  test("401 without auth", async () => {
    const res = await request(app).post("/api/subscriptions/create-checkout-session").send({});
    expect(res.status).toBe(401);
  });

  test("503 when Stripe is not configured", async () => {
    isStripeCheckoutConfigured.mockReturnValue(false);
    const res = await request(app)
      .post("/api/subscriptions/create-checkout-session")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("STRIPE_NOT_CONFIGURED");
  });

  test.each([
    "priceId",
    "price",
    "line_items",
    "amount",
    "currency",
    "planId",
    "userId",
    "letsReviseUserId",
  ])("400 when client supplies forbidden key %s", async (key) => {
    const res = await request(app)
      .post("/api/subscriptions/create-checkout-session")
      .set("Authorization", `Bearer ${token}`)
      .send({ [key]: "evil" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("CLIENT_BILLING_INPUT_NOT_ALLOWED");
    expect(res.body.rejectedKeys).toContain(key);
    expect(mockCustomerCreate).not.toHaveBeenCalled();
    expect(mockSessionCreate).not.toHaveBeenCalled();
  });

  test("first Checkout binds Stripe customerId only; no entitlement fields set", async () => {
    const freshUser = await User.create({
      firstName: "Fresh",
      lastName: "Bind",
      email: `stripe-b2-fresh-bind-${Date.now()}@test.com`,
      password: hashedPassword,
      userType: "student",
    });
    const freshLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: freshUser.email, password: "password123" });
    const freshToken = freshLogin.body.token;

    const res = await request(app)
      .post("/api/subscriptions/create-checkout-session")
      .set("Authorization", `Bearer ${freshToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(mockCustomerCreate).toHaveBeenCalledTimes(1);
    expect(mockCustomerCreate.mock.calls[0][0].metadata).toEqual({
      letsReviseUserId: String(freshUser._id),
      planId: "letsrevise_pro",
    });
    expect(mockSessionCreate).toHaveBeenCalledTimes(1);

    const params = mockSessionCreate.mock.calls[0][0];
    expect(params.customer).toBe("cus_test_newly_created");
    expect(params.line_items).toEqual([{ price: "price_test_letsrevise_pro_499", quantity: 1 }]);
    expect(params.metadata.letsReviseUserId).toBe(String(freshUser._id));
    expect(params.subscription_data.metadata.letsReviseUserId).toBe(String(freshUser._id));
    expect(params.client_reference_id).toBe(String(freshUser._id));
    expect(params.success_url).toBe(
      "https://app.letsrevise.test/subscription/success?session_id={CHECKOUT_SESSION_ID}"
    );
    expect(params.cancel_url).toBe("https://app.letsrevise.test/subscription/cancel");

    const after = await User.findById(freshUser._id).lean();
    expect(after.stripeBilling.customerId).toBe("cus_test_newly_created");
    expect(after.stripeBilling.status).toBeFalsy();
    expect(after.stripeBilling.subscriptionId).toBeFalsy();
    expect(after.stripeBilling.paidThrough).toBeFalsy();
    expect(after.stripeBilling.currentPeriodEnd).toBeFalsy();
  });

  test("subsequent Checkout reuses persisted customerId without creating a new Stripe Customer", async () => {
    const res = await request(app)
      .post("/api/subscriptions/create-checkout-session")
      .set("Authorization", `Bearer ${existingCustomerToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(mockCustomerCreate).not.toHaveBeenCalled();
    expect(mockSessionCreate).toHaveBeenCalledTimes(1);
    expect(mockSessionCreate.mock.calls[0][0].customer).toBe("cus_test_preexisting");

    const after = await User.findById(existingCustomerUserId).lean();
    expect(after.stripeBilling.customerId).toBe("cus_test_preexisting");
    expect(after.stripeBilling.subscriptionId).toBeFalsy();
  });
});
