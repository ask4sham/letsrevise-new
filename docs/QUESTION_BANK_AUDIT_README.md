# Question Bank Audit

This audit reports **what question-bank content exists per sub-topic** for each subject/spec (Biology, Chemistry, Physics, etc.). It is **read-only**: it does not modify the database.

## What the audit does

- **Loads** the taxonomy for a spec (from `backend/config/*_topics.json` / platform taxonomy).
- **Counts** per sub-topic:
  - **TopicQuizQuestion** (MCQ and short-answer, draft + published)
  - **TopicFlashcard** (draft + published)
  - **ExamQuestion** (draft + published)
- **Scores** each sub-topic:
  - **Status:** EMPTY / GAP / OK
  - **Definition of Done (DoD):** INCOMPLETE / DONE
- **Writes** two markdown files per spec:
  - `docs/QUESTION_BANK_AUDIT_<specKey>.md` — full table and summary
  - `docs/SPRINT_ORDER_<specKey>.md` — ordered build list and sprint focus

Counts are **platform-wide** (no owner/teacher filter), so you see total content available.

## How to run

### One spec

From the **backend** directory:

```bash
node scripts/auditQuestionBanks.js --spec aqa-gcse-biology
```

Or with npm (pass the specKey after `--`):

```bash
npm run audit:question-banks:spec -- aqa-gcse-biology
```

**Output:**

- `docs/QUESTION_BANK_AUDIT_aqa-gcse-biology.md`
- `docs/SPRINT_ORDER_aqa-gcse-biology.md`

### All specs

From the **backend** directory:

```bash
node scripts/auditQuestionBanks.js --all
```

Or:

```bash
npm run audit:question-banks:all
```

This discovers every spec from `backend/config/*_topics.json` (or the platform’s known specKeys), runs the audit for each **sequentially**, and writes one pair of files per spec in `docs/`.

### Biology-only (backwards compatibility)

```bash
npm run audit:question-banks-biology
```

Same result as `--spec aqa-gcse-biology`; writes the same two files under `docs/` with `aqa-gcse-biology` in the filename.

## Where outputs go

| Option | Directory | Filenames |
|--------|-----------|-----------|
| Default | `docs/` (repo root) | `QUESTION_BANK_AUDIT_<specKey>.md`, `SPRINT_ORDER_<specKey>.md` |

`specKey` in filenames is sanitised: any `/` or `:` is replaced with `_`.

## Interpretation

### Status (EMPTY / GAP / OK)

- **EMPTY** — No quiz questions and no flashcards for that sub-topic. Must be built.
- **GAP** — Some content, but below the “OK” threshold. Top up before treating as a full bank.
- **OK** — Usable starter bank: ≥10 MCQs, ≥5 short-answer, ≥5 flashcards.

### Definition of Done (DONE / INCOMPLETE)

- **DONE** — Meets: ≥10 MCQs, ≥5 short-answer, **and** ≥1 question tagged for misconception/distractor. Safe for auto-attach and reuse (spec coverage still needs manual check).
- **INCOMPLETE** — Does not meet the above (e.g. missing short-answer or misconception-style questions).

### Sprint order

In `SPRINT_ORDER_<specKey>.md`, sub-topics are listed in **priority order**:

1. All **EMPTY** (syllabus order within this group)
2. All **GAP**
3. All **OK** (top-up only if needed)

Use this order to decide what to build or fill next.

## Requirements

- **MONGO_URI** must be set (e.g. in `backend/.env`). The script connects to MongoDB to read TopicQuizQuestion, TopicFlashcard, and ExamQuestion.
- No DB writes: the audit only reads.

## Invalid specKey

If you pass an unknown `specKey`, the script exits with a non-zero code and prints a short usage message plus the list of available specKeys (from config and taxonomy).
