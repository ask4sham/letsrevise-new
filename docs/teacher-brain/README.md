# Teacher Brain

Subject-agnostic educational intelligence for LetsRevise lesson design. Topic-specific knowledge (e.g. Metabolism) lives in **topic profiles**; the engine and reusable planners stay unchanged as new subjects and topics are added.

**Start here:** [TEACHER_BRAIN_ARCHITECTURE.md](./TEACHER_BRAIN_ARCHITECTURE.md) — vision, expansion strategy, reusable components, and Biology-first development priorities.

## Documentation map

| Document | Purpose |
| --- | --- |
| [TEACHER_BRAIN_ARCHITECTURE.md](./TEACHER_BRAIN_ARCHITECTURE.md) | **Primary reference** — long-term vision, topic tree, topic profile shape, development strategy |
| [PHASE_3_COMPLETE.md](./PHASE_3_COMPLETE.md) | Phase 3 completion handoff — activity-aware design briefs, code paths, tests |
| [REGRESSION_SCREENSHOTS.md](./REGRESSION_SCREENSHOTS.md) | Manual regression checklist and screenshot references |
| [LESSON_GENERATOR_V4.md](../LESSON_GENERATOR_V4.md) | V4 generator integration and Teacher Brain injection in the lesson pipeline |

## Milestones

- **Tag:** `teacher-brain-phase3-complete`
- **Code:** [`5bdc0ea1`](https://github.com/ask4sham/letsrevise-new/commit/5bdc0ea1)
- **Docs package:** [`031e2151`](https://github.com/ask4sham/letsrevise-new/commit/031e2151)

## Screenshots

Regression UI captures live under [screenshots/](./screenshots/). See [REGRESSION_SCREENSHOTS.md](./REGRESSION_SCREENSHOTS.md) for when to re-run checks.

## Working on Teacher Brain

1. Read [TEACHER_BRAIN_ARCHITECTURE.md](./TEACHER_BRAIN_ARCHITECTURE.md) before adding subjects, topics, or engine features.
2. Prefer new **Biology** topic profiles over Chemistry or other subjects until Biology validation is complete.
3. Keep briefs and pedagogy in `block.note` / topic data — do not change V4 export schema or student renderers without an explicit product decision.
4. After UI or brief-template changes, follow [REGRESSION_SCREENSHOTS.md](./REGRESSION_SCREENSHOTS.md).
