/**
 * Unit tests: Stripe Customer Portal session builder (B5 — no real Stripe calls).
 */
jest.mock("../config/stripe", () => ({
  getStripeConfig: jest.fn(),
  getStripeClient: jest.fn(),
}));

const { getStripeConfig, getStripeClient } = require("../config/stripe");
const { createLetsReviseProPortalSession } = require("../services/stripePortalService");

describe("stripePortalService (B5)", () => {
  const mockCreate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    getStripeConfig.mockReturnValue({
      frontendUrl: "https://app.letsrevise.test",
    });
    getStripeClient.mockReturnValue({
      billingPortal: { sessions: { create: mockCreate } },
    });
    mockCreate.mockResolvedValue({
      id: "bps_test_portal",
      url: "https://billing.stripe.com/p/session/test_portal",
    });
  });

  test("createLetsReviseProPortalSession uses server-bound customer and HashRouter return URL", async () => {
    const session = await createLetsReviseProPortalSession("cus_test_portal");

    expect(session.url).toBe("https://billing.stripe.com/p/session/test_portal");
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      customer: "cus_test_portal",
      return_url: "https://app.letsrevise.test/#/subscription",
    });
  });

  test("createLetsReviseProPortalSession rejects missing customerId", async () => {
    await expect(createLetsReviseProPortalSession("")).rejects.toThrow(
      "Stripe customerId is required for Customer Portal"
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
