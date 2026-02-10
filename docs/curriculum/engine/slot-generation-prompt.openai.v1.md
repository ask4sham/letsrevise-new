# Slot Generation Prompt — OpenAI v1

Canonical contract for using the Phase 4C AI executor with OpenAI.

## System rules (MUST be enforced)

- **JSON-only output**:  
  - The model MUST respond with a single JSON object only.  
  - No markdown, no prose, no commentary, no code fences.
- **Deterministic behavior**:  
  - Prompts must avoid randomness and open-ended generation.  
  - All required fields must be specified explicitly.
- **Schema-locked output**:  
  - The response MUST validate against `slot-generation-result.v1.schema.json`.  
  - Any non-conforming output MUST be treated as a failed job.
- **No hidden channels**:  
  - No instructions to embed extra data in comments or unused fields.

These rules are expressed as the system message for the OpenAI executor.

## Input contract (jobs[0] mapping)

The executor constructs the prompt from `jobs[0]` of the input that already
validates against `slot-generation.v1.schema.json`.

Key mappings:

- **Job identity**
  - `jobs[0].jobId` → echoed as `jobId` in the result.
  - `jobs[0].slotId` → used to describe which slot is being filled.
- **Generation kind + mode**
  - `jobs[0].kind` → describes the pedagogical role (e.g. explanatory, question).  
  - `jobs[0].mode` → currently `"generate"`; future modes MUST still respect this contract.
- **Input context**
  - `jobs[0].input` → structured context for the slot (lesson text, syllabus fragments, etc.).  
  - The prompt MUST spell out exactly how each field is used (no free-form interpretation).
- **Output target**
  - `jobs[0].output.field` → which field on the downstream artifact is being written.  
  - `jobs[0].output.type` → allowed content type (e.g. `"text"`, `"richText"`, `"choiceOptions"`).

The prompt MUST clearly tell the model:

- which slot is being filled,
- what content type is expected,
- and what constraints apply to the content.

## Safety flags and allowed content

The executor MUST respect:

- `defaultRequiresReview` from `slot-generation-executor.openai.v1.json`  
  - All results are treated as requiring human review by default.
- Allowed content types from `jobs[0].output.type`  
  - No arbitrary HTML/markdown; only the types declared in the schema.  
  - No off-spec fields or extra top-level properties.

Content rules:

- No markdown formatting (headings, bullets, code fences).
- No meta-commentary about the task or instructions.
- No personal data beyond what is explicitly present in `jobs[0].input`.

## Output guarantee

The model is instructed that:

- The response MUST be a single JSON object with:
  - `version: "v1"`
  - `jobId` equal to `jobs[0].jobId`
  - `status` set to `"COMPLETED"` or `"FAILED"` (Phase 4C will define exact usage)
  - `generatedAt` as an ISO-8601 timestamp
  - `output` as either a structured object (on success) or `null` (on failure)
- The JSON MUST validate against `docs/curriculum/engine/slot-generation-result.v1.schema.json`.

If the executor detects that the model output does not validate against the
schema, it MUST treat the run as failed and surface this for human review.

