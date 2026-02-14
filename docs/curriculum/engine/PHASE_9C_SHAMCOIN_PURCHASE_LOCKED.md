# Phase 9C — ShamCoin purchase locked

Atomic, idempotent lesson purchase via ShamCoins is **locked** at this tag. Ledger, transaction, and retry semantics are stable.

**Tag:** `phase-9c-shamcoin-purchase-locked`

---

## Endpoint

- **POST /api/lessons/:id/purchase** (auth, students only)
- **Body:** `{ idempotencyKey: string }` required; 16–128 chars, no whitespace.
- **Response (success):** `{ success, alreadyPurchased, idempotentReplay, entitlements: { shamCoinsBalance, purchasedLessonsCount }, purchaseId? }`.

---

## Retry semantics

- **409 PURCHASE_CONFLICT** is **retryable** with the **same idempotencyKey**. It indicates a transient transaction conflict (e.g. WriteConflict); the client should retry once or twice. Do not treat it as a hard failure.
- Response: `{ success: false, code: "PURCHASE_CONFLICT", error: "Purchase conflict; retry with the same idempotencyKey" }`.

---

## Ledger and behaviour

- **LessonPurchase** collection: `userId`, `lessonId`, `cost`, `idempotencyKey`, `createdAt`. Unique on `(userId, lessonId)` and `(userId, idempotencyKey)`.
- **Order in transaction:** Insert ledger row first, then decrement coins and `$addToSet` purchasedLessons. Duplicate key on ledger → 200 alreadyPurchased (no debit).
- **Pricing:** `lesson.shamCoinPrice`; invalid/missing → 400 INVALID_COST.
- **Transactions required:** Replica set; 503 TRANSACTIONS_UNAVAILABLE if not available.

---

## Tests and CI

- **backend/tests/shamCoinPurchase.integration.test.js**: idempotencyKey validation, insufficient coins (402), success, idempotency replay, same-key concurrency, different-key concurrency (one 200 new, one 200 alreadyPurchased or 409 PURCHASE_CONFLICT).
- **npm run test:backend** includes this suite.

---

## Tagging (one-time)

Run each command separately to avoid copy/paste mistakes:

```
git tag -a phase-9a-content-access-locked -m "Phase 9A content access locked: policy, gated routes, list sanitizer, payload helpers, tests"
git tag -a phase-9b-subscription-v2-locked -m "Phase 9B subscription V2 locked: contract normalization, allowlist entitlement, tests, /me/entitlements"
git tag -a phase-9c-shamcoin-purchase-locked -m "Phase 9C ShamCoin purchase locked: ledger, idempotency, transactions, 409 conflicts, tests"
git push origin phase-9a-content-access-locked phase-9b-subscription-v2-locked phase-9c-shamcoin-purchase-locked
```
