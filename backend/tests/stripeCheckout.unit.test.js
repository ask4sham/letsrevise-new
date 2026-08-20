/**
 * Unit tests: Stripe Checkout session builder (B2 — no real Stripe calls).
 */
jest.mock("../config/stripe", () => ({
  BIOLOGY_PRO_PLAN_ID: "biology_pro",
  getStripeConfig: jest.fn(),
  getStripeClient: jest.fn(),
}));

const { getStripeConfig, getStripeClient } = require("../config/stripe");
const {
  buildStripeCheckoutMetadata,
  createBiologyProCheckoutSession,
} = require("../services/stripeCheckoutService");

describe("stripeCheckoutService (B2)", () => {
  const mockCreate = jest.fn();
  const userId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    jest.clearAllMocks();
    getStripeConfig.mockReturnValue({
      priceIdBiologyPro: "price_test_biology_pro_499",
      frontendUrl: "https://app.letsrevise.test",
    });
    getStripeClient.mockReturnValue({
      checkout: { sessions: { create: mockCreate } },
    });
    mockCreate.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
    });
  });

  test("buildStripeCheckoutMetadata uses letsReviseUserId (frozen contract)", () => {
    expect(buildStripeCheckoutMetadata(userId)).toEqual({
      letsReviseUserId: String(userId),
      planId: "biology_pro",
    });
  });

  test("createBiologyProCheckoutSession uses server-owned price, quantity 1, and metadata contract", async () => {
    const user = { _id: userId };

    const session = await createBiologyProCheckoutSession({
      user,
      customerId: "cus_test_bound",
    });

    expect(session.id).toBe("cs_test_123");
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const params = mockCreate.mock.calls[0][0];
    expect(params.mode).toBe("subscription");
    expect(params.line_items).toEqual([
      { price: "price_test_biology_pro_499", quantity: 1 },
    ]);
    expect(params.customer).toBe("cus_test_bound");
    expect(params).not.toHaveProperty("customer_email");
    expect(params.client_reference_id).toBe(String(userId));
    expect(params.metadata).toEqual({
      letsReviseUserId: String(userId),
      planId: "biology_pro",
    });
    expect(params.subscription_data.metadata).toEqual({
      letsReviseUserId: String(userId),
      planId: "biology_pro",
    });
    expect(params.success_url).toBe(
      "https://app.letsrevise.test/subscription/success?session_id={CHECKOUT_SESSION_ID}"
    );
    expect(params.cancel_url).toBe("https://app.letsrevise.test/subscription/cancel");
  });

  test("service has no client price parameter — line_items use env price only", async () => {
    await createBiologyProCheckoutSession({ user: { _id: userId }, customerId: "cus_x" });
    const params = mockCreate.mock.calls[0][0];
    expect(params.line_items[0].price).toBe("price_test_biology_pro_499");
    expect(params.line_items[0].quantity).toBe(1);
    expect(params.line_items[0]).not.toHaveProperty("price_data");
  });
});
