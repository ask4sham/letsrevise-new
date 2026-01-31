# LetsRevise – Parent Analytics (Phase 2)

This document defines **Phase-2 parent analytics**.
It expands beyond Phase-1 “signals” while remaining **parent-safe** (no raw marks unless explicitly allowed).

---

## Goals

- Give parents clarity on **consistency, engagement, and trends**
- Avoid raw scores, timings pressure, or curriculum micromanagement
- Keep data **aggregated, explainable, and non-judgmental**

---

## Core principles (non-negotiable)

- Parent views show **signals**, not exam marks
- Use bands, trends, and summaries
- No per-question or per-quiz raw percentages by default
- All APIs are **parent-scoped** and role-protected

---

## Metrics (parent-safe)

### Consistency
- Sessions per week (banded)
- Current streak (days)
- Learning minutes (banded: 0–15, 15–30, 30–60, 60+)

### Trends
- Improving / Steady / Needs attention (per subject)
- Based on rolling window comparisons

### Coverage
- Topics engaged (count)
- Subjects active this week/month

### Recency
- Last active date
- Days since last activity (banded)

### Confidence proxy (no scores)
- Quiz completion rate (banded)
- Retry behavior (attempted again vs abandoned)

---

## API endpoints (parent-scoped)

> All routes live under `/api/parent` and require parent auth.

### Child summary
