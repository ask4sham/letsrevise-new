/**
 * Unit: reject client billing overrides on Checkout creation (B2).
 */
const { findForbiddenClientBillingKeys } = require("../utils/rejectClientBillingInput");

describe("rejectClientBillingInput (B2)", () => {
  const forbidden = [
    "priceId",
    "price",
    "line_items",
    "amount",
    "currency",
    "planId",
    "userId",
    "letsReviseUserId",
  ];

  test.each(forbidden)("rejects client key %s", (key) => {
    expect(findForbiddenClientBillingKeys({ [key]: "evil" })).toEqual([key]);
  });

  test("allows empty body", () => {
    expect(findForbiddenClientBillingKeys({})).toEqual([]);
    expect(findForbiddenClientBillingKeys(undefined)).toEqual([]);
  });
});
