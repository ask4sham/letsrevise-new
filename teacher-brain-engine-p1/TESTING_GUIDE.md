# TESTING_GUIDE.md — P0 + P1.0

> How to verify the integration is working after Cursor finishes.

---

## A. Automated backend tests

```bash
cd backend
python -m pytest tests/test_usage.py \
                 tests/test_pipeline.py \
                 tests/test_validator.py \
                 tests/test_visual_explanation.py -v
```

Expected:
```
tests/test_usage.py              ............  8 passed
tests/test_pipeline.py           ............  8 passed
tests/test_validator.py          ............ 18 passed
tests/test_visual_explanation.py ............  5 passed
================== 39 passed ==================
```

With JUnit for CI:
```bash
python -m pytest tests/ -v --junit-xml=test_reports/p0_p1_results.xml
```

### What each suite covers

| Suite | Coverage |
|---|---|
| `test_usage.py` | Auth gate (401), under/over daily/monthly limits (429), mark endpoint also gated, public reads still work. |
| `test_pipeline.py` | Valid save once, invalid→retry→save once, invalid×2→422 + 0 saves, budget exceeded→429 no LLM, timeout→503 no save, provider exception→503 no save, concurrent duplicate→409, lock released after failure. |
| `test_validator.py` | 18 schema rules for the 7-block lesson; safe error strings. |
| **`test_visual_explanation.py`** (P1.0) | Anon→401, bad-bearer→401, empty-topic→422, module importable, schema sanity. No LLM cost. |

---

## B. Manual browser smoke

Sign in as your real admin:

| # | Step | Expected |
|---|---|---|
| 1 | `/` | Landing renders, no white screen |
| 2 | `/login` with real admin creds | Redirected to `/`, email + usage chip visible |
| 3 | Generate a lesson | Navigates to `/lesson/{id}`, usage chip ticks up |
| 4 | `/library` | Lesson visible |
| 5 | Open any lesson | Lesson renders + **Visual explanation panel visible above blocks** |
| 6 | **Click "Visual explanation" → topic "The eye" → Generate** | ~30–60s wait, then: labelled diagram on left + 8 sections on right + `© letsrevise.com · GCSE diagram` footer + usage chip increments |
| 7 | `/__boom` | ErrorBoundary fallback, no stack |
| 8 | Sign out → try Generate (lesson) | Redirect to `/login?next=/` |
| 9 | Sign out → try Visual Explanation | Panel shows "Sign in to generate" gate |
| 10 | Force-bad-topic (e.g. `qqqq` lesson) | 422 banner, no `/lesson/undefined` |
| 11 | Double-click Visual Generate | Only ONE record, second click returns 409 |

---

## C. API smoke (curl)

```bash
export API=https://your-letsrevise-domain
```

| # | Command | Expected |
|---|---|---|
| 1 | `curl -s -o /dev/null -w "%{http_code}\n" -X POST $API/api/lessons/generate -H "Content-Type: application/json" -d '{"topic":"x"}'` | **401** |
| 2 | `curl -s -o /dev/null -w "%{http_code}\n" -X POST $API/api/visual-explanations/generate -H "Content-Type: application/json" -d '{"topic":"x"}'` | **401** |
| 3 | `curl -s -o /dev/null -w "%{http_code}\n" -X POST $API/api/visual-explanations/generate -H "Authorization: Bearer broken" -d '{"topic":"x"}'` | **401** |
| 4 | `curl -s -o /dev/null -w "%{http_code}\n" $API/api/lessons` | **200** |
| 5 | Login: `TOKEN=$(curl -s -X POST $API/api/auth/login -H "Content-Type: application/json" -d '{"email":"<admin>","password":"<pwd>"}' \| python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")` | non-empty |
| 6 | `curl -s $API/api/auth/me -H "Authorization: Bearer $TOKEN"` | **200** + user |
| 7 | `curl -s $API/api/auth/usage -H "Authorization: Bearer $TOKEN"` | **200** + counters |
| 8 | **Visual gen live**: `curl -s -X POST $API/api/visual-explanations/generate -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"topic":"Photosynthesis"}' --max-time 150 \| python3 -m json.tool \| head -25` | **200** + `image_data_url` + `explanation` + `provider_status:"image_generated"` |
| 9 | After call 8, usage chip increments by 1 | confirm via `/api/auth/usage` |

**Response body sanity** — none of the error envelopes should leak:
```bash
curl -s -X POST $API/api/visual-explanations/generate -H "Authorization: Bearer broken" -d '{"topic":"x"}' \
  | grep -E 'Traceback|/app/|/backend/|sk-emergent|sk-ant-|EMERGENT'
# expected: empty
```

---

## D. Status-code reference (P0 + P1.0)

| Code | Source |
|---|---|
| **200** | Public reads, login/me/usage, successful generate / mark / **visual-explanation** |
| **400** | Empty mark answer, malformed JSON |
| **401** | Missing/invalid Bearer on any protected route (incl. `/visual-explanations/generate`) |
| **404** | Lesson not found after auth gate |
| **409** | `GENERATION_ALREADY_IN_PROGRESS` — inflight lock holds |
| **422** | Validation failed twice (lessons) OR Pydantic validation failed (visual explanations) |
| **429** | `DAILY_LIMIT_EXCEEDED` or `MONTHLY_LIMIT_EXCEEDED` — applies to lessons + marks + visual explanations |
| **503** | `LLM_PROVIDER_UNAVAILABLE` or `LLM_TIMEOUT` — clean envelope, retryable:true |

---

## E. Secret scan

```bash
cd frontend
yarn build
grep -rE 'EMERGENT_LLM_KEY|JWT_SECRET|MONGO_URL|sk-emergent|sk-ant-|sk-proj-|mongodb://|mongodb\+srv://|AKIA[A-Z0-9]{16}' \
  build/static/js/
# expected: empty
```

```bash
grep -rE 'Nano Banana|Gemini' frontend/src/components/
# expected: only the system prompts in backend files, NOT in any user-facing copy
grep -rE 'Nano Banana|Gemini' frontend/build/static/js/
# expected: empty (no third-party attribution leaks to users)
```

---

## F. Render preview sanity checklist

Before merging `teacher-brain-p0-p1 → main`:

- [ ] `https://<preview>.onrender.com/` loads
- [ ] `/login` works with prod admin creds (not sandbox)
- [ ] Usage chip displays correctly
- [ ] `/library` lists lessons
- [ ] `/__boom` fallback (no stack leak)
- [ ] **Visual explanation panel generates a real image + 8 sections on at least 3 different topics**
- [ ] Watermark reads `© letsrevise.com · GCSE diagram`
- [ ] DevTools → Network → `/api/visual-explanations/generate` anon → `401`
- [ ] DevTools → Application → localStorage shows `tb.access_token` only when signed in
- [ ] No secrets / no "Nano Banana" / "Gemini" in `view-source:<preview>/static/js/<bundle>.js`
- [ ] All three `TEACHER_BRAIN_*` env flags read `0`
- [ ] Monitor Emergent dashboard for LLM budget headroom — P1.0 doubles per-action cost
