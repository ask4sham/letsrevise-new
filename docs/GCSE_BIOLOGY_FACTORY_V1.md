# GCSE Biology AQA Lesson Factory v1

One endpoint to generate a full first-draft lesson for **AQA GCSE Biology** (Foundation or Higher) from a topic. The lesson is saved as a **draft** owned by the requesting teacher and can be opened in the teacher editor, edited, and published.

## Endpoint

```
POST /api/ai/lesson-factory/aqa-gcse-biology
```

**Auth:** Bearer token required. **Role:** Teacher or Admin only.

## Request body

| Field      | Type   | Required | Description |
|-----------|--------|----------|-------------|
| `topic`   | string | Yes      | Topic name (e.g. "Photosynthesis", "Cell structure"). 3–120 characters. |
| `tier`    | string | Yes      | `"foundation"` or `"higher"`. |
| `specPoint` | string | No     | Optional spec reference; 0–200 characters. |
| `length`  | string | No       | `"short"` (4 pages), `"standard"` (5), or `"long"` (6). Default `"standard"`. |

### Example

```json
{
  "topic": "Photosynthesis",
  "tier": "higher",
  "specPoint": "4.4.1.1",
  "length": "standard"
}
```

## Response

**200 OK**

```json
{
  "ok": true,
  "lessonId": "<Mongo ObjectId>",
  "lesson": {
    "_id": "<id>",
    "title": "...",
    "description": "...",
    "subject": "Biology",
    "level": "GCSE",
    "board": "AQA",
    "examBoard": "AQA",
    "tier": "higher",
    "topic": "Photosynthesis",
    "status": "draft",
    "pages": [ ... ],
    ...
  }
}
```

The saved lesson always has:

- `subject`: `"Biology"`
- `examBoard` / `board`: `"AQA"`
- `tier`: `"foundation"` or `"higher"`
- `status`: `"draft"`
- 4–6 pages (depending on `length`), each with blocks and a checkpoint (question; answers stored server-side, preview-safe).

## How teachers use it

1. Call the endpoint (e.g. from Teacher Dashboard or a dedicated “Create AQA Biology lesson” form) with `topic` and `tier`.
2. Receive `lessonId` and optional `lesson` payload.
3. Open the lesson in **Edit Lesson** (e.g. `/lesson/:id/edit` or teacher dashboard → lesson list).
4. Edit pages/blocks/checkpoints as needed.
5. **Publish** when ready; students see it according to entitlement (subscription, unlock, or free preview).

## Errors

- **400** – Validation (e.g. topic length, invalid tier or length).
- **401** – Not authenticated.
- **403** – Not teacher or admin.
- **429** – OpenAI rate limit.
- **500** – Server or OpenAI error (see `details` in development).

## Notes

- The generator uses the same AI pipeline as “Generate with AI” (existing lesson draft flow), with subject/level/board fixed to Biology / GCSE / AQA.
- UK terminology and AQA focus are enforced in the prompt.
- Optional `specPoint` can be used in future to align content to a specific spec reference.
