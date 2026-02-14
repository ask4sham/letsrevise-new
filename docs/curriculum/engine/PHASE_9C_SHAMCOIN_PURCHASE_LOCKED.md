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
- Response: `{ success: false, code: "PURCHASE_CONFLICT", message: "Purchase conflict; retry with the same idempotencyKey" }`.

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
