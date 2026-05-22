import React, { useMemo, useState } from "react";
import FlashcardsView from "../../revision/FlashcardsView";
import { QuizView } from "../../revision/QuizView";
import { deriveLessonRetrieval } from "../../../utils/deriveLessonRetrieval";
import { normalizeQuizQuestion } from "../../../utils/normalizeQuizQuestion";
import {
  collectCheckpointMcqsFromPages,
  filterQuizRecordsNotMatchingCheckpoints,
  type CheckpointMcqSource,
} from "../../../utils/revisionPracticeVariants";
import { isNearDuplicateStem } from "../../../utils/questionStemSimilarity";
import "./studentRetrievalSection.css";

type Props = {
  pages: Array<{ blocks?: unknown[] }>;
  storedFlashcards: Array<Record<string, unknown>>;
  storedQuizQuestions: Array<Record<string, unknown>>;
  hasFullAccess: boolean;
  onQuestionAnswered?: (correct: boolean) => void;
};

function mergeFlashcards(
  stored: Array<Record<string, unknown>>,
  derived: ReturnType<typeof deriveLessonRetrieval>["flashcards"]
) {
  const out: Array<{ id: string; front: string; back: string; tags?: string[] }> = [];
  const seen = new Set<string>();
  for (const raw of stored) {
    const front = String(raw.front ?? raw.question ?? "").trim();
    const back = String(raw.back ?? raw.answer ?? "").trim();
    if (!front || !back) continue;
    const key = front.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: String(raw.id ?? raw._id ?? `fc-${out.length}`),
      front,
      back,
      tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : undefined,
    });
  }
  for (const d of derived) {
    const key = d.front.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out.slice(0, 5);
}

function mergeQuiz(
  stored: Array<Record<string, unknown>>,
  derived: ReturnType<typeof deriveLessonRetrieval>["quizQuestions"],
  checkpoints: CheckpointMcqSource[]
) {
  const filteredStored = filterQuizRecordsNotMatchingCheckpoints(stored, checkpoints);
  const out: Array<Record<string, unknown>> = [...filteredStored];
  const seen = new Set(
    filteredStored.map(
      (q) => `${String(q.question ?? q.prompt ?? "")}|${String(q.correctAnswer ?? q.answer ?? "")}`
    )
  );
  for (const d of derived) {
    const key = `${d.question}|${d.correctAnswer}`;
    if (seen.has(key)) continue;
    if (checkpoints.some((cp) => isNearDuplicateStem(d.question, cp.prompt))) continue;
    seen.add(key);
    out.push(d);
  }
  return out.slice(0, 5);
}

/**
 * End-of-lesson retrieval: quiz, flashcards, and short exam practice — auto-filled from lesson blocks when needed.
 */
export function StudentRetrievalSection({
  pages,
  storedFlashcards,
  storedQuizQuestions,
  hasFullAccess,
  onQuestionAnswered,
}: Props): React.ReactElement | null {
  const derived = useMemo(() => deriveLessonRetrieval(pages), [pages]);
  const checkpointSources = useMemo(() => collectCheckpointMcqsFromPages(pages), [pages]);
  const flashcards = useMemo(
    () => mergeFlashcards(storedFlashcards, derived.flashcards),
    [storedFlashcards, derived.flashcards]
  );
  const quizRaw = useMemo(
    () => mergeQuiz(storedQuizQuestions, derived.quizQuestions, checkpointSources),
    [storedQuizQuestions, derived.quizQuestions, checkpointSources]
  );
  const quizQuestions = useMemo(
    () => quizRaw.map((q, i) => normalizeQuizQuestion(q, i)),
    [quizRaw]
  );
  const examQuestions = derived.examQuestions;

  const hasQuiz = quizQuestions.length > 0;
  const hasCards = flashcards.length > 0;
  const hasExam = examQuestions.length > 0;

  const [tab, setTab] = useState<"quiz" | "cards" | "exam">("quiz");

  const activeTab: "quiz" | "cards" | "exam" =
    tab === "quiz" && hasQuiz
      ? "quiz"
      : tab === "cards" && hasCards
        ? "cards"
        : tab === "exam" && hasExam
          ? "exam"
          : hasQuiz
            ? "quiz"
            : hasCards
              ? "cards"
              : "exam";

  if (!hasQuiz && !hasCards && !hasExam) return null;

  if (!hasFullAccess) {
    return (
      <section className="student-retrieval student-retrieval--locked" aria-label="Revision practice">
        <h2 className="student-retrieval__title">Revision practice</h2>
        <p className="student-retrieval__locked">
          Quiz, flashcards, and exam-style questions are included with full lesson access.
        </p>
      </section>
    );
  }

  return (
    <section className="student-retrieval" aria-label="Revision practice">
      <header className="student-retrieval__header">
        <h2 className="student-retrieval__title">Revision practice</h2>
        <p className="student-retrieval__lead">
          Reinforcement quiz, flashcards, and exam-style questions — varied from in-lesson checkpoints.
        </p>
      </header>

      <div className="student-retrieval__tabs" role="tablist" aria-label="Revision mode">
        {hasQuiz ? (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "quiz"}
            className={activeTab === "quiz" ? "student-retrieval__tab student-retrieval__tab--active" : "student-retrieval__tab"}
            onClick={() => setTab("quiz")}
          >
            Quiz ({quizQuestions.length})
          </button>
        ) : null}
        {hasCards ? (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "cards"}
            className={activeTab === "cards" ? "student-retrieval__tab student-retrieval__tab--active" : "student-retrieval__tab"}
            onClick={() => setTab("cards")}
          >
            Flashcards ({flashcards.length})
          </button>
        ) : null}
        {hasExam ? (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "exam"}
            className={activeTab === "exam" ? "student-retrieval__tab student-retrieval__tab--active" : "student-retrieval__tab"}
            onClick={() => setTab("exam")}
          >
            Exam practice ({examQuestions.length})
          </button>
        ) : null}
      </div>

      <div className="student-retrieval__panel">
        {activeTab === "quiz" && hasQuiz ? (
          <QuizView
            title=""
            questions={quizQuestions}
            onQuestionAnswered={onQuestionAnswered}
            onContinueLesson={() => window.scrollBy({ top: 200, behavior: "smooth" })}
          />
        ) : null}
        {activeTab === "cards" && hasCards ? (
          <FlashcardsView
            title=""
            cards={flashcards.map((c) => ({
              id: c.id,
              front: c.front,
              back: c.back,
              difficulty: 2 as const,
              tags: c.tags ?? [],
            }))}
          />
        ) : null}
        {activeTab === "exam" && hasExam ? (
          <ul className="student-retrieval__exam-list">
            {examQuestions.map((eq) => (
              <li key={eq.id} className="student-retrieval__exam-item">
                <p className="student-retrieval__exam-q">
                  <span className="student-retrieval__exam-marks">{eq.marks} mark{eq.marks === 1 ? "" : "s"}</span>
                  {eq.question}
                </p>
                {eq.modelAnswer ? (
                  <details className="student-retrieval__exam-reveal">
                    <summary>Model answer</summary>
                    <p>{eq.modelAnswer}</p>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
