# Teacher-First V1 — Recovery Points

**Last verified:** 2026-06-07  
**Status:** Both repositories pushed; tracked working trees clean.

---

## Primary stable tag (baseline lock)

| Field | letsrevise-new | letsrevise-generator |
|-------|----------------|----------------------|
| **Repo** | `https://github.com/ask4sham/letsrevise-new.git` | `https://github.com/ask4sham/letsrevise-generator.git` |
| **Branch** | `phase-3g8-authority-enforcement` | `fix/interactive-learning-stability` |
| **Commit** | `8eeef331` | `83785ce` |
| **Tag** | `milestone-teacher-first-v1-stable` | `milestone-teacher-first-v1-stable` |
| **Message** | Lock Teacher-First v1 stable baseline with revision wording. | Lock Teacher-First v1 stable generator export with revision wording. |

### Restore (stable baseline)

```bash
# letsrevise-new
git fetch origin --tags
git checkout milestone-teacher-first-v1-stable

# letsrevise-generator
git fetch origin --tags
git checkout milestone-teacher-first-v1-stable
```

---

## Latest recovery tag (stable + UI heading cleanup)

| Field | letsrevise-new | letsrevise-generator |
|-------|----------------|----------------------|
| **Repo** | `https://github.com/ask4sham/letsrevise-new.git` | `https://github.com/ask4sham/letsrevise-generator.git` |
| **Branch** | `phase-3g8-authority-enforcement` | `fix/interactive-learning-stability` |
| **Commit** | `e5f732c9` (includes recovery doc) | `861645b` |
| **Tag** | `milestone-teacher-first-v1-recovery` | `milestone-teacher-first-v1-recovery` |
| **Message** | Strip redundant Teacher-First section headings for cleaner lesson UI. | Strip redundant Teacher-First section headings for cleaner lesson UI. |

### Restore (recommended before new teaching-quality work)

```bash
# letsrevise-new
git fetch origin --tags
git checkout milestone-teacher-first-v1-recovery

# letsrevise-generator
git fetch origin --tags
git checkout milestone-teacher-first-v1-recovery
```

---

## What is locked at these tags

- Teacher-First block order (Definition block 3, Scenario block 4)
- Scope authority (objectives, checkpoint, exam practice, summary, memory rule, keywords)
- Export → import parity
- Revision Objectives / Revision Lesson Details wording
- Nervous System, Homeostasis, and Eye scope boundaries

## Verification checklist

- [x] `milestone-teacher-first-v1-stable` exists on remote (both repos)
- [x] `milestone-teacher-first-v1-recovery` exists on remote (both repos)
- [x] Branch tips pushed to `origin`
- [x] No uncommitted changes on tracked milestone files

## Regression commands (after restore)

```bash
# letsrevise-new
npx jest tests/teacherFirstExportPipeline.test.js tests/assessmentScopeAuthority.test.js

# letsrevise-generator
node lib/teacherFirstExportPipeline.test.js
node lib/scopeAuthorityLite.test.js
node lib/presentationPolishExport.test.js
```
