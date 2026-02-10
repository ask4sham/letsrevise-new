# Phase 4C — OpenAI Executor Runbook (Local Only)

This runbook explains how to run the real OpenAI path for slot generation.

## Safety
- The real OpenAI call is ONLY used when `FEATURE_SLOTGEN_AI=true`.
- Output is schema-validated against `slot-generation-result.v1.schema.json`.
- Default expectation: outputs require human review before publishing.

## Required environment variables
- `FEATURE_SLOTGEN_AI=true`
- `OPENAI_API_KEY=...` (required when feature is enabled)
- `OPENAI_BASE_URL` (optional; defaults to `https://api.openai.com/v1`)

## PowerShell-safe example (recommended)
In PowerShell, avoid `echo "{...}"` because quoting can corrupt JSON.

```powershell
$env:FEATURE_SLOTGEN_AI="true"
$env:OPENAI_API_KEY="YOUR_KEY_HERE"

'{"version":"v1","appliesTo":{"subject":"Biology","level":"GCSE","board":"AQA","specVersion":"v1"},"jobs":[{"jobId":"J1","slotId":"S1","kind":"explanatory","mode":"generate","input":{},"output":{"field":"content","type":"text"},"sources":[],"required":true}],"metadata":{"requiresReview":false}}' | npm run slotgen:openai

Bash example
FEATURE_SLOTGEN_AI=true OPENAI_API_KEY="YOUR_KEY_HERE" \
  echo '{"version":"v1","appliesTo":{"subject":"Biology","level":"GCSE","board":"AQA","specVersion":"v1"},"jobs":[{"jobId":"J1","slotId":"S1","kind":"explanatory","mode":"generate","input":{},"output":{"field":"content","type":"text"},"sources":[],"required":true}],"metadata":{"requiresReview":false}}' \
  | npm run slotgen:openai

Expected behavior

If input is schema-invalid → non-zero exit, validation errors on stderr.

If feature is enabled but OPENAI_API_KEY is missing → non-zero exit with a clear error.

If the model returns non-JSON or invalid JSON → non-zero exit (no stdout JSON).

If successful → stdout contains a slot-generation-result JSON object with:

status: "COMPLETED"

output as a JSON object

passes schema validation

