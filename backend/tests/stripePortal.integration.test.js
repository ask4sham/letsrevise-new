/**
 * Integration tests: POST /api/subscriptions/create-portal-session (B5).
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

describe("POST /api/subscriptions/create-portal-session (B5)", () => {
  let portalToken;
  let noCustomerToken;
  const mockPortalCreate = jest.fn();
  const hashedPassword = bcrypt.hashSync("password123", 10);

  beforeAll(async () => {
    const portalUser = await User.create({
      firstName: "Zuri",
      lastName: "PortalUser",
      email: "stripe-b5-portal-user@test.com",
      password: hashedPassword,
      userType: "student",
      stripeBilling: {
        customerId: "cus_test_portal_user",
        planId: "letsrevise_pro",
        status: "active",
        paidThrough: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const portalLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: portalUser.email, password: "password123" });
    portalToken = portalLogin.body.token;

    const noCustomerUser = await User.create({
      firstName: "Zuri",
      lastName: "NoCustomer",
      email: "stripe-b5-no-customer@test.com",
      password: hashedPassword,
      userType: "student",
    });

    const noCustomerLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: noCustomerUser.email, password: "password123" });
    noCustomerToken = noCustomerLogin.body.token;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_integration_dummy";
    process.env.STRIPE_PRICE_ID_LETSREVISE_PRO = "price_test_letsrevise_pro_499";
    process.env.FRONTEND_URL = "https://app.letsrevise.test";
    isStripeCheckoutConfigured.mockReturnValue(true);
    getStripeClient.mockReturnValue({
      billingPortal: { sessions: { create: mockPortalCreate } },
    });
    mockPortalCreate.mockResolvedValue({
      id: "bps_test_integration",
      url: "https://billing.stripe.com/p/session/test_integration",
    });
  });

  test("401 without auth", async () => {
    const res = await request(app).post("/api/subscriptions/create-portal-session").send({});
    expect(res.status).toBe(401);
  });

  test("503 when Stripe is not configured", async () => {
    isStripeCheckoutConfigured.mockReturnValue(false);
    const res = await request(app)
      .post("/api/subscriptions/create-portal-session")
      .set("Authorization", `Bearer ${portalToken}`)
      .send({});
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("STRIPE_NOT_CONFIGURED");
  });

  test.each(["customerId", "customer", "return_url", "returnUrl", "configuration", "configurationId"])(
    "400 when client supplies forbidden key %s",
    async (key) => {
      const res = await request(app)
        .post("/api/subscriptions/create-portal-session")
        .set("Authorization", `Bearer ${portalToken}`)
        .send({ [key]: "evil" });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("CLIENT_BILLING_INPUT_NOT_ALLOWED");
      expect(res.body.rejectedKeys).toContain(key);
      expect(mockPortalCreate).not.toHaveBeenCalled();
    }
  );

  test("403 when authenticated user has no bound Stripe customer", async () => {
    const res = await request(app)
      .post("/api/subscriptions/create-portal-session")
      .set("Authorization", `Bearer ${noCustomerToken}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("NO_STRIPE_CUSTOMER");
    expect(mockPortalCreate).not.toHaveBeenCalled();
  });

  test("200 returns hosted portal URL using persisted server-owned customerId", async () => {
    const res = await request(app)
      .post("/api/subscriptions/create-portal-session")
      .set("Authorization", `Bearer ${portalToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.url).toBe("https://billing.stripe.com/p/session/test_integration");
    expect(mockPortalCreate).toHaveBeenCalledTimes(1);
    expect(mockPortalCreate).toHaveBeenCalledWith({
      customer: "cus_test_portal_user",
      return_url: "https://app.letsrevise.test/#/subscription",
    });
  });
});
