# Phase F — AI Boundaries (Draft)

## Purpose
This document defines **explicit boundaries and guardrails** for Phase F.
Phase F exists to allow **planning and structural preparation only**, not AI behaviour.

Phase F is documentation + scaffolding only.
**Any AI behaviour requires an explicit phase activation commit and review.**

---

## Scope
These rules apply to:
- Backend code
- Frontend code
- Scripts, services, and utilities
- Any AI-related experimentation connected to this repository

“Production code” means any code that:
- Runs in deployed environments
- Is imported during app boot
- Executes in request/response lifecycles
- Runs in background processes or scheduled tasks

---

## Allowed in Phase F
The following are allowed **only if they have zero runtime impact**:

- Documentation and planning
- Folder and file scaffolding
- Empty or guarded entry files
- Type/interface definitions with no logic
- Local-only experimentation scripts **not imported anywhere**
- Comments describing future intent

---

## Explicitly Forbidden in Phase F
The following are **not allowed under any circumstances** in Phase F:

- No AI provider calls (OpenAI, Anthropic, etc.)
- No background jobs, queues, cron, or workers
- No API routes or controllers for AI
- No curriculum ingestion or mutation
- No lesson sequencing or personalization
- No user-specific AI behaviour
- No access to user data
- No changes to entitlement, subscription, or coin logic
- No secrets or API keys committed to the repository

---

## Data & Privacy
- AI systems must not access:
  - User identities
  - Progress data
  - Assessment results
  - Subscription or payment data
- No training, logging, or storage of user content is permitted.

---

## Security
- API keys must never be committed.
- Secrets must be handled via environment variables only.
- Local experimentation must use non-production keys stored outside the repo.
- Any AI-related dependency introduction requires explicit review.

---

## Operational Constraints
- No AI SDKs may be imported into runtime code paths.
- No AI code may execute during server boot.
- No AI code may run in response to HTTP requests.
- No AI code may persist data.

---

## Activation Gate (Non-Negotiable)
AI behaviour may only be introduced after **all** of the following:

1. Explicit phase transition approval (Phase F → Phase G)
2. Dedicated commit marking phase activation
3. Updated documentation describing AI behaviour
4. Defined data access rules and threat model
5. Secrets management strategy approved
6. Separate review before any provider integration

---

## Current Status
- Phase F is inactive
- No AI behaviour exists
- No AI code is executed
- This document is authoritative until Phase G is approved


