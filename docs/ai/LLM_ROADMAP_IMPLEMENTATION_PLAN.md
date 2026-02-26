# LLM Roadmap Implementation Plan (LetsRevise)

Saved plan for completing the strategic LLM features. Each step is implemented with inbuilt testing and consolidated before moving to the next.

---

## Principles

- **Human-in-the-loop** for content (like existing `generate-lesson`).
- **Ground answers in your content** (RAG, explain-this, explain-mistake).
- **Reuse existing patterns**: `OPENAI_API_KEY`, auth, lesson/quiz/attempt models, React + API.

---

## Implementation Order

| Step | Feature | Scope |
|------|--------|--------|
| **1** | **Explain this** (per paragraph/block) | Backend: `POST /api/ai/explain-chunk`. Frontend: "Explain this" on block in lesson view. |
| **2** | **Explain my mistake** (wrong answer → misconception) | Backend: `POST /api/ai/explain-mistake`. Frontend: button on wrong-answer review. |
| **3** | **Quiz me** (on-the-fly LLM-generated quiz) | Backend: `POST /api/ai/generate-practice-quiz` + optional score endpoint. Frontend: Quick quiz flow. |
| **4** | **RAG** (Q&A on your content) | Index pipeline, vector store (Mongo or service), `POST /api/ai/ask`, "Ask about this lesson" UI. |
| **5** | **Summarise / key points** | `POST /api/ai/summarise` for lesson/topic; "Summarise" button. |
| **6** | **Knowledge gap** (per-student weak areas) | `GET /api/student/knowledge-gap`, aggregate attempts, LLM summary; "Your revision focus" UI. |
| **7** | **Structure my notes** (user input → flashcards/summary) | `POST /api/ai/structure-notes`, "Create your own notes" UI. |

---

## Per-step process

1. Implement backend route(s) and validation.
2. Add unit/integration tests (inbuilt testing).
3. Implement frontend (or minimal hook).
4. Consolidate (run tests, quick manual check); then move on.

---

## Status

- [x] Step 1: Explain this — `POST /api/ai/explain-chunk`, `tests/aiExplainChunk.integration.test.js`, `frontend/src/api/ai.ts`, `ExplainThisButton.tsx`
- [x] Step 2: Explain my mistake — `POST /api/ai/explain-mistake`, `tests/aiExplainMistake.integration.test.js`, `frontend/src/api/ai.ts` `explainMistake()`, `ExplainMyMistakeButton.tsx`; wired into `AssessmentPaperResultsPage` and `QuizView` for wrong-answer review
- [x] Step 3: Quiz me (LLM) — `POST /api/ai/generate-practice-quiz`, `tests/aiGeneratePracticeQuiz.integration.test.js`, `frontend/src/api/ai.ts` `generatePracticeQuiz()`, `QuickQuizPage.tsx` at `/student/quick-quiz`; link from StudentDashboard
- [x] Step 4: RAG — Index pipeline (extract chunks from lesson pages + legacy content); `LessonRAGChunk` model with embeddings (OpenAI text-embedding-3-small); `POST /api/ai/ask` (auth + requireLessonAccess); `tests/aiAskRAG.integration.test.js`; `frontend/src/api/ai.ts` `askRAG()`, `AskAboutLesson.tsx` in LessonViewPage ("Ask about this lesson")
- [x] Step 5: Summarise — `POST /api/ai/summarise` (auth + requireLessonAccess), `tests/aiSummarise.integration.test.js`, `frontend/src/api/ai.ts` `summariseLesson()`, `SummariseLesson.tsx` ("Summarise this lesson" button) on LessonViewPage
- [x] Step 6: Knowledge gap — `GET /api/student/knowledge-gap` (student only), aggregate PracticeAttempt + QuizAttempt by topic, weak areas (below 70%), LLM revision focus summary; `tests/studentKnowledgeGap.integration.test.js`; `frontend/src/api/studentKnowledgeGap.ts`, "Your revision focus" block on StudentDashboard
- [ ] Step 7: Structure my notes

---

*Last updated: implementation in progress.*
