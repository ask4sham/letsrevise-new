const bcrypt = require("bcryptjs");
const User = require("../models/User");
const {
  applySubscriptionSnapshotToUser,
  resolveInvoicePaidAt,
  buildInvoicePaymentMaxFields,
  buildSubscriptionSnapshotSetFields,
} = require("../services/stripeBillingSync");

describe("stripeBillingSync (B3)", () => {
  test("applySubscriptionSnapshotToUser never writes subscriptionV2", () => {
    const user = {
      subscriptionV2: {
        status: "trialing",
        provider: "admin",
        planId: "admin-pass-7d",
        expiresAt: new Date(Date.now() + 86400000),
      },
      stripeBilling: {},
      markModified: jest.fn(),
    };

    applySubscriptionSnapshotToUser(user, {
      id: "sub_test",
      customer: "cus_test",
      status: "active",
      current_period_end: Math.floor(Date.now() / 1000) + 3600,
      cancel_at_period_end: false,
      metadata: { planId: "letsrevise_pro", letsReviseUserId: "507f1f77bcf86cd799439011" },
      items: { data: [{ price: { id: "price_test_letsrevise" } }] },
    });

    expect(user.subscriptionV2.provider).toBe("admin");
    expect(user.stripeBilling.subscriptionId).toBe("sub_test");
    expect(user.stripeBilling.status).toBe("active");
    expect(user.stripeBilling.paidThrough).toBeUndefined();
  });

  test("resolveInvoicePaidAt prefers status_transitions.paid_at", () => {
    const paidAt = Math.floor(Date.now() / 1000) - 3600;
    const created = Math.floor(Date.now() / 1000) - 7200;

    expect(
      resolveInvoicePaidAt({
        status_transitions: { paid_at: paidAt },
        created,
      })
    ).toEqual(new Date(paidAt * 1000));
  });

  test("resolveInvoicePaidAt falls back to invoice.created", () => {
    const created = Math.floor(Date.now() / 1000) - 7200;

    expect(
      resolveInvoicePaidAt({
        created,
      })
    ).toEqual(new Date(created * 1000));
  });

  test("resolveInvoicePaidAt returns null when no Stripe timestamp", () => {
    expect(resolveInvoicePaidAt({})).toBeNull();
  });

  test("buildInvoicePaymentMaxFields omits lastInvoicePaidAt without Stripe timestamp", () => {
    const periodEnd = Math.floor(Date.now() / 1000) + 7200;

    expect(
      buildInvoicePaymentMaxFields({
        lines: { data: [{ period: { end: periodEnd } }] },
      })
    ).toEqual({
      "stripeBilling.paidThrough": new Date(periodEnd * 1000),
    });
  });

  test("buildInvoicePaymentMaxFields includes both monotonic fields", () => {
    const periodEnd = Math.floor(Date.now() / 1000) + 7200;
    const paidAt = periodEnd - 60;

    expect(
      buildInvoicePaymentMaxFields({
        lines: { data: [{ period: { end: periodEnd } }] },
        status_transitions: { paid_at: paidAt },
      })
    ).toEqual({
      "stripeBilling.paidThrough": new Date(periodEnd * 1000),
      "stripeBilling.lastInvoicePaidAt": new Date(paidAt * 1000),
    });
  });

  test("$max keeps highest paidThrough under out-of-order writes", async () => {
    const user = await User.create({
      firstName: "Atomic",
      lastName: "Max",
      email: `stripe-b3-atomic-max-${Date.now()}@test.com`,
      password: bcrypt.hashSync("password123", 10),
      userType: "student",
    });

    const novEnd = new Date("2025-11-30T00:00:00.000Z");
    const octEnd = new Date("2025-10-31T00:00:00.000Z");

    await User.updateOne(
      { _id: user._id },
      { $max: { "stripeBilling.paidThrough": octEnd, "stripeBilling.lastInvoicePaidAt": octEnd } }
    );
    await User.updateOne(
      { _id: user._id },
      { $max: { "stripeBilling.paidThrough": novEnd, "stripeBilling.lastInvoicePaidAt": novEnd } }
    );
    await User.updateOne(
      { _id: user._id },
      { $max: { "stripeBilling.paidThrough": octEnd, "stripeBilling.lastInvoicePaidAt": octEnd } }
    );

    const after = await User.findById(user._id).lean();
    expect(after.stripeBilling.paidThrough).toEqual(novEnd);
    expect(after.stripeBilling.lastInvoicePaidAt).toEqual(novEnd);
  });
});
