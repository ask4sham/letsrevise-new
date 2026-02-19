## Question bank (Worksheet Builder)

Teachers need exam questions in the Question Bank to build worksheets. You can automate this in two ways:

1. **One-click (admin only)**  
   In the app, open **Worksheet Builder** as an admin user. In the Question Bank panel, click **Populate question bank**. The seed runs in the background; after about a minute, click **Refresh list** (or reload the page) to see questions for all AQA GCSE Biology topics.

2. **Deploy / first-time setup**  
   Run once per environment so the bank is pre-filled and teachers never see an empty list:
   ```bash
   npm run seed:bio:all
   ```
   Idempotent: existing topics are skipped. Uses `MONGO_URI` from `.env`.

## AI Generation Jobs (Groundwork)

- **Purpose**: Structural groundwork for AI generation jobs only; there is no execution or business logic yet.
- **Contracts**: Shared job contract, policy, type specs and error codes live under `backend/contracts/`.
- **Storage**: A minimal Mongoose model `AiGenerationJob` defines the persisted job shape.
- **Routing**: Public and admin route namespaces exist as empty placeholders (`routes/aiGenerationJobs.js`, `routes/adminAiGenerationJobs.js`), mounted but with no handlers.
- **Middleware**: `requireAiJobAccess` is a no-op middleware hook, exported from `backend/middleware/`, ready to be attached to future routes.
- **Not implemented**: No job creation APIs, no background workers or queues, no AI provider calls and no decision-making logic are present yet.

## AI Generation Jobs – Current Status

- Groundwork is complete: contracts, model, routes, and middleware are in place.
- All AI generation components are inert placeholders with no active behavior.
- There is no job execution, background worker infrastructure, or provider calls.
- Future phases will add behavior incrementally on top of this foundation.

## AI Generation Jobs – Phase Boundary

- All structural groundwork for AI generation jobs is complete and safe to load in all environments.
- The next phase will introduce the first behavioral change: job creation endpoints and related logic.
- No further documentation-only groundwork changes are expected before behavioral features are added.



