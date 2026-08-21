/**
 * Unit tests: Stripe Checkout session builder (B2 — no real Stripe calls).
 */
jest.mock("../config/stripe", () => ({
  LETSREVISE_PRO_PLAN_ID: "letsrevise_pro",
  getStripeConfig: jest.fn(),
  getStripeClient: jest.fn(),
}));

const { getStripeConfig, getStripeClient } = require("../config/stripe");
const {
  buildStripeCheckoutMetadata,
  createLetsReviseProCheckoutSession,
} = require("../services/stripeCheckoutService");

describe("stripeCheckoutService (B2)", () => {
  const mockCreate = jest.fn();
  const userId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    jest.clearAllMocks();
    getStripeConfig.mockReturnValue({
      priceIdLetsRevisePro: "price_test_letsrevise_pro_499",
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

  test("buildStripeCheckoutMetadata uses letsReviseUserId and letsrevise_pro", () => {
    expect(buildStripeCheckoutMetadata(userId)).toEqual({
      letsReviseUserId: String(userId),
      planId: "letsrevise_pro",
    });
  });

  test("createLetsReviseProCheckoutSession uses server-owned price, quantity 1, and metadata contract", async () => {
    const user = { _id: userId };

    const session = await createLetsReviseProCheckoutSession({
      user,
      customerId: "cus_test_bound",
    });

    expect(session.id).toBe("cs_test_123");
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const params = mockCreate.mock.calls[0][0];
    expect(params.mode).toBe("subscription");
    expect(params.line_items).toEqual([
      { price: "price_test_letsrevise_pro_499", quantity: 1 },
    ]);
    expect(params.customer).toBe("cus_test_bound");
    expect(params.metadata).toEqual({
      letsReviseUserId: String(userId),
      planId: "letsrevise_pro",
    });
    expect(params.subscription_data.metadata.planId).toBe("letsrevise_pro");
  });
});
