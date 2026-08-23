/**
 * Unit tests: Stripe live-mode gate, local startup validation, checkout price safety.
 */
jest.mock("stripe", () => jest.fn());

const {
  StripeBillingError,
  isStripeLiveModeEnabled,
  assertStripeSecretKeyModeAllowed,
  validateStripeBillingConfigAtStartup,
  validateRetrievedPriceForMode,
  assertLetsReviseProPriceForCheckout,
  constructStripeWebhookEvent,
  getStripeClient,
  resetStripeClientForTests,
  isStripeBillingPartiallyConfigured,
} = require("../config/stripe");

describe("stripe live-mode gate", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
    resetStripeClientForTests();
    jest.resetModules();
  });

  describe("isStripeLiveModeEnabled", () => {
    test.each([
      [undefined, false],
      ["", false],
      ["0", false],
      ["true", false],
      ["yes", false],
      ["2", false],
      ["1", true],
    ])("STRIPE_LIVE_MODE_ENABLED=%s → %s", (value, expected) => {
      if (value === undefined) {
        delete process.env.STRIPE_LIVE_MODE_ENABLED;
      } else {
        process.env.STRIPE_LIVE_MODE_ENABLED = value;
      }
      expect(isStripeLiveModeEnabled()).toBe(expected);
    });
  });

  describe("assertStripeSecretKeyModeAllowed", () => {
    test("test key + flag off → allow", () => {
      delete process.env.STRIPE_LIVE_MODE_ENABLED;
      expect(() => assertStripeSecretKeyModeAllowed("sk_test_abc")).not.toThrow();
    });

    test("live key + flag off → block", () => {
      delete process.env.STRIPE_LIVE_MODE_ENABLED;
      expect(() => assertStripeSecretKeyModeAllowed("sk_live_abc")).toThrow(StripeBillingError);
      try {
        assertStripeSecretKeyModeAllowed("sk_live_abc");
      } catch (err) {
        expect(err.code).toBe("STRIPE_BILLING_DISABLED");
      }
    });

    test("live key + flag on → allow", () => {
      process.env.STRIPE_LIVE_MODE_ENABLED = "1";
      expect(() => assertStripeSecretKeyModeAllowed("sk_live_abc")).not.toThrow();
    });

    test("test key + flag on → block", () => {
      process.env.STRIPE_LIVE_MODE_ENABLED = "1";
      expect(() => assertStripeSecretKeyModeAllowed("sk_test_abc")).toThrow(StripeBillingError);
      try {
        assertStripeSecretKeyModeAllowed("sk_test_abc");
      } catch (err) {
        expect(err.code).toBe("STRIPE_BILLING_DISABLED");
      }
    });

    test("flag off + malformed prefix → block", () => {
      delete process.env.STRIPE_LIVE_MODE_ENABLED;
      expect(() => assertStripeSecretKeyModeAllowed("sk_bad_abc")).toThrow(StripeBillingError);
      try {
        assertStripeSecretKeyModeAllowed("sk_bad_abc");
      } catch (err) {
        expect(err.code).toBe("STRIPE_BILLING_DISABLED");
        expect(err.userMessage).toBe("Billing is temporarily unavailable.");
      }
    });

    test("flag off + arbitrary non-Stripe string → block", () => {
      delete process.env.STRIPE_LIVE_MODE_ENABLED;
      expect(() => assertStripeSecretKeyModeAllowed("not_a_stripe_key")).toThrow(StripeBillingError);
    });

    test("flag on + malformed prefix → block", () => {
      process.env.STRIPE_LIVE_MODE_ENABLED = "1";
      expect(() => assertStripeSecretKeyModeAllowed("sk_bad_abc")).toThrow(StripeBillingError);
      try {
        assertStripeSecretKeyModeAllowed("sk_bad_abc");
      } catch (err) {
        expect(err.code).toBe("STRIPE_BILLING_DISABLED");
      }
    });
  });

  describe("getStripeClient key matrix", () => {
    beforeEach(() => {
      resetStripeClientForTests();
    });

    test("test key + flag off → client constructs", () => {
      delete process.env.STRIPE_LIVE_MODE_ENABLED;
      process.env.STRIPE_SECRET_KEY = "sk_test_client_dummy";
      const client = getStripeClient();
      expect(client).toBeTruthy();
    });

    test("live key + flag off → block", () => {
      delete process.env.STRIPE_LIVE_MODE_ENABLED;
      process.env.STRIPE_SECRET_KEY = "sk_live_client_dummy";
      expect(() => getStripeClient()).toThrow(StripeBillingError);
    });
  });

  describe("validateStripeBillingConfigAtStartup (local only)", () => {
    test("skips when Stripe billing is not configured", () => {
      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_PRICE_ID_LETSREVISE_PRO;
      delete process.env.STRIPE_WEBHOOK_SECRET;
      expect(() => validateStripeBillingConfigAtStartup()).not.toThrow();
      expect(isStripeBillingPartiallyConfigured()).toBe(false);
    });

    test("key/flag mismatch fails local validation", () => {
      process.env.STRIPE_SECRET_KEY = "sk_live_startup";
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_dummy";
      delete process.env.STRIPE_LIVE_MODE_ENABLED;
      expect(() => validateStripeBillingConfigAtStartup()).toThrow(StripeBillingError);
    });

    test("checkout configured without FRONTEND_URL fails", () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_startup";
      process.env.STRIPE_PRICE_ID_LETSREVISE_PRO = "price_test_123";
      delete process.env.FRONTEND_URL;
      delete process.env.STRIPE_LIVE_MODE_ENABLED;
      expect(() => validateStripeBillingConfigAtStartup()).toThrow(
        "FRONTEND_URL is required when Stripe Checkout is configured"
      );
    });

    test("valid test checkout config passes without remote Stripe dependency", () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_startup";
      process.env.STRIPE_PRICE_ID_LETSREVISE_PRO = "price_test_123";
      process.env.FRONTEND_URL = "https://app.letsrevise.test";
      delete process.env.STRIPE_LIVE_MODE_ENABLED;
      expect(() => validateStripeBillingConfigAtStartup()).not.toThrow();
      expect(isStripeBillingPartiallyConfigured()).toBe(true);
    });
  });

  describe("validateRetrievedPriceForMode", () => {
    test("TEST: active test price → allow", () => {
      delete process.env.STRIPE_LIVE_MODE_ENABLED;
      expect(() =>
        validateRetrievedPriceForMode({ livemode: false, active: true })
      ).not.toThrow();
    });

    test("TEST: live price in test mode → block", () => {
      delete process.env.STRIPE_LIVE_MODE_ENABLED;
      expect(() =>
        validateRetrievedPriceForMode({ livemode: true, active: true })
      ).toThrow(StripeBillingError);
    });

    test("LIVE: correct GBP 499 monthly active price → allow", () => {
      process.env.STRIPE_LIVE_MODE_ENABLED = "1";
      expect(() =>
        validateRetrievedPriceForMode({
          livemode: true,
          active: true,
          currency: "gbp",
          unit_amount: 499,
          recurring: { interval: "month" },
        })
      ).not.toThrow();
    });

    test("LIVE: test price → block", () => {
      process.env.STRIPE_LIVE_MODE_ENABLED = "1";
      expect(() =>
        validateRetrievedPriceForMode({
          livemode: false,
          active: true,
          currency: "gbp",
          unit_amount: 499,
          recurring: { interval: "month" },
        })
      ).toThrow(StripeBillingError);
    });

    test("LIVE: inactive → block", () => {
      process.env.STRIPE_LIVE_MODE_ENABLED = "1";
      expect(() =>
        validateRetrievedPriceForMode({
          livemode: true,
          active: false,
          currency: "gbp",
          unit_amount: 499,
          recurring: { interval: "month" },
        })
      ).toThrow(StripeBillingError);
    });

    test.each([
      ["currency", { livemode: true, active: true, currency: "usd", unit_amount: 499, recurring: { interval: "month" } }],
      ["amount", { livemode: true, active: true, currency: "gbp", unit_amount: 999, recurring: { interval: "month" } }],
      ["interval", { livemode: true, active: true, currency: "gbp", unit_amount: 499, recurring: { interval: "year" } }],
    ])("LIVE: wrong %s → STRIPE_PRICE_VALIDATION_FAILED", (_label, price) => {
      process.env.STRIPE_LIVE_MODE_ENABLED = "1";
      try {
        validateRetrievedPriceForMode(price);
        throw new Error("expected throw");
      } catch (err) {
        expect(err).toBeInstanceOf(StripeBillingError);
        expect(err.code).toBe("STRIPE_PRICE_VALIDATION_FAILED");
      }
    });
  });

  describe("assertLetsReviseProPriceForCheckout", () => {
    beforeEach(() => {
      resetStripeClientForTests();
      process.env.STRIPE_SECRET_KEY = "sk_test_checkout_dummy";
      process.env.STRIPE_PRICE_ID_LETSREVISE_PRO = "price_test_checkout";
      delete process.env.STRIPE_LIVE_MODE_ENABLED;
    });

    test("Stripe retrieve failure → BILLING_TEMPORARILY_UNAVAILABLE", async () => {
      const Stripe = require("stripe");
      const mockRetrieve = jest.fn().mockRejectedValue(new Error("network down"));
      Stripe.mockImplementation(() => ({ prices: { retrieve: mockRetrieve } }));
      resetStripeClientForTests();

      await expect(assertLetsReviseProPriceForCheckout()).rejects.toMatchObject({
        code: "BILLING_TEMPORARILY_UNAVAILABLE",
      });
      Stripe.mockReset();
    });

    test("404 price → STRIPE_PRICE_MISCONFIGURED", async () => {
      const Stripe = require("stripe");
      const err = new Error("No such price");
      err.statusCode = 404;
      const mockRetrieve = jest.fn().mockRejectedValue(err);
      Stripe.mockImplementation(() => ({ prices: { retrieve: mockRetrieve } }));
      resetStripeClientForTests();

      await expect(assertLetsReviseProPriceForCheckout()).rejects.toMatchObject({
        code: "STRIPE_PRICE_MISCONFIGURED",
      });
      Stripe.mockReset();
    });
  });

  describe("constructStripeWebhookEvent", () => {
    test("uses webhook secret without getStripeClient key gate", () => {
      process.env.STRIPE_SECRET_KEY = "sk_live_webhook_only";
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_construct";
      delete process.env.STRIPE_LIVE_MODE_ENABLED;

      const Stripe = require("stripe");
      Stripe.webhooks = {
        constructEvent: jest
          .fn()
          .mockReturnValue({ id: "evt_test", livemode: true, type: "invoice.paid" }),
      };

      const rawBody = Buffer.from("{}");
      const event = constructStripeWebhookEvent(rawBody, "sig_test");
      expect(event.id).toBe("evt_test");
      expect(Stripe.webhooks.constructEvent).toHaveBeenCalledWith(
        rawBody,
        "sig_test",
        "whsec_test_construct"
      );
    });
  });
});
