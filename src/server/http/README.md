# Server Access Gate (DO NOT BYPASS)

All lesson-derived content **MUST** go through the entitlement gate.

Required flow:
1. Resolve user entitlements (auth + subscription + purchases)
2. Resolve lesson access metadata (published, free preview)
3. Call `getLessonWithAccess(...)`
4. Return ONLY the gated + shaped payload

❌ Do NOT:
- Load lesson JSON directly in API routes
- Serve slots, quizzes, flashcards, or exams without the gate
- Rely on frontend-only locking

✅ Always use:
- `canAccessContent` (policy)
- `applyAccessMode` (IP protection)
- `getLessonWithAccess` (orchestration)

If content leaks, conversion dies.
