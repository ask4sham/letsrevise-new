# Phase 8 — Final Output: Taxonomy 4-Level Hierarchy

## 1. Files Changed

| File | Change |
|------|--------|
| `backend/models/AdminTaxonomyItem.js` | Extended schema with `section` type, `parentUnitKey`, `title`, `slug`, `parentId` |
| `backend/models/AdminTopicPlacement.js` | **New** — Placement override for static topics (specKey, topicSlug, sectionId) |
| `backend/services/adminTaxonomyService.js` | Merge logic for 4-level hierarchy (sections, placements) |
| `backend/routes/adminTaxonomy.js` | POST /section, POST /topic-placement, updated move to support targetSectionId |
| `backend/services/taxonomyService.js` | getCreateLessonOptionsMerged: section in path (Main > Section > Topic) |
| `frontend/src/pages/AdminTaxonomyPage.tsx` | Tree editor with sections, Add Section, Move to Section modals |
| `frontend/src/api/adminTaxonomy.ts` | (existing) — API helpers for taxonomy CRUD |
| `docs/TAXONOMY_4LEVEL_DESIGN.md` | Design document |

## 2. Schema: Extended vs Replaced

**Extended.** The existing `AdminTaxonomyItem` schema was extended:

- **`type`**: enum now includes `"section"` (was `"unit" | "subTopic"`)
- **`parentUnitKey`**: Added for sections to reference static units (no DB _id)
- **`parentId`**: Added (ObjectId ref) for section→unit and subTopic→section placement
- **`title`, `slug`**: Used for section display

**New model**: `AdminTopicPlacement` — stores which static topic (by topicSlug) is placed under which section.

## 3. Supported Node Types

| Type | Role | Children |
|------|------|----------|
| `unit` | Main Topic (heading) | sections, direct topics |
| `section` | Section (heading) | topics only |
| `subTopic` | Topic (leaf) | none — content-linked |

## 4. Supported Actions

| Action | Route | Notes |
|--------|-------|------|
| Add Main Topic | POST /admin/taxonomy/unit | |
| Add Section | POST /admin/taxonomy/section | parentUnitKey, title |
| Add Topic | POST /admin/taxonomy/subtopic | unitKey, subTopicTitle |
| Edit Main Topic | PATCH /admin/taxonomy/main-topic/:id | |
| Edit Sub-topic | PATCH /admin/taxonomy/sub-topic/:id | |
| Delete Main Topic | DELETE /admin/taxonomy/main-topic/:id | Blocked if children or linked content |
| Delete Sub-topic | DELETE /admin/taxonomy/sub-topic/:id | Blocked if linked content |
| Move Topic to Section | POST /admin/taxonomy/topic-placement | specKey, topicSlug, sectionId |
| Move Sub-topic (admin) | POST /admin/taxonomy/sub-topic/:id/move | targetSectionId or targetMainTopicId |

## 5. Safety Rules Implemented

- **Block delete** main topic if it has sub-topics or linked content (409 + linkedCounts)
- **Block delete** sub-topic if it has linked content (lessons, flashcards, quizzes, exam questions)
- **Block delete** section if it has topics (would need route; currently sections can be left empty)
- **Block invalid moves**: Topic and section must belong to same main topic (validated in topic-placement)
- **Preserve topic identity**: topicKey (`specKey:slug`) unchanged; only placement changes

## 6. Topic Identity / Content Links Preserved

- **topicKey** format unchanged: `specKey:slug` (e.g. `aqa-gcse-biology:chromosomes`)
- Lessons, Flashcards, Quizzes, ExamQuestions all use `topicKey` — no migration needed
- Content graph resolves by topicKey only
- Moving a topic under a section only updates placement (AdminTopicPlacement or subTopic.parentId); topicKey stays the same

## 7. How to Test the Cell Division Case

1. **Start backend**: `cd backend && npm start`
2. **Start frontend**: `cd frontend && npm run dev`
3. **Log in as admin** and go to Admin → Curriculum / Taxonomy
4. **Navigate** to Biology → AQA GCSE Biology → Cell Biology
5. **Create Section**: Click "+ Section", enter "Cell Division", Submit
6. **Move topics**: For each of Chromosomes, Mitosis and the cell cycle, Stem cells:
   - Click "Move"
   - Select "Cell Division" from the destination dropdown
   - Submit
7. **Verify** final structure:
   ```
   Cell Biology
     § Cell Division
       → Chromosomes
       → Mitosis and the cell cycle
       → Stem cells
     → Cell structure
     → Animal and plant cells
     → ...
   ```

**API-only test** (curl or Postman):

```bash
# 1. Create Section (requires admin auth cookie/token)
POST /api/admin/taxonomy/section
{"specKey":"aqa-gcse-biology","parentUnitKey":"cell-biology","title":"Cell Division"}

# 2. Move topics (use sectionId from step 1 response)
POST /api/admin/taxonomy/topic-placement
{"specKey":"aqa-gcse-biology","topicSlug":"chromosomes","sectionId":"<section._id>"}
POST /api/admin/taxonomy/topic-placement
{"specKey":"aqa-gcse-biology","topicSlug":"mitosis-cell-cycle","sectionId":"<section._id>"}
POST /api/admin/taxonomy/topic-placement
{"specKey":"aqa-gcse-biology","topicSlug":"stem-cells","sectionId":"<section._id>"}
```

## Known Issues / Follow-ups

- **Duplicate modals**: `AdminTaxonomyPage.tsx` has multiple copies of Add Section and Move to Section modals; one of each is sufficient — remove duplicates for cleaner code.
- **Section Edit/Delete**: No PATCH/DELETE for sections yet; add if needed.
- **Promote/Demote**: Not implemented; Move covers the main use case.
