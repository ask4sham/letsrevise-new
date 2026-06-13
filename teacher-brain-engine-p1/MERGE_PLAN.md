# MERGE_PLAN.md — source-side merge plan (P0 + P1.0)

> Source-side plan only. Diff each file against your real repo before applying.

---

## Risk legend

- **🟢 LOW** — net-new file
- **🟡 MED** — destination likely exists; merge, do not overwrite
- **🔴 HIGH** — central app file; surgical merge required

---

## A. Backend (P0 hardened + P1.0 new)

| Source (in pack) | Suggested destination | Action | Notes | Risk |
|---|---|---|---|---|
| `files/backend/server.py` | `backend/server.py` | **🔴 MERGE** | Adds 5 exception handlers, `app.state.inflight`, `seed_admin()`, JWT/budget/idempotency deps, **plus the P1.0 `POST /visual-explanations/generate` route** (~85 lines) above `app.include_router(api)`. Also imports `build_visual_explanation` and adds `VISUAL_TIMEOUT_SECONDS = 120.0`. | HIGH |
| `files/backend/auth.py` | `backend/auth.py` | 🟡 NEW or MERGE | JWT + bcrypt + seed_admin. Skip if you use Emergent Google Auth — re-implement `get_current_user()` for your auth source. | MED |
| `files/backend/usage.py` | `backend/usage.py` | 🟢 NEW | Daily/monthly LLM ledger; `check_budget()` runs **before** any LLM call (lessons + marks + visual_explanations all share the same per-user counter). | LOW |
| `files/backend/idempotency.py` | `backend/idempotency.py` | 🟢 NEW | In-process inflight lock. | LOW |
| `files/backend/lesson_pipeline.py` | `backend/lesson_pipeline.py` | 🟢 NEW | Validate-and-retry pipeline. | LOW |
| `files/backend/lesson_validator.py` | `backend/lesson_validator.py` | 🟢 NEW | Pydantic schema + safe error strings. | LOW |
| `files/backend/lesson_engine.py` | `backend/lesson_engine.py` | 🟡 REVIEW | Examiner V2 scorer. Diff with your existing version. | MED |
| `files/backend/lesson_generator.py` | `backend/lesson_generator.py` | 🟡 REVIEW | Claude Sonnet 4.5 client. Diff with yours. | MED |
| **`files/backend/visual_explanation.py`** | **`backend/visual_explanation.py`** | **🟢 NEW (P1.0)** | Two-stage generator. Claude for structured 8-section JSON, Nano Banana for image. Image step is best-effort — never raises. | LOW |
| `files/backend/requirements.txt` | `backend/requirements.txt` | 🟡 MERGE | `pip install bcrypt pyjwt pydantic emergentintegrations` then `pip freeze \| sort > backend/requirements.txt`. Do not blind-overwrite. | MED |
| `files/backend/tests/test_usage.py` | `backend/tests/test_usage.py` | 🟢 NEW | Portable. | LOW |
| `files/backend/tests/test_pipeline.py` | `backend/tests/test_pipeline.py` | 🟢 NEW | Portable. | LOW |
| `files/backend/tests/test_validator.py` | `backend/tests/test_validator.py` | 🟢 NEW | Portable. | LOW |
| **`files/backend/tests/test_visual_explanation.py`** | **`backend/tests/test_visual_explanation.py`** | **🟢 NEW (P1.0)** | 5 cheap tests — auth gate, bearer validity, empty-topic 422, module importable, schema sanity. No LLM spend. | LOW |

---

## B. Frontend (P0 + P1.0)

| Source (in pack) | Suggested destination | Action | Notes | Risk |
|---|---|---|---|---|
| `files/frontend/src/App.js` | `frontend/src/App.js` | **🔴 MERGE** | Wrap root with `<ErrorBoundary>` ABOVE `<AuthProvider>`. | HIGH |
| `files/frontend/src/components/ErrorBoundary.jsx` | `frontend/src/components/ErrorBoundary.jsx` | 🟢 NEW | sanitize() strips secrets/paths/stack. | LOW |
| `files/frontend/src/components/ProtectedRoute.jsx` | `frontend/src/components/ProtectedRoute.jsx` | 🟢 NEW | Redirects unauth → `/login?next=`. | LOW |
| **`files/frontend/src/components/VisualExplanationPanel.jsx`** | **`frontend/src/components/VisualExplanationPanel.jsx`** | **🟢 NEW (P1.0)** | ~230 lines, self-contained. Watermark reads `© letsrevise.com · GCSE diagram`. Uses `data-testid="visual-explanation-*"` selectors. | LOW |
| `files/frontend/src/contexts/AuthContext.jsx` | `frontend/src/contexts/AuthContext.jsx` | 🟡 NEW or MERGE | JWT in `localStorage['tb.access_token']`. | MED |
| `files/frontend/src/lib/api.js` | `frontend/src/lib/api.js` | 🟡 MERGE | Axios instance + Bearer interceptor + 401 redirect + **P1.0 `api.generateVisualExplanation(payload)` method** (one new entry on the exported `api` object). | MED |
| `files/frontend/src/pages/Login.jsx` | `frontend/src/pages/Login.jsx` | 🟢 NEW or REVIEW | Dev defaults already stripped (lines 22–23 are empty strings). | LOW |
| `files/frontend/src/pages/Landing.jsx` | `frontend/src/pages/Landing.jsx` | 🟡 MERGE | Only required line: `if (!lesson?.id) return;` guard before navigation. | MED |
| **`files/frontend/src/pages/LessonView.jsx`** | **`frontend/src/pages/LessonView.jsx`** | **🟡 MERGE (P1.0)** | Import `VisualExplanationPanel` and mount it as a single block between the lesson header `</motion.div>` and the `grid lg:grid-cols-[1fr_320px]` container (lines ~221). Two lines of import + 3 lines of JSX. | MED |

---

## C. P1.0-only delta (if you've already integrated the p0 pack)

If your `letsrevise-new` repo already has the P0 hardening committed (tag `teacher-brain-p0-hardening-integrated`), you can apply ONLY these 5 files:

| Action | File |
|---|---|
| 🟢 NEW | `backend/visual_explanation.py` |
| 🔴 MERGE | `backend/server.py` — append the P1.0 route block + 1 import line + 1 constant |
| 🟢 NEW | `backend/tests/test_visual_explanation.py` |
| 🟢 NEW | `frontend/src/components/VisualExplanationPanel.jsx` |
| 🟡 MERGE | `frontend/src/lib/api.js` — append `generateVisualExplanation()` method |
| 🟡 MERGE | `frontend/src/pages/LessonView.jsx` — import + mount panel (2 + 3 lines) |

That's the minimal viable P1.0 delta — 6 files, ~270 net new lines.

---

## D. Pre-merge sanity check

```bash
# 1. Confirm the pack is portable
grep -R '[/]app/backend|[/]app/frontend' ./teacher-brain-engine-p1/files \
                                         ./teacher-brain-engine-p1/*.md
# expected: empty

# 2. Confirm no secrets in pack
grep -rE 'sk-emergent|sk-ant-|mongodb://|JWT_SECRET=[a-zA-Z]|EMERGENT_LLM_KEY=[a-zA-Z]' \
  ./teacher-brain-engine-p1/files
# expected: empty
```

Then follow `COPY_BACK_CHECKLIST.md`.
