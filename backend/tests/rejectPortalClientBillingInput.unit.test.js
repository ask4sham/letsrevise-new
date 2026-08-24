/**
 * Unit: Portal-specific client billing overrides (B5).
 */
const { findForbiddenClientBillingKeys } = require("../utils/rejectClientBillingInput");
const {
  findForbiddenPortalClientBillingKeys,
  PORTAL_ONLY_FORBIDDEN,
} = require("../utils/rejectPortalClientBillingInput");

describe("rejectPortalClientBillingInput (B5)", () => {
  test.each(PORTAL_ONLY_FORBIDDEN)("rejects portal-only key %s", (key) => {
    expect(findForbiddenPortalClientBillingKeys({ [key]: "evil" })).toEqual([key]);
  });

  test("composes B4 checkout forbidden keys", () => {
    expect(findForbiddenPortalClientBillingKeys({ priceId: "evil" })).toEqual(["priceId"]);
  });

  test("allows empty body", () => {
    expect(findForbiddenPortalClientBillingKeys({})).toEqual([]);
    expect(findForbiddenPortalClientBillingKeys(undefined)).toEqual([]);
  });

  test("B4 checkout helper unchanged — portal-only keys not rejected there", () => {
    for (const key of PORTAL_ONLY_FORBIDDEN) {
      expect(findForbiddenClientBillingKeys({ [key]: "evil" })).toEqual([]);
    }
  });
});
