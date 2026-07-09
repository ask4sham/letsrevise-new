# Technical Debt Register (Phase 4E)

**Status:** Document only — do **not** fix as part of the Stability Engineering sprint.  
**Baseline:** `production-table-parts-enabled-v1` (`5eeeb602`)

These items increase long-term risk. Track them; schedule separately after regression protection is in place.

| ID | Area | Concern | Severity | Notes |
|----|------|---------|----------|-------|
| TD-01 | `ExamQuestionBlock.tsx` | Large monolithic component (~770+ lines); single + MCQ + short paths | Medium | Freeze exam behaviour; extract only with golden tests green |
| TD-02 | Taxonomy | Duplicate FE/BE resolvers (`resolveTopicLabelToKey`, `normalizeLessonTopicKey`, create-lesson sync) | Medium | WIP exists locally; ship as isolated PR later |
| TD-03 | Sticky layout | JS stacked breakpoint (767px) vs CSS sticky (900px) on main | Medium | Tablet widths show rails that do not stick; WIP fix unmerged |
| TD-04 | Jest / ESM | `LessonViewPage.integration` fails to load (`remark-breaks` ESM) | Medium | Tooling, not product regression |
| TD-05 | Full test suite | Backend `npm test` historically OOMs | High for CI | Prefer targeted suites (`test:golden`, file filters) |
| TD-06 | Legacy lessons | Lessons without namespaced `topicKey` / `specKey` | Medium | Generate AI assets / banks fail; demo only mapped lessons |
| TD-07 | Feature flags | `REACT_APP_TABLE_PARTS_ENABLED` only in Netlify dashboard (not `netlify.toml`) | Medium | Easy to lose on new env; validate via build report |
| TD-08 | Deploy lag | Frontend Netlify vs Render API can diverge | Medium | Check `/api/health` commit vs `origin/main` |
| TD-09 | `/api/visuals` | Intermittent 404s for some visual assets | Low–Med | Separate from exam baseline |
| TD-10 | No Playwright historically | Browser journeys unguarded until Phase 4C | Medium | Addressed by smoke suite; keep expanding |

## Rules for this register

1. Do not “drive-by” fix these during feature work.
2. Each debt item needs its own PR with regression tests.
3. Prefer documenting new debt here over silent workarounds.
