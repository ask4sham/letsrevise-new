# Teacher Brain — P0 Hardening + P1.0 Visual Explanation — Combined Copy-Back Pack

> **This supersedes `teacher-brain-engine-p0/`.** It bundles every hardened P0 file PLUS the new P1.0 GCSE Visual Explanation feature into one merge-able artifact for your real `letsrevise-new` repo.

---

## What's in this pack vs the old `p0` pack

| Layer | p0 pack | **p1 pack (this one)** |
|---|---|---|
| P0.1 JWT Auth | ✅ | ✅ |
| P0.2 Per-user LLM Budget Cap | ✅ | ✅ |
| P0.3 Schema Validation + 1 Auto-Retry | ✅ | ✅ |
| P0.4 Root React Error Boundary | ✅ | ✅ |
| P0.5 LLM Failure + Idempotency | ✅ | ✅ |
| **P1.0 Visual Explanation (Nano Banana + 8-section examiner explanation)** | ❌ | ✅ |
| Portable tests (no `/app/...` paths) | ✅ | ✅ |
| Login.jsx dev defaults stripped | ✅ | ✅ |

If you've already integrated the p0 pack, you only need the P1.0 delta — see `MERGE_PLAN.md` §C (P1.0-only files). If you haven't integrated yet, just apply this whole pack and skip the p0 pack entirely.

---

## P1.0 — what it does

A GCSE student opening any lesson sees a new **Visual explanation** panel between the lesson header and the lesson blocks. Click it open, type a topic (e.g. *"The eye"*, *"Photosynthesis"*, *"Reflex arc"*), click **Generate visual**.

Two-stage backend:
1. **Claude Sonnet 4.5** (existing infra) produces a structured 8-section examiner-grade explanation + a tight image prompt.
2. **Gemini Nano Banana** (`gemini-3.1-flash-image-preview`) produces a clean labelled GCSE-style diagram from that prompt.

The user sees:
- The labelled diagram on the left
- 8 sections on the right: *What the image shows · Key parts labelled · Step-by-step · Why it matters for GCSE · Common mistake · Exam tip · Exam question · Model answer*

All produced live in ~30–60 seconds via the existing `EMERGENT_LLM_KEY` — **no new API keys, no new env vars required**.

### Hardening day-one
- 401 anon · auth-gated
- 429 budget — counts toward the **same** daily/monthly cap as `/lessons/generate`
- 422 on invalid input (Pydantic)
- 503 on LLM/provider failure (clean envelope, no stack/prompt leak)
- 120-sec outer timeout
- Image step is **best-effort** — if it fails, the explanation is still returned with a `"image_provider_unavailable"` fallback
- Watermark: **© letsrevise.com · GCSE diagram** (no third-party model attribution shown to users)

---

## What's NOT in this pack

| Item | Why |
|---|---|
| `.env` files | Real secrets go in your Render dashboard, never in Git |
| Lock files | Regenerate locally |
| Misconception Heatmap | Deferred — P1.1 |
| Stripe | Deferred — P1.2 |
| SSE streaming | Deferred |
| Multi-subject switching | Deferred |
| Per-block "Visualise this block" buttons | Deferred — current P1.0 is single sticky panel |
| Save/attach visual to lesson | Deferred (backend route accepts `block_key`; save-UI not built yet) |

---

## File map

```
teacher-brain-engine-p1/
├── README.md                          ← this file
├── MERGE_PLAN.md                      ← file-by-file source-side merge plan (P0 + P1.0)
├── COPY_BACK_CHECKLIST.md             ← step-by-step checklist for Cursor
├── ENV_REQUIRED.md                    ← env vars (unchanged from p0 pack)
├── SECURITY_NOTES.md                  ← threat model + rotation rules
├── TESTING_GUIDE.md                   ← P0 + P1.0 test commands
├── secrets_scan.txt                   ← clean scan
│
├── files/
│   ├── backend/
│   │   ├── server.py                       (P0 hardened + P1.0 visual route)
│   │   ├── auth.py                         (P0)
│   │   ├── usage.py                        (P0)
│   │   ├── idempotency.py                  (P0)
│   │   ├── lesson_pipeline.py              (P0)
│   │   ├── lesson_validator.py             (P0)
│   │   ├── lesson_engine.py                (existing)
│   │   ├── lesson_generator.py             (existing)
│   │   ├── visual_explanation.py           ← NEW P1.0
│   │   ├── requirements.txt
│   │   └── tests/
│   │       ├── test_usage.py
│   │       ├── test_pipeline.py
│   │       ├── test_validator.py
│   │       └── test_visual_explanation.py   ← NEW P1.0
│   │
│   └── frontend/src/
│       ├── App.js                              (P0 ErrorBoundary wrap)
│       ├── components/
│       │   ├── ErrorBoundary.jsx               (P0)
│       │   ├── ProtectedRoute.jsx              (P0)
│       │   └── VisualExplanationPanel.jsx      ← NEW P1.0
│       ├── contexts/AuthContext.jsx            (P0)
│       ├── lib/api.js                          (P0 + P1.0 generateVisualExplanation())
│       └── pages/
│           ├── Login.jsx                       (defaults stripped)
│           ├── Landing.jsx                     (lesson?.id guard)
│           └── LessonView.jsx                  ← MODIFIED P1.0 (mounts panel)
│
└── test_reports/
    ├── iteration_2.json
    └── p06_revalidation_report.md
```

---

## How to use this pack

See `COPY_BACK_CHECKLIST.md`. TL;DR:

1. Drop this folder at the root of `letsrevise-new/`.
2. In Cursor, run the integration prompt referencing this pack.
3. Cursor merges P0 + P1.0 in one branch, runs tests, secret scan, commits, tags.
4. You review the SECTION 1–9 report before approving the PR to `main`.

No new env vars vs the p0 pack — P1.0 reuses `EMERGENT_LLM_KEY`.
