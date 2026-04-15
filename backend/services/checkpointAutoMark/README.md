# Keyword-bank auto-marking (short-answer checkpoints)

## Purpose

Conservative auto-marking for GCSE-style short answers using **required / optional keywords**, **forbidden misconceptions**, and **accepted answer variants**. Intended for `Lesson.pages[].checkpoint.type === "shortExplain"` with `checkpoint.autoMark` stored on the lesson document.

## Tuning strictness

| Control | Effect |
|--------|--------|
| **`minMatchThreshold`** (0–1) | Fraction of **required** keywords needed for **partial** (below 100% but at or above this). Default **0.6** in code. Raise to **0.75–0.85** for stricter marking; lower to **0.5** for weaker cohorts. |
| **More required keywords** | Harder to get “correct” (all required). |
| **Optional keywords only** | Never forces “correct” alone; improves feedback. |
| **`forbiddenMisconceptions`** | Any hit → **incorrect** immediately (use sparingly, exact phrases). |
| **`acceptedVariants`** | Full-line synonyms; use for model answers that vary legitimately. |

## Keyword phrasing

- Prefer **singular stem** keywords (`artery`, `muscle`, `vein`) — matching allows common plurals via a **5-character stem** rule and word boundaries.
- Avoid ultra-short required tokens (`&lt; 3` chars are ignored for fuzzy match).
- For confusable terms, add **forbidden** lines (e.g. oxygenation errors).

## Teacher override

Store server `AutoMarkResult` on `PracticeAttempt.checkpointAutoMark`. If `teacherMarkedOutcome` is set, reporting should prefer it over `verdict`.

## Scripts

```bash
npm run test:keyword-mark
```
