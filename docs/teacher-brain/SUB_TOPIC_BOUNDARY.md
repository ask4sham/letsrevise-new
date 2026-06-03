# Sub-Topic Boundary Intelligence (Teacher Brain)

## Curriculum rule

| Level | Role |
|-------|------|
| **Main topic / unit** | Organisational container only (e.g. *Homeostasis and Response*) |
| **Sub-topic (leaf)** | **Teaching boundary** for a single lesson |

Teacher Brain must treat the **selected sub-topic** as the primary scope for:

- Lesson content and blocks
- Diagrams and interactive activities
- Checkpoints, flashcards, quizzes, practice and exam questions
- Retrieval tasks, misconceptions, and exam techniques

At least **90–95%** of generated teaching and assessment should be **in-scope** for the selected sub-topic.

## Neighbouring sub-topics

Other lessons in the same unit may be referenced **briefly for context** (one or two sentences, no major activity).

They must **not** become the primary learning objective of:

- Activities (drag-and-drop, step-by-step, hotspot, label diagram)
- Checkpoints or self-checks
- Quizzes, flashcards, or exam-style questions
- Retrieval or diagram generation briefs

## Forbidden as primary targets

Concepts that belong to **dedicated sibling lessons** are **forbidden** as the main focus of assessment and activities in the current lesson.

Example: a lesson on **Structure and function of the nervous system** must not centre on reflex arc pathway drills, brain region labelling, eye accommodation, or thermoregulation control — those belong to their own sub-topic lessons.

## Pipeline order (target architecture)

```text
Selected lesson
    → Resolve sub-topic profile (taxonomy key)
    → SubTopicBoundaryGuard   ← permission layer (first)
    → Allowed concept pool only
    → Coverage engine         ← balance within allowed pool
    → Generation
```

Coverage Gate must **never** rank or balance concepts that failed the boundary guard.

## Feature flag (future wiring)

| Value | Meaning |
|-------|---------|
| `TEACHER_BRAIN_SUBTOPIC_BOUNDARY=0` | Off (default until wired) |
| `1` | Warn / report only in logs and API diagnostics |
| `2` | Enforce reject on forbidden-primary slots and blocks |

Phase 0–2 ships the guard and profiles **without** changing generate-and-save, Generate AI Assets, or student rendering.

## First profile: `nervous-system-structure`

Taxonomy key: `nervous-system-structure`  
Display: *Structure and function of the nervous system*

**In-scope (primary):** CNS, PNS, neurones, nerves, axons, dendrites, myelin sheath, impulse transmission, synapses (structure context).

**Neighbour (mention only):** reflex arc, brain, eye.

**Forbidden (primary activity/question targets):** reflex arc pathway, brain regions, accommodation, thermoregulation.

## Related modules

- `lib/teacherBrain/subTopicProfiles.js` — leaf profiles keyed by taxonomy
- `lib/teacherBrain/subTopicBoundaryGuard.js` — pure classification and validation
- `tests/subTopicBoundaryGuard.test.js` — contract tests
