# Phase Gate: PR20 “Make classroom-ready” — handoff checklist

What must be done now to verify PR20 and move cleanly into the next phase.

---

## 1) Local verification (backend)

### Run the PR20 test suite deterministically

```bash
cd backend
DISABLE_OPENAI=1 npm test -- tests/makeClassroomReady.integration.test.js
```

### Run the adjacent regression tests (recommended)

```bash
DISABLE_OPENAI=1 npm test -- \
  tests/oneClickFix.integration.test.js \
  tests/oneClickFixBulk.integration.test.js \
  tests/teacherNeedsAttention.integration.test.js
```

### Quick API smoke (manual)

1. Start backend:
   ```bash
   cd backend
   npm run dev
   ```

2. Call endpoint (replace `<LESSON_ID>` and `<TEACHER_TOKEN>`):
   ```bash
   curl -X POST "http://localhost:5000/api/reports/lessons/<LESSON_ID>/make-classroom-ready" \
     -H "Authorization: Bearer <TEACHER_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"days":7,"attachPractice":true,"attachLimit":10,"regeneratePlan":true,"planLimit":10,"markReviewed":true,"forcePlan":false}'
   ```

3. **Confirm response:**
   - `ok: true`
   - `attach` present
   - `plan.status` present
   - `plan.content` **absent**
   - `readiness.status` present

---

## 2) Local verification (frontend)

### Build

```bash
cd frontend
npm run build
```

### Core UI smoke (manual)

1. Log in as teacher.
2. Open any lesson editor `/edit-lesson/:id`.
3. **In Readiness panel:**
   - Click **Make classroom-ready**.
   - Confirm toast/message summarizes attach + plan status + reviewed.
4. Click **Publish**.
   - If not READY → modal shows “What’s missing?” + buttons ordered:
     - **Make classroom-ready**
     - **Publish anyway**
     - **Cancel**
5. After “Make classroom-ready”, re-open page:
   - “Reviewed” should reflect updated `reviewedAt`.
   - Attached practice questions should appear in “Past paper questions”.
   - Reteach plan sidebar should update (if available).

---

## 3) Release checklist (staging)

### Backend deploy

- Ensure env vars in staging:
  - `OPENAI_API_KEY` set (if you want plan generation).
  - `DISABLE_OPENAI` **not** set (unless you intentionally want NOT_CONFIGURED).
- Deploy backend.
- Run: `npm test -- tests/makeClassroomReady.integration.test.js`
- (If staging doesn’t run tests, at least hit the endpoint once via Postman/curl.)

### Frontend deploy

- Deploy frontend.
- Smoke test PR20 UI paths (same as section 2).

---

## 4) Post-deploy production smoke (10 minutes max)

Pick 1 teacher account and 1 published lesson.

### Teacher flow

- Open editor → **Make classroom-ready** → ensure READY (or at least signals improve).
- Publish gate modal behaves correctly.
- Practice attached count increases only once (idempotent).

### Student flow

- Open published lesson → practice renders for entitled users.
- Attempt logging still works (PR12+).
- No reteach content leaks to students.

---

## 5) Data/monitoring checks (fast)

### Database spot checks (optional)

- **Event** created:
  - `type: "MAKE_CLASSROOM_READY"`
  - `meta` includes: `topicKey`, `attachAdded`, `planStatus`, `planCached`, `markReviewed`

### Safety checks

- Confirm `/make-classroom-ready` **never** returns `plan.content` or `classroomNotes`.
- Confirm endpoint is **owner/admin only**.

---

## 6) Definition of Done for Phase Gate

You can move to the next phase when **all** are true:

- [ ] Backend PR20 tests pass with `DISABLE_OPENAI=1`
- [ ] Frontend builds cleanly
- [ ] Teacher can click **Make classroom-ready** and see:
  - practice attached
  - `plan.status` returned
  - readiness refreshed
- [ ] Publish modal gate works and doesn’t break “publish anyway”
- [ ] No content leakage

---

## Next Phase (recommended ordering)

### Phase 2.1 — Drive usage (attempt generation)

**PR20.1 (small):** After readiness becomes READY, show CTA:

- “Open Classroom mode” (links to `/classroom/:lessonId`)
- “Copy student link”

### Phase 2.2 — Reduce teacher workload further

**PR21:** “Auto-diagram depth defaults”

- If diagram exists and `tier=Higher` → auto set mode to step + template steps (no labels invented).
- Teacher just drags labels.

### Phase 2.3 — Close the loop in Needs Attention

**PR22:** Add “Make classroom-ready” button inside Needs Attention setup rows.

- Calls PR20 endpoint.
- Toast + refresh.
