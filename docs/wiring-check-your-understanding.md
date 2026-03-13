# Wiring report: "Check your understanding" questions

End-to-end trace from Teacher Quiz Editor → Backend → API → Student Lesson View → QuizView.

---

## A) Backend storage

- **Model file:** `backend/models/Lesson.js`
- **Field path:** `Lesson.quiz.questions[]`
- **Schema (per question):**
  - `id` (String, required)
  - `type` (String, enum: `"mcq"` | `"short"` | `"exam"`, required)
  - `question` (String, required)
  - `options` (Array of String, default undefined) — **MCQ only**
  - `correctAnswer` (String, default "")
  - `markScheme` ([String]) — exam only
  - `explanation`, `tags`, `difficulty`, `marks`

**Example stored MCQ (canonical shape):**
```json
{
  "id": "q_123",
  "type": "mcq",
  "question": "What is a eukaryotic cell?",
  "options": ["A cell without a nucleus", "A cell with a nucleus", "A bacterial cell", "A virus"],
  "correctAnswer": "A cell with a nucleus",
  "explanation": "",
  "tags": [],
  "difficulty": 1,
  "marks": 1
}
```

**Confirmed:** Teacher editor writes into **Lesson.quiz.questions** (lesson-scoped), not the topic question bank. Topic banks power Practice / analytics; "Check your understanding" uses **lesson quiz only**.

---

## B) Backend API

- **Endpoint used by student lesson page:** `GET /api/lessons/:id`
- **Route/controller:** `backend/routes/lessons.js` (GET `/:id` with `applyLessonAccess`)
- **Response:**
  - **FREE_PREVIEW:** `toLessonPreviewPayload(lesson)` — **quiz is deleted** (no quiz in preview).
  - **SUB_ACTIVE / PURCHASED / ADMIN / OWNER:** `toLessonFullPayload(lesson)` — full lesson including `quiz` (and thus `quiz.questions[]` with `options`).

Payload helper: `backend/utils/lessonPayload.js` — `toLessonFullPayload` spreads `...lesson`, so `lesson.quiz` and `lesson.quiz.questions[].options` are returned as stored.

**Saving quiz (teacher):** `POST /api/lessons/:id/revision` with body `{ quiz: { timeSeconds, questions } }`. Validated by `backend/services/validateRevision.js` → `validateQuiz()`. For MCQ, `options` are taken from `q.options` (array of strings) or defaulted to `["Option A", "Option B", "Option C", "Option D"]` if missing.

---

## C) Frontend fetch

- **Where lesson is fetched:** `frontend/src/pages/LessonViewPage.tsx` → `fetchLessonFromBackend()` → `fetchLessonById(lessonId)` from `frontend/src/api/lessons.ts`.
- **API:** Raw `fetch` to `GET /api/lessons/:id`; response JSON is used as `data`; `setLesson(data)` (or equivalent) stores the full lesson.
- **Property path for quiz questions:** `lesson.quiz.questions` (see `quizQuestions` useMemo: `lesson.quiz?.questions`).
- **Not used:** `lesson.quizQuestions` (does not exist); "Check your understanding" does **not** read from topic question bank or practice API.

**To confirm payload in dev:** Use the temporary debug panel (visible when `REACT_APP_DEV_TOOLS=1`) that prints the first raw quiz question object on the lesson page.

---

## D) Frontend normalisation

- **Where mapping happens:** `frontend/src/pages/LessonViewPage.tsx` — function `normalizeQuizQuestion(raw, index)`.
- **Input:** One element of `lesson.quiz.questions` (raw).
- **Output:** QuizView shape: `{ id, type, question, options, correctAnswer, explanation?, tags?, difficulty?, marks?, markScheme? }`.
- **MCQ options:** Built from:
  - `raw.options` or `raw.choices` (array), or
  - `raw.option1` … `raw.option4` / `raw.Option1` … `raw.Option4` (separate fields).
- **Type:** `mcq` if type string includes "mcq"/"multiple" or `opts.length >= 2`; else short/exam from explicit type.
- **Used in:** Both "Check your understanding" sections (structured + legacy): `questions={(quizQuestions ?? []).map((raw, idx) => normalizeQuizQuestion(raw, idx))}`.

Backend stores **options** as `[String]`; teacher editor sends **options**; normaliser reads **options** (and fallbacks). If the API returns `quiz.questions[].options` correctly, normaliser output will have `options` populated.

---

## E) QuizView render rules

- **File:** `frontend/src/components/revision/QuizView.tsx`
- **Label:** `q.type === "mcq" ? "Multiple choice" : q.type === "short" ? "Short answer" : "Exam-style"`.
- **MCQ:** Renders `(q.options || []).map(...)` as option buttons. If `q.type === "mcq"` and `(!q.options || q.options.length === 0)`, shows warning: "This multiple-choice question is missing options. Please ask your teacher to edit it."
- **Short / exam:** Renders a single textarea; value from `answers[q.id]`; "Check answer" disabled for short until answer is non-empty.

---

## Summary

| Pipeline        | Source                    | Used by                    |
|----------------|---------------------------|----------------------------|
| Lesson quiz    | `Lesson.quiz.questions`   | "Check your understanding" |
| Topic banks    | Topic-scoped question sets| Practice, analytics        |

**Preview behaviour:** `toLessonPreviewPayload()` removes `quiz`, so in FREE_PREVIEW the student gets no quiz. The frontend shows "Quiz available after unlocking the full lesson." in the "Check your understanding" section when in preview, and does not attempt to render QuizView. Unlocked lessons receive full payload including `lesson.quiz.questions` and render normally.

**If MCQ options are missing on the student page:** Either (1) backend is not returning `quiz.questions[].options` (e.g. old data or different save path), or (2) frontend is not reading the same lesson object. Use the dev debug panel to inspect the first raw quiz question and confirm the presence and shape of `options` (or `choices` / `option1`–`option4`). The normaliser in `frontend/src/utils/normalizeQuizQuestion.ts` supports string[], {text}[], {value}[], [{label,text}], and object maps; never labels a question "Multiple choice" unless options exist (downgrades to short).
