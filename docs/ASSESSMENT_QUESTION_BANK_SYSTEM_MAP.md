# Assessment / Question Bank — System Map (no feature changes)

**Goal:** Show the current end-to-end setup for Assessments/Question Bank filtering and linking. No fixes yet.

---

## System Map (Frontend → API → DB)

```
[Student/Teacher] → /assessments/papers (list)
                 → AssessmentPapersList.tsx
                 → GET /api/assessment-papers?kind=... (hardcoded localhost in list)
                 → AssessmentPaper.find(query).select(...).lean()

[Teacher]        → /assessments/papers/:id/edit
                 → AssessmentPaperEditPage.tsx
                 → GET /api/assessment-papers/:id (load paper)
                 → "Add from Question Bank" → openBankModal() → loadBankQuestions()
                 → GET /api/exam-questions (no query params)
                 → ExamQuestion.find(query).sort({ updatedAt: -1 }).lean()
                 → Filtering in modal: client-side only (query state, filter by question/topic/type text)
                 → "Add to paper" → PATCH /api/assessment-papers/:id/questions
                 → body: { addExamQuestionIds: [...], removeExamQuestionIds: [] }
                 → AssessmentPaper.questionBankIds updated

[DB]
  AssessmentPaper: items[] (AssessmentItem refs), questionBankIds[] (ExamQuestion refs)
  ExamQuestion: subject, examBoard, level, topic, topicKey, unitKey, type, question, options, marks, ...
  GET /assessment-papers/:id merges items + populated questionBankIds into single items array (source: "bank")
```

---

## 1) Frontend: Pages and components

| Route / feature | File | Key functions |
|-----------------|------|----------------|
| **Assessment Papers list** `/assessments/papers` | `frontend/src/pages/AssessmentPapersList.tsx` | `fetchPapers()` (useEffect), state: `papers`, `selectedMode`, `searchTerm` |
| **Assessment Paper edit** `/assessments/papers/:id/edit` | `frontend/src/pages/AssessmentPaperEditPage.tsx` | `loadBankQuestions()`, `openBankModal()`, `addToPaper()`, `removeBankQuestion()` |
| **"Add from Question Bank" modal** (inline in edit page) | Same file, inline JSX | Modal opens when `bankOpen === true`; list from `bankQuestions`; search is client-side `query` filter over `bankQuestions` |

**Route registration:** `frontend/src/App.tsx`

- `path="/assessments/papers"` → `<AssessmentPapersList />`
- `path="/assessments/papers/:id/edit"` → `<AssessmentPaperEditPage />` (ProtectedRoute requireTeacherOrAdmin)

There is no separate component file for the modal; it is implemented inside `AssessmentPaperEditPage.tsx` (lines ~271–423).

---

## 2) Frontend runtime: Request when opening the modal

**When the user clicks "Add from Question Bank":**

- `openBankModal()` runs: `setBankOpen(true)`, `setQuery("")`, `loadBankQuestions()`.

**Fetch code (excerpt):**

```ts
// AssessmentPaperEditPage.tsx
const loadBankQuestions = async () => {
  try {
    setBankLoading(true);
    const res = await api.get("/exam-questions");
    const raw = res.data?.questions ?? res.data?.data ?? res.data;
    const list = Array.isArray(raw) ? raw : [];
    setBankQuestions(list);
    setSelectedIds(new Set());
  } catch (err) {
    setBankQuestions([]);
  } finally {
    setBankLoading(false);
  }
};
```

- **URL:** `GET /api/exam-questions` (relative; in dev goes through CRA proxy to backend).
- **Method:** GET.
- **Query params:** **none.** No `subject`, `topic`, `topicKey`, `level`, `examBoard`, `type`, or `search` are sent.
- **Body:** none.

**Context available in the component at request time:**

- `paper` is in state (from `GET /api/assessment-papers/${paperId}`). So the edit page has:
  - `paper.title`
  - `paper.subject` (optional, from API)
  - `paper.items`, `paper.questionBankIds`
- **None of this context is passed to the exam-questions request.** The modal always loads the full bank (subject to backend default filters) and then filters only in the client by the user’s search string (`query`) over `question`, `topic`, and `type`.

**Where context could come from:** `paper.subject`, `paper.level`, `paper.examBoard` exist on the paper type and are returned by GET `/assessment-papers/:id`, but they are not used in `loadBankQuestions()`.

---

## 3) Backend: API routes used by the modal

**Route registration:**

- `backend/app.js`: `app.use("/api/assessment-papers", require("./routes/assessmentPapers"));`
- `backend/app.js`: `app.use("/api/exam-questions", require("./routes/examQuestions"));`

**GET /api/exam-questions** — `backend/routes/examQuestions.js`

- **Handler:** `router.get("/", auth, ...)` (lines 135–170).
- **Auth:** Teacher or admin only (403 for students).
- **Query params supported:**  
  `subject`, `examBoard`, `level`, `topic`, `topicKey`, `specKey`, `type`, `status`, `mineOnly`
- **Behaviour when no filters are provided:**  
  - `query.status` defaults to `{ $in: ["draft", "published"] }`.  
  - No pagination; no default limit.  
  - Sort: `{ updatedAt: -1 }`.  
  - Returns all matching questions (entire bank for teacher/admin when no filters).

**Other relevant route for “Add to paper”:**

- **PATCH /api/assessment-papers/:id/questions** — `backend/routes/assessmentPapers.js` (lines 640–707).  
  - Body: `addExamQuestionIds`, `removeExamQuestionIds` (arrays of ExamQuestion ObjectIds).  
  - Updates `AssessmentPaper.questionBankIds` only (no change to `items`).

---

## 4) Database / schema

**ExamQuestion** — `backend/models/ExamQuestion.js`

Curriculum/structure-related fields:

- `subject` (String, required)
- `examBoard` (String, trim, default null)
- `level` (String, trim, default null)
- `topic` (String, trim, default null, index)
- `topicKey` (String, trim, default null, index) — canonical topic from taxonomy
- `unitKey` (String, trim, default null, index)
- `type` (enum: mcq, short, label, table, data)
- `marks`, `question`, `options`, `correctIndex`, `correctAnswer`, `markScheme`, `status`, `teacherId`, etc.

Not present on schema: `subTopic`, `specificationCode`, `tags` (no such fields in ExamQuestion).

**AssessmentPaper** — `backend/models/AssessmentPaper.js`

- **items:** array of subdocuments `{ itemId (ObjectId ref AssessmentItem), order, marksOverride, notes }`.
- **questionBankIds:** array of ObjectIds ref `ExamQuestion` (default []).
- Curriculum-style fields on the paper: `subject`, `examBoard`, `level`, `tier`, `kind` (past_paper | mock_exam | practice_set).  
- No `topic`, `topicKey`, or `subTopic` on AssessmentPaper.

**Join/link:**

- Paper ↔ bank questions: **only** via `AssessmentPaper.questionBankIds` (array of ExamQuestion `_id`).
- No separate join table; no “from bank” flag on the paper itself beyond the presence of `questionBankIds`. Items returned by GET `/assessment-papers/:id` are merged: classic `items` (from AssessmentItem) plus questions resolved from `questionBankIds`, each with `source: "bank"`.

**AssessmentItem** — `backend/models/AssessmentItem.js`

- Used by `items[].itemId` for non-bank questions. Structure is separate from ExamQuestion (not listed in full here).

---

## 5) Linking mechanism: How questions are linked to a paper

- **Storage:**  
  - **AssessmentPaper** stores **question IDs** in `questionBankIds` (ObjectIds of ExamQuestion).  
  - It does **not** store embedded copies of questions; at read time, GET `/assessment-papers/:id` loads ExamQuestions by those IDs and merges them into the `items` array with `source: "bank"`.
- **“From bank” signal:**  
  - In the API response, each item coming from the bank has `source: "bank"`.  
  - Frontend type `PaperItem` includes `source?: "bank"` and the UI shows “From bank” and uses `item._id` for remove (which is the ExamQuestion `_id`).
- **Write endpoint when clicking “Add to paper”:**  
  - **PATCH /api/assessment-papers/:id/questions**  
  - **Payload:**  
    `{ addExamQuestionIds: string[], removeExamQuestionIds: string[] }`  
  - Example: `{ addExamQuestionIds: ["507f1f77bcf86cd799439011", ...], removeExamQuestionIds: [] }`.  
  - Backend replaces `questionBankIds` with the merged list (existing plus added, minus removed).

---

## 6) Evidence: Sample objects (sanitized)

**Sample ExamQuestion (as stored / returned by API):**

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "teacherId": "507f191e810c19729de860ea",
  "subject": "Biology",
  "examBoard": "AQA",
  "level": "GCSE",
  "topic": "Role of biotechnology",
  "topicKey": "aqa-gcse-biology:role-of-biotechnology",
  "type": "mcq",
  "marks": 1,
  "question": "How can biotechnology help food security?",
  "options": ["A", "B", "C", "D"],
  "correctIndex": 0,
  "status": "published",
  "createdAt": "2025-01-15T10:00:00.000Z",
  "updatedAt": "2025-01-15T10:00:00.000Z"
}
```

**Sample AssessmentPaper (with linked bank questions) after GET :id:**

- Stored: `questionBankIds: [ ObjectId("507f1f77bcf86cd799439011"), ... ]`
- Response `paper` (relevant parts):  
  `paper.items` includes entries like:

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "itemId": "507f1f77bcf86cd799439011",
  "title": "Role of biotechnology",
  "question": "How can biotechnology help food security?",
  "type": "mcq",
  "options": ["A", "B", "C", "D"],
  "marks": 1,
  "order": 1,
  "source": "bank"
}
```

So the paper holds only IDs; the “items” view is built by the GET handler from `questionBankIds` + ExamQuestion documents.

---

## What is missing for proper filtering (no implementation yet)

- **Modal request sends no curriculum context:**  
  GET `/exam-questions` is called with **no** query params. So the backend cannot filter by paper’s subject/level/examBoard/topic/topicKey.

- **Paper metadata not used when loading the bank:**  
  The edit page has `paper.subject`, `paper.level`, `paper.examBoard` (and could have more if the API added them), but `loadBankQuestions()` does not pass any of these to the API.

- **Filtering is client-side only:**  
  The modal filters the full list by a single search string over question text, topic, and type. So:
  - Large banks will load many questions and be slow.
  - No server-side filter by topicKey/subtopic/specification/tags even though the backend supports some of these.

- **Backend supports params that the frontend never sends:**  
  GET `/exam-questions` already accepts `subject`, `examBoard`, `level`, `topic`, `topicKey`, `type`, `status`, `mineOnly`. The modal never uses them.

- **AssessmentPaper has no topic/topicKey:**  
  So even if the frontend wanted to “filter bank by this paper’s topic”, the paper does not store a topic/topicKey—only subject, examBoard, level, tier. Any topic-scoping would require either adding topic/topicKey to the paper or deriving it elsewhere.

- **List page uses hardcoded URL:**  
  `AssessmentPapersList` uses `http://localhost:5000/api/assessment-papers?kind=...` instead of the shared `api` client, so it bypasses proxy/base URL and is inconsistent with the edit page.

- **Lesson ↔ assessment linking:**  
  Lesson editor “Assessments” and “Add from Question Bank” (in EditLessonPage) use a different flow (e.g. topicKey for lesson, POST `/lessons/:id/exam-questions`). Assessment **papers** are not linked to lessons in this map; papers only link to questions via `questionBankIds`.

---

## Lesson editor: Assessments accordion (data + UI)

**Where it is rendered:** `frontend/src/pages/EditLessonPage.tsx` (collapsible “Assessments” section, ~lines 5404–5479).

**Data source:** `lesson.assessment.questions` (derived in component as `assessmentQuestions = lesson?.assessment?.questions || []` at line 521). So the accordion reads/writes **Lesson.assessment** (embedded object with `timeSeconds` and `questions[]`), not AssessmentPaper.

**Schema (Lesson):** `backend/models/Lesson.js`  
- `assessment: { timeSeconds, questions: [{ id, type, question, options, correctAnswer, markScheme, explanation, tags, difficulty, marks }] }` (embedded).  
- `examQuestions: [{ questionId (ref ExamQuestion), addedAt }]` (attached exam question refs).  
- **No** `assessmentPaperIds` or link to AssessmentPaper; lesson is not wired to “papers”.

**UI actions in Assessments accordion:**  
- “Generate Assessment from Topic Bank” → `generateAssessmentFromTopic(id, topicKeyForBank)` (topic bank flow).  
- “Manage assessment bank →” link to `/teacher/topic-banks/quizzes?kind=assessment`.  
- **No “Add from Paper” or attach Assessment Paper**; the accordion is topic-bank–only (generate into `lesson.assessment.questions`).

So: **Lesson editor Assessments** = topic-bank assessment questions (embedded). **Assessment Papers** = separate feature (paper has `questionBankIds`); no UI in lesson editor to attach a paper to a lesson.

---

## Smallest change to fix “random list” + add pagination

**Goal:** Modal request includes subject/examBoard/level/topicKey from paper (or lesson) context, and backend supports pagination.

1. **Frontend (`AssessmentPaperEditPage.tsx`):**  
   In `loadBankQuestions()`, call `api.get("/exam-questions", { params: { subject: paper?.subject, examBoard: paper?.examBoard, level: paper?.level, topicKey: paper?.topicKey, page: 1, limit: 50 } })`.  
   Use `paper` from existing state (GET `/assessment-papers/:id` already returns these fields). If `topicKey` is missing on paper, optional: show a Topic dropdown in the modal (same taxonomy source as Topic Bank) and send selected topicKey.

2. **Backend (`backend/routes/examQuestions.js`):**  
   Add `page` and `limit` to GET `/` handler; default e.g. `limit=50`, `skip = (page-1)*limit`; return `{ questions, pagination: { page, limit, total } }`.

3. **Modal UI:**  
   Either “Load more” or next/prev page buttons using the same endpoint with `page`/`limit`.

**Result:** Modal shows questions filtered by paper’s curriculum; no schema migration. Phase 2 can add `topicKey` to AssessmentPaper and require it on create/edit; Phase 3 can add `lesson.assessmentPaperIds` and attach/detach UI.

---

*Document generated to describe current setup only. No behaviour or feature changes.*
