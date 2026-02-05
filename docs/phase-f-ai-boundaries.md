## Phase F – AI Boundaries (Draft)

This document captures high-level boundaries and guardrails for **Phase F** AI work in the LetsRevise backend. It is intentionally conservative and should be treated as the outer fence for any new AI behaviour.

### Purpose
- Clearly separate **AI-assisted features** from core learning logic.
- Prevent accidental coupling between AI experiments and production-critical flows.
- Make it obvious when a change crosses from “data scaffolding” (Phase E) into **behavioural AI features** (Phase F+).

### Scope
- Applies to all new AI-related code in `backend/ai/`, AI job routes, workers, and any code that calls external AI providers.
- Does **not** change existing lesson, assessment, subscription, or entitlement rules.

### Non‑Goals
- This is **not** a design spec for particular AI features.
- This does **not** grant permission to deploy AI features to all users.
- This does **not** describe provider-specific integration details (keys, SDKs, etc.).

### Data & Safety Boundaries
- AI jobs must only read/write via explicit models (e.g. `AiGenerationJob`, `Curriculum`) – no ad‑hoc collections.
- No direct mutation of `User`, `Lesson`, `Assessment*`, or subscription documents from AI workers without a clear, reviewed write-path.
- No ingestion of raw student PII into prompts without an explicit, documented consent decision.
- Error handling and logging must **never** log API keys, tokens, or full provider responses that could leak sensitive data.

### Behavioural Boundaries (Phase F)
- Phase F may introduce **job creation, status tracking, and read‑only inspection** for AI generation jobs.
- AI output must be treated as **draft** until explicitly reviewed/accepted by a human (e.g. teacher/admin) – no auto‑publishing to students.
- No automatic scheduling of background AI jobs (cron, queues) without a clear “on/off” control and documented blast radius.

### Guardrails
- Do **not**:
  - Add AI calls inside request handlers for core student flows (lessons, assessments, dashboards) without an explicit design review.
  - Bypass or duplicate existing entitlement logic when exposing AI features.
  - Couple AI provider SDKs directly into models; keep them in clearly named service/adapter modules.
  - Store provider responses verbatim without a retention/cleanup policy.
- Do:
  - Keep AI entrypoints behind explicit, well‑named routes and/or admin tooling.
  - Document any new AI surface area in this `docs/` folder before or alongside implementation.

### Current Status
- AI Generation Jobs groundwork is in place (contracts, model, inert routes, middleware).
- No production AI business logic is enabled yet.
- This document should be updated before **any** Phase F feature is rolled out to real users.

