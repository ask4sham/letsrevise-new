# Teacher Brain Architecture & Expansion Strategy

Permanent architectural reference for LetsRevise. Use this document to keep future Teacher Brain work aligned with the long-term vision.

## Core principle

**Teacher Brain is NOT a Metabolism engine.**

Teacher Brain is a **subject-agnostic educational intelligence framework**.

Metabolism is simply the **first fully-developed topic profile**.

## Architecture

```
Teacher Brain Engine
│
├── Biology
│   ├── Metabolism ✅
│   ├── Photosynthesis
│   ├── Respiration
│   ├── Enzymes
│   ├── Homeostasis
│   ├── Infection & Response
│   └── Genetics
│
├── Chemistry
│   ├── Atomic Structure
│   ├── Bonding
│   ├── Quantitative Chemistry
│   ├── Rates of Reaction
│   └── Electrolysis
│
├── Physics
│   ├── Energy
│   ├── Electricity
│   ├── Forces
│   ├── Waves
│   └── Space
│
├── Maths
│   ├── Fractions
│   ├── Algebra
│   ├── Ratio
│   ├── Probability
│   └── Geometry
│
└── KS3
    └── (same subject / topic pattern as above)
```

## Reusable components

The following systems are intended to remain **subject-agnostic**:

### 1. Concept Chain Engine

A → B → C → D learning progression.

### 2. Misconception Engine

- Students often think…
- Correct understanding…

### 3. Retrieval Planner

- Immediate retrieval
- Mid-lesson retrieval
- End-of-lesson retrieval
- Next-lesson retrieval

### 4. Exam Planner

- 1 mark
- 2 mark
- 4 mark
- 6 mark
- Grade 9 challenge

### 5. Activity Planner

- Drag & Drop
- Hotspot
- Sequence
- Text → Image
- Image → Drop Zones
- Interactive Diagram

### 6. Diagram Planner

- Purpose
- Must Show
- Labels
- Hotspots
- Assessment Focus
- Student Task

## Topic profiles

Each topic should provide **only**:

```json
{
  "concepts": [],
  "misconceptions": [],
  "diagramPlans": [],
  "examTargets": []
}
```

The Teacher Brain **engine** itself should not need changing when new subjects or topics are added.

## Development strategy

**Do NOT move to Chemistry yet.**

Finish **Biology** first.

### Priority Biology profiles

1. Photosynthesis
2. Respiration
3. Enzymes
4. Homeostasis
5. Mitosis
6. Infection & Response
7. Genetics

Validate Teacher Brain across Biology before expanding into other subjects.

## Long-term vision

Most AI lesson generators operate as:

```
Topic
  ↓
Prompt
  ↓
Lesson
```

LetsRevise Teacher Brain aims to operate as:

```
Topic
  ↓
Teacher Brain
  ↓
Pedagogy Layer
  ↓
Assessment Layer
  ↓
Activity Layer
  ↓
Diagram Layer
  ↓
Lesson
```

This architecture more closely reflects how expert teachers design learning experiences.

## Status

| Milestone | Reference |
| --- | --- |
| Teacher Brain Phase 3 complete | Tag: `teacher-brain-phase3-complete` |
| Code milestone | [`5bdc0ea1`](https://github.com/ask4sham/letsrevise-new/commit/5bdc0ea1) |
| Documentation milestone | [`031e2151`](https://github.com/ask4sham/letsrevise-new/commit/031e2151) |

## Related documentation

- [PHASE_3_COMPLETE.md](./PHASE_3_COMPLETE.md) — Phase 3 handoff, deliverables, code paths, tests
- [REGRESSION_SCREENSHOTS.md](./REGRESSION_SCREENSHOTS.md) — UI regression checklist and screenshot references
- [LESSON_GENERATOR_V4.md](../LESSON_GENERATOR_V4.md) — V4 lesson generation and Teacher Brain injection overview
