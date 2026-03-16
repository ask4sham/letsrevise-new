# Taxonomy 4-Level Hierarchy — Design & Implementation

## Phase 1: Current System Inspection

### Schema (AdminTaxonomyItem)
- **Types**: `unit` (main topic), `subTopic` (leaf topic)
- **Fields**: specKey, type, unit, unitKey, topic, key, topicKey, tier, requiredPractical, sortOrder
- **Links**: subTopic links to unit via `unitKey`
- **Identity**: topicKey = `specKey:slug` — canonical for content links

### Static Config (JSON)
- **Structure**: `units[]` → each has `topics[]` (flat)
- **No section level** — Cell Division is a topic (key: cell-division) alongside Chromosomes, Mitosis, Stem cells
- **Read-only** — changes only via admin

### Content / topicKey Assumptions
- **Lessons, Flashcards, Quizzes, ExamQuestions**: all use `topicKey` (specKey:slug)
- **Content Graph**: resolves by topicKey only; no awareness of unit/section
- **create-lesson-options**: flattens to Main Topic → Sub-topics; path = "MainTopic > SubTopic"

### Compatibility Rule
- **topicKey must stay stable** — only Topic (leaf) nodes have topicKey
- Main Topic and Section = headings only; no content links
- Content links (lessons, etc.) are unaffected by hierarchy changes

---

## Phase 2: Target Data Model

### Extended AdminTaxonomyItem
| Field | unit | section | subTopic |
|-------|------|---------|----------|
| type | "unit" | "section" | "subTopic" |
| parentId | null | unit._id | unit._id or section._id |
| unit/unitKey | self | — | for legacy compat |
| topic/key/topicKey | — | — | leaf content identity |
| title/slug | unit, unitKey | title, slug | topic, key |

**New fields**: `parentId` (ObjectId ref), `title` (for section), `slug` (for section)

**Backward compat**: Existing subTopics keep unitKey; parentId optional. When parentId set, it overrides for placement.

---

## Phase 3–7: Implementation Summary

1. **Schema**: Add `section` type, `parentId`, `title` (section display)
2. **Merge logic**: Build tree with sections; place topics under unit or section via parentId
3. **Admin routes**: Add Section, Move (reparent), Promote/Demote
4. **UI**: Tree with Add Section, Move under valid parents
5. **create-lesson-options**: Flatten to Main Topic > [Section >] Topic for picker
6. **Safety**: Block delete with children or linked content; block invalid moves

---

## Cell Division Acceptance Case

**Before** (static):
```
Cell Biology
  → Cell Division (topic - wrong!)
  → Chromosomes
  → Mitosis and the cell cycle
  → Stem cells
  → ...
```

**After** (admin restructure):
```
Cell Biology
  → Cell Division (section - heading)
      → Chromosomes
      → Mitosis and the cell cycle
      → Stem cells
  → Cell structure
  → ...
```

Topic keys (aqa-gcse-biology:chromosomes, etc.) unchanged. Content links preserved.
