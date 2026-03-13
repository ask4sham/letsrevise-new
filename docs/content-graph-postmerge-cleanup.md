# Content Graph Post-Merge Cleanup — Incident Note

**Date:** 2026-03-09  
**Commit:** 65f1c280 — "feat: introduce Content Graph layer with coverage analytics"

---

## What Happened

The Content Graph feature was committed and pushed directly to `origin/main` in a single large commit. That commit unintentionally included many generated files, dependencies, and artifacts alongside the actual source code.

---

## What Was Unintentionally Committed

| Category | Path | Approx. count |
|----------|------|---------------|
| **Dependencies** | `backend/node_modules/` | ~230+ files |
| **Coverage reports** | `backend/coverage/` (lcov, clover.xml) | ~100+ files |
| **Python cache** | `__pycache__/`, `backend/.../__pycache__/` | 4+ files |
| **Generated reports** | `reports/` (COVERAGE, EMBED_KNOWLEDGE_DOCS, etc.) | ~15 files |
| **Generated PDF** | `topic-summary.pdf` | 1 file |
| **Video artifacts** | `media/videos/...` (partial movie files) | many |

**Total:** ~1,700+ files in the commit, of which ~350+ were junk. The remainder included Content Graph source (intended) plus some unrelated config/controller changes.

---

## Cleanup Performed

1. **Removed from Git tracking (index only):**
   - `backend/node_modules/`
   - `backend/coverage/`
   - `__pycache__/` and nested `__pycache__/`
   - `reports/`
   - `topic-summary.pdf`

2. **Updated `.gitignore`** to include:
   - `backend/coverage/`, `coverage/`
   - `__pycache__/`, `*.pyc`
   - `reports/`
   - `topic-summary.pdf`

3. **Files remain on disk** — only the Git index was updated. No source code was deleted.

---

## How to Avoid This Next Time

1. **Avoid broad staging:** Do not use `git add .` or `git add -A` when the working tree contains node_modules, coverage, reports, or other generated files. Stage specific paths instead.

2. **Check before commit:**
   ```bash
   git status
   git diff --cached --stat
   ```
   Ensure no `node_modules`, `coverage`, `__pycache__`, or `reports` appear.

3. **Ensure .gitignore is complete** before adding new generated artifacts. Patterns in .gitignore do not apply to files that are **already tracked**; those must be removed with `git rm -r --cached <path>`.

4. **Use a feature branch and PR** instead of pushing directly to main. This allows review and catches accidental inclusions before merge.

5. **Pre-commit hook (optional):** Add a hook that rejects commits containing `node_modules`, `coverage`, or `__pycache__` in the staged files.
