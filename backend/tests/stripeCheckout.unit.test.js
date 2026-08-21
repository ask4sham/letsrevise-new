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
  createLetsReviseProCheckoutForUser,
  findOpenLetsReviseProCheckoutSession,
} = require("../services/stripeCheckoutService");

describe("stripeCheckoutService (B2/B4)", () => {
  const mockCreate = jest.fn();
  const mockList = jest.fn();
  const userId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    jest.clearAllMocks();
    getStripeConfig.mockReturnValue({
      priceIdLetsRevisePro: "price_test_letsrevise_pro_499",
      frontendUrl: "https://app.letsrevise.test",
    });
    getStripeClient.mockReturnValue({
      checkout: { sessions: { create: mockCreate, list: mockList } },
    });
    mockList.mockResolvedValue({ data: [] });
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
    expect(params.success_url).toBe(
      "https://app.letsrevise.test/#/subscription/success?session_id={CHECKOUT_SESSION_ID}"
    );
    expect(params.cancel_url).toBe("https://app.letsrevise.test/#/subscription/cancel");
  });

  test("findOpenLetsReviseProCheckoutSession returns matching open LetsRevise Pro session for same user", async () => {
    mockList.mockResolvedValue({
      data: [
        {
          id: "cs_other_plan",
          url: "https://checkout.stripe.com/c/pay/cs_other_plan",
          mode: "subscription",
          metadata: { planId: "other_plan", letsReviseUserId: userId },
        },
        {
          id: "cs_open_pro",
          url: "https://checkout.stripe.com/c/pay/cs_open_pro",
          mode: "subscription",
          metadata: { planId: "letsrevise_pro", letsReviseUserId: userId },
        },
      ],
    });

    const session = await findOpenLetsReviseProCheckoutSession({
      customerId: "cus_test_bound",
      userId,
    });

    expect(session?.id).toBe("cs_open_pro");
    expect(mockList).toHaveBeenCalledWith({
      customer: "cus_test_bound",
      status: "open",
      limit: 10,
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("findOpenLetsReviseProCheckoutSession ignores open session with wrong letsReviseUserId", async () => {
    mockList.mockResolvedValue({
      data: [
        {
          id: "cs_wrong_user",
          url: "https://checkout.stripe.com/c/pay/cs_wrong_user",
          mode: "subscription",
          metadata: { planId: "letsrevise_pro", letsReviseUserId: "other-user-id" },
        },
      ],
    });

    const session = await findOpenLetsReviseProCheckoutSession({
      customerId: "cus_test_bound",
      userId,
    });

    expect(session).toBeNull();
  });

  test("findOpenLetsReviseProCheckoutSession ignores open session with missing letsReviseUserId metadata", async () => {
    mockList.mockResolvedValue({
      data: [
        {
          id: "cs_missing_user",
          url: "https://checkout.stripe.com/c/pay/cs_missing_user",
          mode: "subscription",
          metadata: { planId: "letsrevise_pro" },
        },
      ],
    });

    const session = await findOpenLetsReviseProCheckoutSession({
      customerId: "cus_test_bound",
      userId,
    });

    expect(session).toBeNull();
  });

  test("findOpenLetsReviseProCheckoutSession ignores open session with missing or empty URL", async () => {
    mockList.mockResolvedValue({
      data: [
        {
          id: "cs_no_url",
          url: null,
          mode: "subscription",
          metadata: { planId: "letsrevise_pro", letsReviseUserId: userId },
        },
        {
          id: "cs_empty_url",
          url: "",
          mode: "subscription",
          metadata: { planId: "letsrevise_pro", letsReviseUserId: userId },
        },
      ],
    });

    const session = await findOpenLetsReviseProCheckoutSession({
      customerId: "cus_test_bound",
      userId,
    });

    expect(session).toBeNull();
  });

  test("createLetsReviseProCheckoutForUser reuses open session instead of creating duplicate", async () => {
    mockList.mockResolvedValue({
      data: [
        {
          id: "cs_open_pro",
          url: "https://checkout.stripe.com/c/pay/cs_open_pro",
          mode: "subscription",
          metadata: { planId: "letsrevise_pro", letsReviseUserId: userId },
        },
      ],
    });

    const user = {
      _id: userId,
      stripeBilling: { customerId: "cus_test_bound" },
    };

    const session = await createLetsReviseProCheckoutForUser(user);

    expect(session.id).toBe("cs_open_pro");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("createLetsReviseProCheckoutForUser creates new session when none open", async () => {
    const user = {
      _id: userId,
      stripeBilling: { customerId: "cus_test_bound" },
    };

    const session = await createLetsReviseProCheckoutForUser(user);

    expect(session.id).toBe("cs_test_123");
    expect(mockList).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
