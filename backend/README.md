## AI Generation Jobs (Groundwork)

- **Purpose**: Structural groundwork for AI generation jobs only; there is no execution or business logic yet.
- **Contracts**: Shared job contract, policy, type specs and error codes live under `backend/contracts/`.
- **Storage**: A minimal Mongoose model `AiGenerationJob` defines the persisted job shape.
- **Routing**: Public and admin route namespaces exist as empty placeholders (`routes/aiGenerationJobs.js`, `routes/adminAiGenerationJobs.js`), mounted but with no handlers.
- **Middleware**: `requireAiJobAccess` is a no-op middleware hook, exported from `backend/middleware/`, ready to be attached to future routes.
- **Not implemented**: No job creation APIs, no background workers or queues, no AI provider calls and no decision-making logic are present yet.

