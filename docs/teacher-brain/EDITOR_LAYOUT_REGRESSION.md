# Edit Lesson — layout regression screenshots

Visual recovery point for the Edit Lesson page layout (outside **Lesson actions** rail, wide desktop width).

**Tag:** `editor-layout-stable-2026-06`  
**Branch:** `migration-audit-2026`

Use these when changing `EditLessonPage.tsx`, `App.css` edit-lesson rules, or editor grid breakpoints.

## Quick checklist

| Area | What to verify | Screenshot |
| --- | --- | --- |
| Full page | Outside action rail + framed editor + preview; no horizontal scroll | [editor-layout-full-page.png](./screenshots/editor-layout/editor-layout-full-page.png) |
| Lesson actions rail | Solid card left of editor frame; Save / Publish / Generate AI assets stacked | [editor-layout-lesson-actions-rail.png](./screenshots/editor-layout/editor-layout-lesson-actions-rail.png) |
| Teacher editor rail | Unchanged left sidebar: help, Pages, Readiness, Practice questions | [editor-layout-teacher-editor-rail.png](./screenshots/editor-layout/editor-layout-teacher-editor-rail.png) |
| Lesson details | Main center column (title, topic, blocks) visibly wide on ≥1400px | [editor-layout-lesson-details.png](./screenshots/editor-layout/editor-layout-lesson-details.png) |
| Preview rail | Preview column usable; not overlapped by actions or sidebars | [editor-layout-preview-rail.png](./screenshots/editor-layout/editor-layout-preview-rail.png) |

## Wide desktop (≥1400px)

- **Lesson actions** sit in `edit-lesson-outside-actions-rail` — **outside** the bordered editor frame, not inside the left sidebar.
- Editor column max-width: `min(1760px, calc(100vw - 24px))`.
- Left sidebar (240px) and preview (320px) widths unchanged; center column grows via `1fr`.

## Fallback (<1220px editor width)

- Original horizontal top action row (Back + Publish + Save + AI controls).
- No outside rail; no mobile bottom bar.

## Capture (manual or script)

1. Log in as teacher; open a Mongo lesson with pages/blocks (e.g. Metabolism).
2. Viewport **≥1600px** wide; confirm wide layout (3 columns + outside rail).
3. Save five captures into `docs/teacher-brain/screenshots/editor-layout/` using the filenames above.

Automated (requires logged-in session cookie):

```bash
# From repo root, with frontend on :3000 and EDIT_LESSON_URL set:
node scripts/editor-layout-regression-screenshot.mjs
```

Environment:

- `EDIT_LESSON_URL` — full edit-lesson URL (default: `http://localhost:3000/edit-lesson/6a1c7b28e2b056a760772243`)
- `EDIT_LESSON_AUTH_COOKIE` — optional `name=value` session cookie for auth

## Related

- [REGRESSION_SCREENSHOTS.md](./REGRESSION_SCREENSHOTS.md) — Teacher Brain design brief UI
- `frontend/src/App.css` — `.edit-lesson-page`, `.edit-lesson-outside-actions-rail`, `@media (min-width: 1400px)`

## Captured

- **Date:** 2026-06-02
- **Tag:** `editor-layout-stable-2026-06`
- **Context:** Outside Lesson actions rail; wide desktop editor column optimisation
