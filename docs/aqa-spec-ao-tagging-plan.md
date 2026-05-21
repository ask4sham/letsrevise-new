# AQA spec / AO metadata tagging — design plan (documentation only)

**Status:** Plan only — **no implementation** in this document.  
**Goal:** Describe how LetsRevise could tag **lesson blocks** (and related content) with exam-board–style metadata so lessons stay portable, filterable, and future-proof for quizzes and revision.

**Scope note:** Examples use **AQA** language (AO1 / AO2 / AO3); the same shape should generalise to other boards (e.g. different objective taxonomies) via `examBoard` + optional `objectiveScheme` if needed later.

---

## 1. Proposed data shape

### 1.1 Block-level payload (recommended unit)

Metadata attaches to **each teachable / assessable block** (e.g. explanation, key idea, worked example, checkpoint stem, diagram caption context — exact block types TBD at implementation).

```json
{
  "examBoard": "AQA",
  "subject": "Biology",
  "examLevel": "GCSE",
  "specPoint": "4.2.1.1",
  "specPointLabel": "Cell structure (optional human label)",
  "assessmentObjective": "AO2",
  "commandWord": "explain",
  "marks": 4,
  "difficulty": "medium"
}
```

| Field | Type | Required? | Notes |
|-------|------|-------------|--------|
| `examBoard` | string | No | Normalised slug, e.g. `AQA`, `Edexcel`. Inherits from lesson when omitted. |
| `subject` | string | No | Inherits from lesson when omitted. |
| `examLevel` | string | No | e.g. `GCSE`, `A-Level`; inherits from lesson. |
| `specPoint` | string | No | Namespaced or plain code per product decision (e.g. taxonomy key vs display code). |
| `specPointLabel` | string | No | Teacher-facing short label. |
| `assessmentObjective` | string | No | For AQA GCSE science style: `AO1` \| `AO2` \| `AO3` (enum at save time). |
| `commandWord` | string | No | Controlled vocabulary preferred (describe, explain, compare, evaluate, …). |
| `marks` | number \| null | No | Typical exam-style mark tariff for that **chunk** of demand; null if not scored. |
| `difficulty` | string | No | e.g. `low` \| `medium` \| `high` — product-defined; not the same as Bloom unless explicitly mapped. |

### 1.2 Inheritance rules (avoid duplication)

- **Lesson-level defaults:** `examBoard`, `subject`, `examLevel`, optional default `specPoint` prefix — stored on the lesson (existing fields where they already exist).
- **Block-level overrides:** only fields that **differ** from the lesson default need to be stored on the block.
- **Resolved view:** editor and student UIs work off a **resolved** object = `{ ...lessonDefaults, ...blockOverrides }` (computed client- or server-side; not necessarily persisted denormalised).

### 1.3 Optional future extensions (out of scope for v1)

- `objectiveScheme`: e.g. `AQA-GCSE-SCIENCE-AO` vs `IB-AT` — only if multi-board AO enums collide.
- `skillTags`: string[] for cross-cutting skills (graph, maths, practical).
- `sourceRef`: link to textbook / past paper / item ID.

---

## 2. Where metadata should live

### 2.1 Storage (backend / DB)

- **Per block, inside existing structured lesson `pages[].blocks[]`**, under a dedicated key to avoid colliding with content and renderer-specific keys, e.g.:
  - `block.specMeta` **or**
  - `block.metadata.spec` (if a nested `metadata` object already exists for blocks).
- **Do not** embed long spec text in the block body; keep **codes + short labels** in metadata, prose in `content`.
- **Lesson document:** continue to hold board / subject / level / `topicKey` / `specKey` as today; **spec meta** on blocks **references** that context and overrides when needed.

### 2.2 Authoring source of truth

- Teachers edit in **Create / Edit lesson**; values are **saved with the lesson JSON** (same persistence path as other block fields).
- Optional later: import from generator tool or CSV — plan only: treat import as **populate `specMeta`**, same shape.

### 2.3 API / payloads

- **GET lesson** (teacher + student): include `specMeta` on blocks when present (respect existing **strip internal fields** rules for student payloads if any).
- **Validation:** soft validation on save (warn) vs hard (block publish) — product decision; low-risk start = **optional fields, no blocking**.

---

## 3. How it could appear in the editor

### 3.1 Minimal footprint (phase 1 UX)

- **Collapsed row** on each block card: chips for `AO2 · 4 marks · explain` when set.
- **“Spec / AO”** affordance (icon or link) opens a **small side panel** or inline drawer with the fields above (dropdowns + numeric marks + free-text spec point with autocomplete from taxonomy when available).

### 3.2 Power-user path

- **Bulk edit** (later): filter blocks by type → set AO + marks for all selected.
- **Lesson header** shows inherited board/level; panel shows **“Using lesson default”** with override toggles.

### 3.3 Guardrails

- **AO enum** tied to `examBoard` (AQA → AO1–3 only in UI).
- **Command word** picklist + “Other” to reduce garbage strings while staying flexible.

---

## 4. How it could appear to students

### 4.1 Default: low noise

- **No change** to layout if metadata absent.
- When present: **small, non-distracting badge** under block title or in margin (e.g. `AO2 · 4 marks`) — optional user/organisation setting to **hide entirely** for younger groups.

### 4.2 Learning transparency mode (optional later)

- Expandable “**Exam focus**” line: AO + command word + spec point label — helps students map lesson to paper language without turning every page into a rubric.

### 4.3 Accessibility

- Badges must be **readable, colour-not-only**, and not rely on AO colour alone (icon + text).

---

## 5. How it could support quizzes / revision later

### 5.1 Question generation & banks

- **Filter / weight** auto-picked MCQs or bank items by `assessmentObjective`, `specPoint`, `difficulty`.
- **Mark budget** per session: sum `marks` on included blocks to approximate exam pacing (rough heuristic).

### 5.2 Analytics

- Aggregate **which AO / spec points** a student has seen vs self-tested; feed teacher dashboards (“class weak on AO3 on 4.2.1.x”).

### 5.3 Revision & spaced repetition

- Cards / short drills tagged with same `specMeta` for **topic + AO** dimensions.
- **Difficulty** used for scheduling (harder cards recur with different interval) — only if product adopts SRS.

### 5.4 Exports

- PDF / print view could include an **appendix table**: block id → spec point → AO → marks (teacher-only export first).

---

## 6. Low-risk implementation phases

| Phase | Scope | Risk |
|-------|--------|------|
| **P0 — Schema & docs** | Add this plan + JSON schema (or TypeScript type) for `specMeta`; no UI. | Very low |
| **P1 — Persist optional blob** | Save/load `specMeta` on blocks; ignore in all renderers. | Low — no visible change |
| **P2 — Editor only** | Edit + display chips in Create/Edit; validate enums softly. | Low — teacher-only |
| **P3 — Student badges (off by default)** | Feature flag or org setting; default hidden. | Medium — visual QA |
| **P4 — Quiz / bank hooks** | Use `specMeta` only for **filtering** existing questions; no new generator logic. | Medium |
| **P5 — Analytics & exports** | Aggregate + reports; privacy review. | Higher — data policy |

**Principles:** ship **storage + editor** before **student surface**; never block lesson save on incomplete spec meta; keep **lesson-level inheritance** to limit teacher friction.

---

## 7. Open decisions (to resolve before coding)

1. **Exact key name** (`specMeta` vs nested `metadata`) and compatibility with any existing `metadata` on blocks.
2. **Spec point format** — align with existing `topicKey` / `specKey` taxonomy vs free text.
3. **Which block types** are taggable v1 (e.g. skip pure `diagram` unless paired with text).
4. **Student visibility** default and per-organisation policy.

---

*End of plan — implementation deferred.*
