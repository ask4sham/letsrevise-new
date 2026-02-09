# API Guardrails (DO NOT BYPASS)

❌ NEVER serve lesson JSON artifacts directly from storage.
❌ NEVER expose slots, quizzes, flashcards, exams without the entitlement gate.

All lesson-derived endpoints MUST:
- Resolve user entitlements server-side
- Resolve lesson access metadata
- Call `getLessonWithAccess(...)`
- Return ONLY the gated / shaped payload

If you think you don't need the gate, you're wrong.
IP leaks kill conversion.
