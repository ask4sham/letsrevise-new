# Golden Regression Paths (Phase 4A)

Automated coverage for core teacher and student journeys.  
Run via root: `npm run test:golden`

## Student journeys

| Path | Automated coverage | Notes |
|------|-------------------|--------|
| Lesson loads | `LessonViewPage.practiceMarking` (+ smoke) | Full integration blocked by Jest ESM (TD-04) |
| MCQ selection | `ExamQuestionBlock`, `QuizView`, `AnswerFeedbackPanel` | |
| Short-answer typing | `ExamQuestionBlock` | |
| Composite exam | `ExamQuestionBlock` composite suite | |
| Table questions | `ExamQuestionBlock.table*`, `TableRenderer`, registry | Flag ON/OFF covered |
| Reveal gating | `ExamQuestionBlock` reveal tests | Student-only; editor/classroom unchanged |
| Practice questions | `LessonViewPage.practiceMarking`, `revisionPracticeVariants` | |
| Quiz | `QuizView.test` | |
| Flashcards | Smoke / manual until dedicated unit exists | Expand later |

## Teacher journeys

| Path | Automated coverage | Notes |
|------|-------------------|--------|
| Create / edit / save | Backend taxonomy create-lesson options; smoke editor load | Full E2E needs auth |
| Publish | Manual / existing integration where present | Do not auto-publish in CI |
| Generate AI assets | Backend taxonomy gates; smoke button presence when logged in | Requires mapped topic |
| Flashcards / quizzes / exam drafts | Smoke + existing bank tests | Expand carefully |

## Backend companions (golden)

- `compositeExamQuestion.table.unit.test.js`
- `normalizeLessonTopicKey.unit.test.js`
- `resolveLessonTopicKeyForAttach.unit.test.js`
- `taxonomy.createLessonOptions.test.js`
- `taxonomy.edexcelIgcseBiology.integration.test.js`

## Release rule

No commit reaches `main` unless:

1. Builds successfully  
2. Relevant unit tests pass (`test:golden`)  
3. Production build validation passes when shipping frontend (`validate:production-build`)  
4. Browser smoke passes when a server is available (`test:smoke`)  
5. No unrelated WIP files included  
6. Reviewed against `production-table-parts-enabled-v1` (or newer production tag)
