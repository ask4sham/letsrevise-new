# Current Task

## Active Goal
Stabilize legacy lesson image handling without breaking the current working upload flow.

## Current Status
- **Migration:** Script audited, hardened, and executed. DB verified clean (0 legacy URLs).
- **Rendering:** Main views (LessonViewPage, EditLessonPage) use `preprocessMarkdownAssetUrls` and `makeAbsoluteAssetUrl`.
- **Upload flow:** Working via Netlify proxy; frontend stores absolute URLs.
- **Verification report:** `docs/ai/verification-report.md`

## Current Priorities
1. ~~Ensure legacy image migration script works correctly in apply mode.~~ ✅ Done
2. ~~Keep current production upload flow stable.~~ ✅ Verified
3. ~~Verify old lessons render images without manual re-upload where possible.~~ ✅ DB clean; rendering logic correct
4. Optional: Add `preprocessMarkdownAssetUrls` to ClassroomModePage, EnhancedLessonView, etc. (low priority)

## Known Constraints
- Production must stay stable.
- Migrations must be safe, dry-run capable, and idempotent.
- Do not regress Netlify → proxy → Render upload flow.

## Next Steps
- None required for migration/verification.
- Optional hardening: add `preprocessMarkdownAssetUrls` to secondary markdown renderers (ClassroomModePage, EnhancedLessonView, LessonAttemptReportPage, DocsViewerPage) when touching those files.
