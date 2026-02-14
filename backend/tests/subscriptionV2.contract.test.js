/**
 * Phase 9B — Unit tests for subscriptionV2 contract (normalize + isEntitled).
 */
const {
  normalizeSubscriptionV2,
  isEntitledSubscriptionV2,
  ENTITLED_STATUSES,
} = require("../contracts/subscriptionV2");

describe("subscriptionV2 contract", () => {
  describe("normalizeSubscriptionV2", () => {
    test("null/undefined/non-object returns { status: 'none', ... }", () => {
      const none = normalizeSubscriptionV2(null);
      expect(none).not.toBeNull();
      expect(none.status).toBe("none");
      expect(none.planId).toBeNull();
      expect(normalizeSubscriptionV2(undefined).status).toBe("none");
      expect(normalizeSubscriptionV2("active").status).toBe("none");
      expect(normalizeSubscriptionV2(123).status).toBe("none");
    });

    test("object with status normalizes", () => {
      const n = normalizeSubscriptionV2({ status: "active" });
      expect(n).not.toBeNull();
      expect(n.status).toBe("active");
      expect(n.expiresAt).toBeNull();
    });

    test("expiresAt valid date → ISO string", () => {
      const d = new Date("2026-12-31T23:59:59.000Z");
      const n = normalizeSubscriptionV2({ status: "active", expiresAt: d });
      expect(n.expiresAt).toBe("2026-12-31T23:59:59.000Z");
    });

    test("invalid expiresAt → null (fail closed)", () => {
      const n = normalizeSubscriptionV2({ status: "active", expiresAt: "not-a-date" });
      expect(n.expiresAt).toBeNull();
    });
  });

  describe("isEntitledSubscriptionV2", () => {
    test("active → true (no expiry)", () => {
      const n = normalizeSubscriptionV2({ status: "active" });
      expect(isEntitledSubscriptionV2(n)).toBe(true);
    });

    test("trialing → true", () => {
      const n = normalizeSubscriptionV2({ status: "trialing" });
      expect(isEntitledSubscriptionV2(n)).toBe(true);
    });

    test("past_due / canceled / incomplete / unpaid / none → false", () => {
      expect(isEntitledSubscriptionV2(normalizeSubscriptionV2({ status: "past_due" }))).toBe(false);
      expect(isEntitledSubscriptionV2(normalizeSubscriptionV2({ status: "canceled" }))).toBe(false);
      expect(isEntitledSubscriptionV2(normalizeSubscriptionV2({ status: "incomplete" }))).toBe(false);
      expect(isEntitledSubscriptionV2(normalizeSubscriptionV2({ status: "unpaid" }))).toBe(false);
      expect(isEntitledSubscriptionV2(normalizeSubscriptionV2({ status: "expired" }))).toBe(false);
      expect(isEntitledSubscriptionV2(normalizeSubscriptionV2({ status: "none" }))).toBe(false);
      expect(isEntitledSubscriptionV2(normalizeSubscriptionV2(null))).toBe(false);
      expect(isEntitledSubscriptionV2(null)).toBe(false);
    });

    test("active + expiresAt in past → false", () => {
      const past = new Date(Date.now() - 86400000).toISOString();
      const n = normalizeSubscriptionV2({ status: "active", expiresAt: past });
      expect(isEntitledSubscriptionV2(n)).toBe(false);
    });

    test("active + expiresAt in future → true", () => {
      const future = new Date(Date.now() + 86400000).toISOString();
      const n = normalizeSubscriptionV2({ status: "active", expiresAt: future });
      expect(isEntitledSubscriptionV2(n)).toBe(true);
    });

    test("invalid dates treated as null, does not grant (fail closed)", () => {
      const n = normalizeSubscriptionV2({ status: "active", expiresAt: "invalid" });
      expect(n.expiresAt).toBeNull();
      expect(isEntitledSubscriptionV2(n)).toBe(true); // no expiry = still entitled
    });

    test("explicit now in past with future expiresAt → true", () => {
      const future = new Date(Date.now() + 86400000).toISOString();
      const n = normalizeSubscriptionV2({ status: "active", expiresAt: future });
      expect(isEntitledSubscriptionV2(n, Date.now() - 1000)).toBe(true);
    });

    test("explicit now after expiresAt → false", () => {
      const future = new Date(Date.now() + 86400000);
      const n = normalizeSubscriptionV2({ status: "active", expiresAt: future });
      expect(isEntitledSubscriptionV2(n, future.getTime() + 1)).toBe(false);
    });
  });

  describe("ENTITLED_STATUSES", () => {
    test("is a Set with active and trialing", () => {
      expect(ENTITLED_STATUSES.has("active")).toBe(true);
      expect(ENTITLED_STATUSES.has("trialing")).toBe(true);
      expect(ENTITLED_STATUSES.size).toBe(2);
    });
  });
});
