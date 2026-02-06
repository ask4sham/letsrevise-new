# AI Generation Provenance

## Purpose
This document defines how AI-generated lesson content is produced, validated, and governed within LetsRevise.

It exists to ensure **trust, traceability, and auditability** for teachers, schools, and regulators.

---

## What Is Generated
AI is used to generate **lesson plan bundles** that include:
- Structured lesson pages
- Content blocks (text, diagrams, MCQs, etc.)
- Metadata aligned to curriculum mappings

AI **never** bypasses schema or curriculum validation.

---

## Generation Pipeline (Authoritative)
1. **Statutory Source**
   - Content is anchored to statutory curriculum sources (e.g. DfE GCSE)
   - Defined in `docs/curriculum/statutory/sources.json`

2. **Curriculum Mapping**
   - Statutory topics are mapped to LetsRevise internal curriculum IDs
   - Defined in `docs/curriculum/mappings/*.map.json`
   - Validated against `curriculum-mapping.schema.json`

3. **AI Prompt Assembly**
   - Prompt is constructed from:
     - Curriculum mapping
     - Topic metadata
     - Mapping contract rules
   - Prompt explicitly requires schema-valid JSON output only

4. **AI Generation**
   - Single deterministic generation pass
   - No retries, no auto-repair, no post-hoc mutation

5. **Schema Validation**
   - Output is validated against:
     - `lesson-plan-bundle.schema.json`
   - Any failure aborts generation

6. **Output Handling**
   - Generated bundles are **ephemeral**
   - They are ignored by git and regenerated on demand
   - No AI output is treated as source-of-truth

---

## Human Review & Control
- Generated lessons are marked with:
  - `status: "draft"`
- Teachers:
  - Review
  - Edit
  - Approve or reject content
- AI **never self-approves** content

---

## Non-Goals (Explicit)
- AI does **not**:
  - Decide curriculum coverage
  - Override statutory requirements
  - Publish content automatically
  - Learn from user data
  - Store generated lessons as canonical data

---

## Compliance & Auditability
Every lesson can be traced back to:
- Statutory source ID
- Curriculum mapping ID
- Schema version
- Generation timestamp

This guarantees explainability for:
- Teachers
- Inspectors
- Regulators
- Parents

---

## Summary
AI in LetsRevise is:
- **Assistive, not authoritative**
- **Schema-bound**
- **Curriculum-anchored**
- **Human-controlled**

This document is the canonical reference for AI content provenance.
