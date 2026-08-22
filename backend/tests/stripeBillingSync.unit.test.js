const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { hasStripeLetsReviseProAccess } = require("../utils/stripeBillingAccess");
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

describe("stripeBillingSync subscription lifecycle shape (B6)", () => {
  const b6PeriodEnd = Math.floor(new Date("2026-09-21T00:00:00.000Z").getTime() / 1000);
  const legacyPeriodEnd = Math.floor(Date.now() / 1000) + 86400;
  const otherPeriodEnd = legacyPeriodEnd + 3600;

  const baseSubscription = {
    id: "sub_shape_test",
    customer: "cus_shape_test",
    status: "active",
    metadata: { planId: "letsrevise_pro" },
    items: { data: [{ price: { id: "price_test_letsrevise" } }] },
  };

  test("CASE A: legacy top-level current_period_end populates currentPeriodEnd", () => {
    const fields = buildSubscriptionSnapshotSetFields({
      ...baseSubscription,
      current_period_end: legacyPeriodEnd,
      cancel_at_period_end: false,
    });

    expect(fields["stripeBilling.currentPeriodEnd"]).toEqual(
      new Date(legacyPeriodEnd * 1000)
    );
  });

  test("CASE B: B6 item-level current_period_end populates currentPeriodEnd", () => {
    const fields = buildSubscriptionSnapshotSetFields({
      ...baseSubscription,
      items: {
        data: [
          {
            price: { id: "price_test_letsrevise" },
            current_period_end: b6PeriodEnd,
          },
        ],
      },
      cancel_at_period_end: false,
    });

    expect(fields["stripeBilling.currentPeriodEnd"]).toEqual(
      new Date(b6PeriodEnd * 1000)
    );
  });

  test("CASE C: legacy cancel_at_period_end=true sets cancelAtPeriodEnd", () => {
    const fields = buildSubscriptionSnapshotSetFields({
      ...baseSubscription,
      current_period_end: legacyPeriodEnd,
      cancel_at_period_end: true,
    });

    expect(fields["stripeBilling.cancelAtPeriodEnd"]).toBe(true);
  });

  test("CASE D: B6 cancel_at equals item period end sets cancelAtPeriodEnd", () => {
    const fields = buildSubscriptionSnapshotSetFields({
      ...baseSubscription,
      cancel_at_period_end: false,
      cancel_at: b6PeriodEnd,
      items: {
        data: [
          {
            price: { id: "price_test_letsrevise" },
            current_period_end: b6PeriodEnd,
          },
        ],
      },
    });

    expect(fields["stripeBilling.cancelAtPeriodEnd"]).toBe(true);
    expect(fields["stripeBilling.currentPeriodEnd"]).toEqual(
      new Date(b6PeriodEnd * 1000)
    );
  });

  test("CASE E: non-period cancel_at does not set cancelAtPeriodEnd", () => {
    const fields = buildSubscriptionSnapshotSetFields({
      ...baseSubscription,
      current_period_end: legacyPeriodEnd,
      cancel_at_period_end: false,
      cancel_at: legacyPeriodEnd + 86400,
    });

    expect(fields["stripeBilling.cancelAtPeriodEnd"]).toBe(false);
  });

  test("CASE F: top-level current_period_end takes precedence over item period end", () => {
    const fields = buildSubscriptionSnapshotSetFields({
      ...baseSubscription,
      current_period_end: legacyPeriodEnd,
      cancel_at_period_end: false,
      items: {
        data: [
          {
            price: { id: "price_test_letsrevise" },
            current_period_end: otherPeriodEnd,
          },
        ],
      },
    });

    expect(fields["stripeBilling.currentPeriodEnd"]).toEqual(
      new Date(legacyPeriodEnd * 1000)
    );
    expect(fields["stripeBilling.currentPeriodEnd"]).not.toEqual(
      new Date(otherPeriodEnd * 1000)
    );
  });

  test("CASE G: B6 scheduled cancellation keeps status active with cancelAtPeriodEnd true", () => {
    const fields = buildSubscriptionSnapshotSetFields({
      ...baseSubscription,
      status: "active",
      cancel_at_period_end: false,
      cancel_at: b6PeriodEnd,
      items: {
        data: [
          {
            price: { id: "price_test_letsrevise" },
            current_period_end: b6PeriodEnd,
          },
        ],
      },
    });

    expect(fields["stripeBilling.status"]).toBe("active");
    expect(fields["stripeBilling.cancelAtPeriodEnd"]).toBe(true);
  });

  test("CASE H: lifecycle snapshot does not alter paidThrough", () => {
    const paidThrough = new Date(Date.now() + 86400000 * 30);
    const user = {
      stripeBilling: {
        planId: "letsrevise_pro",
        paidThrough,
      },
      markModified: jest.fn(),
    };

    applySubscriptionSnapshotToUser(user, {
      ...baseSubscription,
      cancel_at_period_end: false,
      cancel_at: b6PeriodEnd,
      items: {
        data: [
          {
            price: { id: "price_test_letsrevise" },
            current_period_end: b6PeriodEnd,
          },
        ],
      },
    });

    expect(user.stripeBilling.paidThrough).toEqual(paidThrough);
    expect(user.stripeBilling.paidThrough).toBeTruthy();
  });

  test("CASE I: scheduled cancellation preserves LetsRevise Pro access via paidThrough", () => {
    const paidThrough = new Date(Date.now() + 86400000 * 30);

    expect(
      hasStripeLetsReviseProAccess({
        stripeBilling: {
          planId: "letsrevise_pro",
          status: "active",
          cancelAtPeriodEnd: true,
          paidThrough,
        },
      })
    ).toBe(true);
  });

  test("B6 real fixture: active scheduled cancellation snapshot without paidThrough mutation", () => {
    const user = {
      stripeBilling: {
        planId: "letsrevise_pro",
        paidThrough: new Date(b6PeriodEnd * 1000),
      },
      markModified: jest.fn(),
    };

    applySubscriptionSnapshotToUser(user, {
      ...baseSubscription,
      status: "active",
      cancel_at_period_end: false,
      cancel_at: b6PeriodEnd,
      items: {
        data: [
          {
            price: { id: "price_test_letsrevise" },
            current_period_end: b6PeriodEnd,
          },
        ],
      },
    });

    expect(user.stripeBilling.status).toBe("active");
    expect(user.stripeBilling.currentPeriodEnd).toEqual(new Date(b6PeriodEnd * 1000));
    expect(user.stripeBilling.cancelAtPeriodEnd).toBe(true);
    expect(user.stripeBilling.paidThrough).toEqual(new Date(b6PeriodEnd * 1000));
  });
});
