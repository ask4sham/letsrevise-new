import React, { useCallback, useEffect, useState } from "react";
import {
  fetchLessonCoverageReview,
  type LessonCoverageReview,
} from "../../api/lessonCoverageReview";
import "./teacherCoverageReviewPanel.css";

export type TeacherCoverageReviewPanelProps = {
  lessonId: string | undefined;
  /** Bump to refetch (e.g. after generate-assets). */
  refreshKey?: number;
};

function formatAppearances(
  appearances: { label: string; detail?: string }[]
): React.ReactNode {
  if (!appearances?.length) return <span className="teacher-coverage-review__muted">—</span>;
  const byLabel = new Map<string, number>();
  for (const a of appearances) {
    byLabel.set(a.label, (byLabel.get(a.label) || 0) + 1);
  }
  return (
    <ul className="teacher-coverage-review__list">
      {Array.from(byLabel.entries()).map(([label, n]) => (
        <li key={label}>
          {label}
          {n > 1 ? ` (×${n})` : ""}
        </li>
      ))}
    </ul>
  );
}

export function TeacherCoverageReviewPanel({
  lessonId,
  refreshKey = 0,
}: TeacherCoverageReviewPanelProps): React.ReactElement | null {
  const [review, setReview] = useState<LessonCoverageReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!lessonId) {
      setReview(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLessonCoverageReview(lessonId);
      setReview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load coverage review");
      setReview(null);
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (!lessonId) return null;

  const hidden = review?.hiddenSources;

  return (
    <div className="teacher-coverage-review">
      <h3 className="teacher-coverage-review__title">Coverage review</h3>
      <p className="teacher-coverage-review__subtitle">
        Live analysis of lesson blocks plus hidden AI drafts (flashcards, quiz, exam bank).
        Nothing is removed automatically.
        {review?.centralConceptName ? (
          <>
            {" "}
            Central objective: <strong>{review.centralConceptName}</strong>
          </>
        ) : null}
      </p>

      {loading ? (
        <p className="teacher-coverage-review__muted">Loading coverage…</p>
      ) : error ? (
        <p className="teacher-coverage-review__muted">{error}</p>
      ) : review ? (
        <>
          {hidden &&
          (hidden.bankFlashcards > 0 ||
            hidden.bankQuizQuestions > 0 ||
            hidden.bankExamQuestions > 0) ? (
            <div className="teacher-coverage-review__section">
              <h4>Hidden AI items in analysis</h4>
              <p className="teacher-coverage-review__muted">
                Flashcards: {hidden.flashcards} (bank: {hidden.bankFlashcards}) · Quiz drafts:{" "}
                {hidden.quizDrafts} (bank: {hidden.bankQuizQuestions}) · Exam drafts:{" "}
                {hidden.bankExamQuestions}
              </p>
            </div>
          ) : null}

          {review.overTested.length > 0 ? (
            <div className="teacher-coverage-review__section">
              <h4>Over-tested</h4>
              {review.overTested.map((w) => (
                <div key={w.id} className="teacher-coverage-review__warning">
                  <strong>
                    {w.name} — tested {w.count} time{w.count === 1 ? "" : "s"}
                    {w.isCentral ? " (central objective)" : ""}
                  </strong>
                  <div className="teacher-coverage-review__muted">Appears in:</div>
                  {formatAppearances(w.appearances)}
                  {w.suggestedReplacement?.length ? (
                    <>
                      <div className="teacher-coverage-review__muted" style={{ marginTop: 6 }}>
                        Suggested replacement focus:
                      </div>
                      <ul className="teacher-coverage-review__list">
                        {w.suggestedReplacement.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {review.underTested.filter((c) => c.count === 0).length > 0 ? (
            <div className="teacher-coverage-review__section">
              <h4>Under-tested</h4>
              {review.underTested
                .filter((c) => c.count === 0)
                .slice(0, 8)
                .map((c) => (
                  <div key={c.id} className="teacher-coverage-review__under">
                    {c.name} — {c.count} test{c.count === 1 ? "" : "s"}
                  </div>
                ))}
            </div>
          ) : null}

          {review.boundaryProfileKey && review.boundaryStatus !== "off" ? (
            <div className="teacher-coverage-review__section">
              <h4>Sub-topic boundary</h4>
              <p className="teacher-coverage-review__muted">
                Profile: {review.boundaryProfileKey} · mode: {review.boundaryStatus}
                {typeof review.scopeContaminationScore === "number"
                  ? ` · contamination: ${review.scopeContaminationScore}%`
                  : null}
              </p>
              {review.inScopeConcepts && review.inScopeConcepts.length > 0 ? (
                <>
                  <div className="teacher-coverage-review__muted">In-scope concepts:</div>
                  <ul className="teacher-coverage-review__list">
                    {review.inScopeConcepts.map((c) => (
                      <li key={c.id}>{c.name}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {review.outOfScopeConcepts && review.outOfScopeConcepts.length > 0 ? (
                <>
                  <div className="teacher-coverage-review__muted">Out-of-scope (primary targets):</div>
                  <ul className="teacher-coverage-review__list">
                    {review.outOfScopeConcepts.map((c) => (
                      <li key={c.id}>
                        {c.name} ({c.scope})
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {review.boundaryWarnings && review.boundaryWarnings.length > 0 ? (
                <>
                  <div className="teacher-coverage-review__muted">Boundary warnings:</div>
                  <ul className="teacher-coverage-review__list">
                    {review.boundaryWarnings.slice(0, 6).map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}

          {review.conceptsTested.length > 0 ? (
            <div className="teacher-coverage-review__section">
              <h4>Concepts tested</h4>
              <ul className="teacher-coverage-review__list">
                {review.conceptsTested.slice(0, 10).map((c) => (
                  <li key={c.id}>
                    {c.name} ({c.testedCount})
                    {c.isCentral ? " · central" : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      <button
        type="button"
        className="teacher-coverage-review__refresh"
        disabled={loading}
        onClick={() => void load()}
      >
        {loading ? "Refreshing…" : "Refresh coverage"}
      </button>
    </div>
  );
}
