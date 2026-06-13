# COPY_BACK_CHECKLIST.md — P0 + P1.0 combined integration

> Tick each box. Stop and investigate at the first ❌.

---

## 0 — Pre-flight

- [ ] Read `README.md`, `MERGE_PLAN.md`, `SECURITY_NOTES.md`, `ENV_REQUIRED.md`.
- [ ] Confirm access to your Render env-var panel.
- [ ] Confirm a recent backup of `main`.
- [ ] Confirm no one else is mid-merge.

---

## 1 — Branch

```bash
cd letsrevise-new
git checkout main
git pull origin main
git checkout -b teacher-brain-p0-p1
```

---

## 2 — Portability acceptance grep

```bash
grep -R '[/]app/backend|[/]app/frontend' \
  ./teacher-brain-engine-p1/files ./teacher-brain-engine-p1/*.md
# expected: empty
```

- [ ] Empty output. (Pack contains no sandbox absolute paths.)

---

## 3 — Backup destination files

```bash
mkdir -p _backup
for f in \
  backend/server.py \
  backend/auth.py \
  backend/lesson_engine.py \
  backend/lesson_generator.py \
  backend/requirements.txt \
  frontend/src/App.js \
  frontend/src/lib/api.js \
  frontend/src/contexts/AuthContext.jsx \
  frontend/src/pages/Landing.jsx \
  frontend/src/pages/LessonView.jsx
do
  mkdir -p _backup/$(dirname "$f")
  [ -f "$f" ] && cp "$f" "_backup/$f"
done
```

- [ ] Backup created.

---

## 4 — Copy NEW (🟢) files

```bash
# Backend
cp teacher-brain-engine-p1/files/backend/usage.py            backend/usage.py
cp teacher-brain-engine-p1/files/backend/idempotency.py      backend/idempotency.py
cp teacher-brain-engine-p1/files/backend/lesson_pipeline.py  backend/lesson_pipeline.py
cp teacher-brain-engine-p1/files/backend/lesson_validator.py backend/lesson_validator.py
cp teacher-brain-engine-p1/files/backend/visual_explanation.py backend/visual_explanation.py    # P1.0

# Backend tests
mkdir -p backend/tests
cp teacher-brain-engine-p1/files/backend/tests/test_usage.py             backend/tests/
cp teacher-brain-engine-p1/files/backend/tests/test_pipeline.py          backend/tests/
cp teacher-brain-engine-p1/files/backend/tests/test_validator.py         backend/tests/
cp teacher-brain-engine-p1/files/backend/tests/test_visual_explanation.py backend/tests/         # P1.0

# Frontend
cp teacher-brain-engine-p1/files/frontend/src/components/ErrorBoundary.jsx          frontend/src/components/
cp teacher-brain-engine-p1/files/frontend/src/components/ProtectedRoute.jsx          frontend/src/components/
cp teacher-brain-engine-p1/files/frontend/src/components/VisualExplanationPanel.jsx  frontend/src/components/   # P1.0
```

- [ ] All 11 NEW files copied. If any destination already exists with newer content, STOP and review.

---

## 5 — Merge 🟡 files surgically

### 5a — `frontend/src/lib/api.js`
Add the Bearer interceptor (P0) and the new method (P1.0). Open the pack version and copy:
- The axios `client` setup with request/response interceptors
- The exported `api` object methods, **especially** `generateVisualExplanation`

```js
// at the bottom of the api object:
generateVisualExplanation: (payload) =>
  client.post("/visual-explanations/generate", payload).then((r) => r.data),
```

- [ ] Bearer attach on every request.
- [ ] 401 response → clear token + redirect to `/login?next=`.
- [ ] `api.generateVisualExplanation(payload)` exported.

### 5b — `frontend/src/contexts/AuthContext.jsx`
- [ ] JWT stored at `localStorage['tb.access_token']`.

### 5c — `backend/requirements.txt`
```bash
cd backend
pip install bcrypt pyjwt pydantic emergentintegrations
pip freeze | sort > requirements.txt
```
- [ ] Contains `bcrypt`, `pyjwt`, `pydantic`, `emergentintegrations`.

### 5d — `frontend/src/pages/Landing.jsx`
- [ ] Add `if (!lesson?.id) { setInvalidInfoBanner(...); return; }` before any `navigate('/lesson/' + lesson.id)`.

### 5e — `frontend/src/pages/Login.jsx`
- [ ] `useState("")` defaults (no `teacher@letsrevise.dev` / `LetsRevise!2026` hardcoded).
- [ ] Placeholder text — optionally change `placeholder="teacher@letsrevise.dev"` to `placeholder="you@yourdomain.com"`.

---

## 6 — Merge 🔴 HIGH files

### 6a — `backend/server.py`
Port these blocks into your existing `server.py`:

1. **Imports**:
   ```python
   from auth import auth_router, seed_admin, require_user, get_current_user, public_user
   from usage import check_budget, record_usage, BudgetExceeded, ensure_usage_indexes
   from idempotency import InflightRegistry, GenerationInProgress
   from lesson_pipeline import generate_lesson_pipeline
   from visual_explanation import build_visual_explanation     # P1.0
   ```
2. **Constants**:
   ```python
   MARK_TIMEOUT_SECONDS = 60.0
   VISUAL_TIMEOUT_SECONDS = 120.0                              # P1.0
   ```
3. **Startup** (lifespan or `@app.on_event("startup")`):
   ```python
   app.state.inflight = InflightRegistry()
   await seed_admin(db)
   await ensure_usage_indexes(db)
   ```
4. **Five exception handlers** — copy from pack `server.py` (401/422/429/503/409 with sanitised envelopes).
5. **Pydantic model + P1.0 route block** — paste the entire `class VisualExplanationRequest(BaseModel):` + `@api.post("/visual-explanations/generate")` block (~85 lines) above `app.include_router(api)`.
6. **Protect existing LLM routes** — add `user=Depends(get_current_user)` and `check_budget()` calls to `/lessons/generate`, `/lessons/{id}/mark`, `/lessons/{id}` DELETE.

- [ ] Backend imports cleanly (`python -c "import server"`).
- [ ] `app.routes` includes `/api/visual-explanations/generate`.

### 6b — `frontend/src/App.js`
```jsx
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* … existing routes … */}
            <Route path="/__boom" element={<BoomRoute />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

function BoomRoute() { throw new Error("Deliberate boom"); }
```

- [ ] `<ErrorBoundary>` is OUTERMOST.

### 6c — `frontend/src/pages/LessonView.jsx` (P1.0 mount)

Two changes:

```jsx
// 1. Import (top of file)
import VisualExplanationPanel from "@/components/VisualExplanationPanel";

// 2. Mount between the lesson header </motion.div> and the
//    "<div className='mt-10 grid lg:grid-cols-[1fr_320px] ...'>" block:
<div className="mt-8">
  <VisualExplanationPanel lesson={lesson} />
</div>
```

- [ ] Panel visible at the top of every lesson page.

---

## 7 — Set environment variables (no new vars for P1.0)

P1.0 reuses `EMERGENT_LLM_KEY`. No new env keys needed. See `ENV_REQUIRED.md` for the full list — same as p0 pack.

Confirm Render env contains:
- [ ] `JWT_SECRET` (generate fresh, NOT sandbox value)
- [ ] `ADMIN_EMAIL` (real, NOT `teacher@letsrevise.dev`)
- [ ] `ADMIN_PASSWORD` (strong, NOT `LetsRevise!2026`)
- [ ] `TEACHER_BRAIN_DAILY_LLM_LIMIT=10` (or your chosen cap)
- [ ] `TEACHER_BRAIN_MONTHLY_LLM_LIMIT=100`
- [ ] `EMERGENT_LLM_KEY` (used by both Claude text gen AND Nano Banana image gen)
- [ ] `MONGO_URL`, `DB_NAME`
- [ ] `TEACHER_BRAIN_EXAMINER_LANGUAGE_V2=0` ⚠️ keep OFF
- [ ] `TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE=0` ⚠️ keep OFF
- [ ] `TEACHER_BRAIN_TEACHER_FIRST_OPENING=0` ⚠️ keep OFF

---

## 8 — Run tests

```bash
cd backend
python -m pytest tests/test_usage.py \
                 tests/test_pipeline.py \
                 tests/test_validator.py \
                 tests/test_visual_explanation.py -v
# Expected: 39 passed (34 P0 + 5 P1.0)
```

- [ ] 39/39 pass.

```bash
cd ../frontend
yarn install
yarn build
```

- [ ] Build succeeds. Source-map warnings OK.

---

## 9 — Manual smoke

Start local dev server (`yarn start` + your usual backend launcher):

- [ ] `/` Landing renders
- [ ] `/login` accepts your real admin creds
- [ ] Header shows email + usage chip
- [ ] `/library` lists lessons
- [ ] Public seed lesson opens
- [ ] `/__boom` shows ErrorBoundary fallback (no stack)
- [ ] **Open any lesson → click "Visual explanation" panel → type "The eye" → click Generate**
  - [ ] Image appears (labelled GCSE diagram, white background)
  - [ ] 8 sections render below: what shows / key parts / step-by-step / why GCSE / common mistake / exam tip / exam question / model answer
  - [ ] Watermark reads `© letsrevise.com · GCSE diagram`
  - [ ] Usage chip ticks up by 1
- [ ] Anonymous `POST /api/visual-explanations/generate` returns **401**
- [ ] Double-click Generate → 409 in-flight lock
- [ ] Provider failure (rare) → 503 envelope, no half-saved doc

---

## 10 — API smoke

```bash
API=https://your-letsrevise-domain    # or http://localhost:8001

# Auth gate
curl -s -o /dev/null -w "%{http_code}\n" -X POST $API/api/visual-explanations/generate \
  -H "Content-Type: application/json" -d '{"topic":"The eye"}'                                 # → 401

# Login
TOKEN=$(curl -s -X POST $API/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"<your admin>","password":"<your password>"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# Live generation
curl -s -X POST $API/api/visual-explanations/generate \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"topic":"Photosynthesis"}' | python3 -m json.tool | head -30
```

- [ ] 401 for anon
- [ ] 200 for signed-in, with `image_data_url`, `explanation`, `provider_status: "image_generated"`

---

## 11 — Secret scan

```bash
cd frontend
yarn build
grep -rE 'EMERGENT_LLM_KEY|JWT_SECRET|MONGO_URL|sk-emergent|sk-ant-|mongodb://' \
  build/static/js/
# expected: empty
```

- [ ] Empty.

---

## 12 — Commit

```bash
git add backend frontend docs
git status   # review every line
git diff --stat HEAD
git commit -m "integrate Teacher Brain P0 hardening + P1.0 GCSE visual explanation"
```

- [ ] Diff reviewed.

---

## 13 — Tag recovery point

```bash
git tag -a teacher-brain-p0-p1-integrated \
  -m "P0 hardening + P1.0 visual explanation integrated; pre-feature recovery point"
git push origin teacher-brain-p0-p1 --tags
```

- [ ] Tag pushed.

---

## 14 — Render preview before main

- [ ] Deploy `teacher-brain-p0-p1` to a Render preview env.
- [ ] Re-run §9 + §10 against the preview URL.
- [ ] Rotate `ADMIN_PASSWORD` + `JWT_SECRET` to production-only values.
- [ ] Confirm `TEACHER_BRAIN_*` flags are all `0` in production env.
- [ ] Confirm `CORS_ORIGINS` is restricted to your real domains.

Only then open a PR to `main`.

---

## 15 — Stop

Do not start Misconception Heatmap, Stripe, SSE, multi-subject, or per-block visualise buttons until this is in `main`.
