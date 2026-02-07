# AI Generator Interface (v1)

## Purpose
Define a strict, testable interface for AI-based lesson generation.
This interface is **design-only** and does not imply runtime execution.

The generator converts **Curriculum Topics** into **Lesson Plan Bundles**
that validate against `lesson-plan-bundle.schema.json`.

---

## Related Specifications
- `docs/curriculum/curriculum-spec.schema.json`
- `docs/curriculum/curriculum-to-lesson.contract.md`
- `docs/curriculum/lesson-plan-bundle.schema.json`

---

## Phase Scope
- Phase H: Internal, offline, batch-capable generation
- No student exposure
- No auto-publishing
- Human review required before lessons enter production

---

## Inputs

### Required Inputs
- `curriculumSpecVersion`
- `subjectId`
- `levelId`
- `boardId`
- `topicId`

### Resolved Topic Data
Loaded from Curriculum Spec:
- `topic.name`
- `topic.subtopics[]`
- `topic.examRequirements[]`

### Generation Constraints
- `maxLessons` (1–4)
- `targetPagesPerLesson` (3–8)
- `targetBlocksPerPage` (2–8)
- `ukExamTerminology = true`

---

## Output

### Required Output
A **Lesson Plan Bundle** object that:
- Conforms to `lesson-plan-bundle.schema.json`
- Uses stable slugs defined by the mapping contract
- Sets `isPublished = false`
- Sets `isFreePreview = false`

No exceptions.

---

## Forbidden Behaviours (Hard Rules)
The generator MUST NOT:
- Publish lessons
- Set access flags
- Reference pricing, subscriptions, or users
- Claim human authorship
- Generate copyrighted text verbatim
- Mutate existing lessons

---

## Example (Shape Only)

### Input (conceptual)

```json
{
  "subjectId": "biology",
  "levelId": "gcse",
  "boardId": "aqa",
  "topicId": "photosynthesis",
  "constraints": {
    "maxLessons": 1
  }
}
```

### Output (conceptual)

```json
{
  "bundleVersion": "1.0.0",
  "generatedAt": "2026-02-04T00:00:00Z",
  "lessons": [
    {
      "...validated lesson object..."
    }
  ]
}
```

---

## Review & Approval

All generated bundles require:
- Human review
- Explicit approval
- Separate publishing workflow

---

## Versioning

- Interface version: v1
- Breaking changes require v2+.

---

## What this achieves
After this step, you will have:
- A **full AI boundary** from syllabus → lessons
- Zero ambiguity for future AI work
- A generator that can be swapped, tested, or audited

When this is committed, **Phase H (Internal AI tooling)** becomes safe to start.

