const { hasStripeLetsReviseProAccess } = require("../utils/stripeBillingAccess");

describe("stripeBillingAccess — LetsRevise Pro (B3)", () => {
  const future = new Date(Date.now() + 86400000);

  const paidBilling = {
    planId: "letsrevise_pro",
    paidThrough: future,
    status: "active",
  };

  test("active + future paidThrough → ALLOW", () => {
    expect(hasStripeLetsReviseProAccess({ stripeBilling: paidBilling })).toBe(true);
  });

  test("active + cancelAtPeriodEnd + future paidThrough → ALLOW (still active until period end)", () => {
    expect(
      hasStripeLetsReviseProAccess({
        stripeBilling: { ...paidBilling, cancelAtPeriodEnd: true },
      })
    ).toBe(true);
  });

  test("past_due + future paidThrough → ALLOW", () => {
    expect(
      hasStripeLetsReviseProAccess({
        stripeBilling: { ...paidBilling, status: "past_due" },
      })
    ).toBe(true);
  });

  test("canceled + future paidThrough → DENY", () => {
    expect(
      hasStripeLetsReviseProAccess({
        stripeBilling: { ...paidBilling, status: "canceled", cancelAtPeriodEnd: true },
      })
    ).toBe(false);
  });

  test("paused + future paidThrough → DENY", () => {
    expect(
      hasStripeLetsReviseProAccess({
        stripeBilling: { ...paidBilling, status: "paused" },
      })
    ).toBe(false);
  });

  test("unpaid + future paidThrough → DENY", () => {
    expect(
      hasStripeLetsReviseProAccess({
        stripeBilling: { ...paidBilling, status: "unpaid" },
      })
    ).toBe(false);
  });

  test("incomplete + future paidThrough → DENY", () => {
    expect(
      hasStripeLetsReviseProAccess({
        stripeBilling: { ...paidBilling, status: "incomplete" },
      })
    ).toBe(false);
  });

  test("trialing + future paidThrough → DENY", () => {
    expect(
      hasStripeLetsReviseProAccess({
        stripeBilling: { ...paidBilling, status: "trialing" },
      })
    ).toBe(false);
  });

  test("unknown status + future paidThrough → DENY", () => {
    expect(
      hasStripeLetsReviseProAccess({
        stripeBilling: { ...paidBilling, status: "weird_state" },
      })
    ).toBe(false);
  });

  test("no paidThrough → DENY", () => {
    expect(
      hasStripeLetsReviseProAccess({
        stripeBilling: { planId: "letsrevise_pro", status: "active" },
      })
    ).toBe(false);
  });

  test("expired paidThrough → DENY", () => {
    expect(
      hasStripeLetsReviseProAccess({
        stripeBilling: {
          ...paidBilling,
          paidThrough: new Date(Date.now() - 1000),
        },
      })
    ).toBe(false);
  });
});
