/**
 * PR-W4.2: Teacher view of a single attempt (read-only MCQ, marking for short). PR-W5: short-answer marking UI.
 */
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getTeacherAttempt,
  markAttempt,
  releaseAttempt,
  type Attempt,
  type AttemptAnswer,
  type TeacherAttemptQuestion,
  type MarkItem,
} from "../api/worksheetAssignments";

function getAnswerByQuestionId(answers: AttemptAnswer[], questionId: string): AttemptAnswer | undefined {
  const id = String(questionId);
  return answers.find((a) => String(a.examQuestionId) === id);
}

export default function TeacherWorksheetAttemptPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [questions, setQuestions] = useState<TeacherAttemptQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingMarks, setSavingMarks] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [releasing, setReleasing] = useState(false);
  // Local editing state for short answers: questionId -> { awardedMarks, teacherFeedback }
  const [localMarks, setLocalMarks] = useState<Record<string, { awardedMarks: number | null; teacherFeedback: string }>>({});

  const loadAttempt = useCallback(() => {
    if (!attemptId) return;
    getTeacherAttempt(attemptId)
      .then(({ attempt: a, questions: q }) => {
        setAttempt(a);
        setQuestions(q || []);
        const next: Record<string, { awardedMarks: number | null; teacherFeedback: string }> = {};
        (q || []).forEach((ques) => {
          if (ques.type === "mcq") return;
          const ans = (a.answers || []).find((x) => String(x.examQuestionId) === String(ques._id));
          next[ques._id] = {
            awardedMarks: ans?.awardedMarks ?? null,
            teacherFeedback: ans?.teacherFeedback ?? "",
          };
        });
        setLocalMarks(next);
      })
      .catch((e: any) => {
        setError(e?.response?.data?.error || e?.message || "Failed to load attempt");
      });
  }, [attemptId]);

  useEffect(() => {
    loadAttempt();
  }, [loadAttempt]);

  const setMark = useCallback((questionId: string, awardedMarks: number | null, teacherFeedback: string) => {
    setLocalMarks((prev) => ({
      ...prev,
      [questionId]: { awardedMarks, teacherFeedback: prev[questionId]?.teacherFeedback ?? teacherFeedback },
    }));
  }, []);

  const setFeedback = useCallback((questionId: string, teacherFeedback: string) => {
    setLocalMarks((prev) => ({
      ...prev,
      [questionId]: { awardedMarks: prev[questionId]?.awardedMarks ?? null, teacherFeedback },
    }));
  }, []);

  const handleSaveMarks = useCallback(() => {
    if (!attemptId || !attempt || attempt.status === "IN_PROGRESS") return;
    const shortQuestions = questions.filter((q) => q.type !== "mcq");
    const marks: MarkItem[] = shortQuestions
      .filter((q) => {
        const v = localMarks[q._id];
        return v && typeof v.awardedMarks === "number";
      })
      .map((q) => ({
        examQuestionId: q._id,
        awardedMarks: localMarks[q._id]!.awardedMarks as number,
        teacherFeedback: (localMarks[q._id]?.teacherFeedback || "").trim() || undefined,
      }));
    if (marks.length === 0) return;
    setSavingMarks(true);
    setSaveSuccess(false);
    markAttempt(attemptId, marks)
      .then((updated) => {
        setAttempt(updated);
        setSaveSuccess(true);
        loadAttempt();
      })
      .catch((e: any) => {
        window.alert(e?.response?.data?.error || e?.message || "Failed to save marks");
      })
      .finally(() => setSavingMarks(false));
  }, [attemptId, attempt, questions, localMarks, loadAttempt]);

  const handleRelease = useCallback(() => {
    if (!attemptId || releasing) return;
    setReleasing(true);
    releaseAttempt(attemptId)
      .then((updated) => {
        setAttempt(updated);
        loadAttempt();
      })
      .catch((e: any) => {
        window.alert(e?.response?.data?.error || e?.message || "Failed to release results");
      })
      .finally(() => setReleasing(false));
  }, [attemptId, releasing, loadAttempt]);

  if (error) {
    return (
      <div style={{ padding: "2rem", maxWidth: "560px", margin: "0 auto" }}>
        <p style={{ color: "#b91c1c", marginBottom: "16px" }}>{error}</p>
        <button type="button" onClick={() => navigate(-1)} style={{ padding: "8px 16px" }}>
          Back
        </button>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading attempt…</p>
      </div>
    );
  }

  const answers = attempt.answers || [];
  const shortQuestions = questions.filter((q) => q.type !== "mcq");
  const canSaveMarks = attempt.status !== "IN_PROGRESS" && shortQuestions.length > 0;
  const canRelease = (attempt.status === "SUBMITTED" || attempt.status === "MARKED") && !attempt.isReleased;

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "8px" }}>Attempt</h1>
      <div style={{ marginBottom: "24px", fontSize: "0.9375rem", color: "#475569", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
        <span><strong>Student:</strong> {attempt.studentName || "—"}</span>
        <span>·</span>
        <span>
          <strong>Status:</strong>{" "}
          <span style={{ padding: "2px 8px", borderRadius: "4px", background: attempt.status === "MARKED" ? "#dcfce7" : "#fef3c7", color: attempt.status === "MARKED" ? "#166534" : "#92400e" }}>
            {attempt.status}
          </span>
        </span>
        {(attempt.status === "SUBMITTED" || attempt.status === "MARKED") && (
          <>
            <span>·</span>
            <span><strong>Score:</strong> {attempt.score ?? "—"} / {attempt.maxScore ?? "—"}</span>
            {attempt.submittedAt && (
              <>
                <span>·</span>
                <span><strong>Submitted:</strong> {new Date(attempt.submittedAt).toLocaleString()}</span>
              </>
            )}
        {attempt.isReleased ? (
          <span style={{ marginLeft: "8px", padding: "2px 8px", borderRadius: "4px", background: "#dbeafe", color: "#1d4ed8" }}>Released</span>
        ) : canRelease ? (
          <button
            type="button"
            onClick={handleRelease}
            disabled={releasing}
            style={{ marginLeft: "8px", padding: "4px 12px", borderRadius: "4px", border: "1px solid #2563eb", background: "#eff6ff", color: "#2563eb", cursor: releasing ? "wait" : "pointer", fontSize: "0.8125rem" }}
          >
            {releasing ? "Releasing…" : "Release results"}
          </button>
        ) : null}
          </>
        )}
      </div>

      {canSaveMarks && (
        <div style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            type="button"
            onClick={handleSaveMarks}
            disabled={savingMarks}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "1px solid #059669",
              background: "#059669",
              color: "#fff",
              cursor: savingMarks ? "wait" : "pointer",
              fontSize: "0.875rem",
            }}
          >
            {savingMarks ? "Saving…" : "Save marks"}
          </button>
          {saveSuccess && !savingMarks && <span style={{ color: "#059669", fontSize: "0.875rem" }}>Saved</span>}
        </div>
      )}

      <ol style={{ listStyle: "decimal", paddingLeft: "1.5rem" }}>
        {questions.map((q) => {
          const ans = getAnswerByQuestionId(answers, q._id);
          const chosenIndex = ans && typeof ans.answerIndex === "number" ? ans.answerIndex : null;
          const correctIndex = typeof q.correctIndex === "number" ? q.correctIndex : null;
          const isMcq = q.type === "mcq" && Array.isArray(q.options);
          const local = localMarks[q._id];

          return (
            <li key={q._id} style={{ marginBottom: "24px", borderBottom: "1px solid #e2e8f0", paddingBottom: "24px" }}>
              <div style={{ marginBottom: "8px", fontWeight: 600 }}>
                {q.question} <span style={{ fontWeight: 400, color: "#64748b" }}>({q.marks} {q.marks === 1 ? "mark" : "marks"})</span>
              </div>
              {isMcq && q.options ? (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {q.options.map((opt, i) => {
                    const isChosen = chosenIndex === i;
                    const isCorrect = correctIndex === i;
                    const style: React.CSSProperties = {
                      padding: "6px 10px",
                      marginBottom: "4px",
                      borderRadius: "6px",
                      background: isChosen && isCorrect ? "#dcfce7" : isChosen && !isCorrect ? "#fee2e2" : isCorrect ? "#f0fdf4" : "#f8fafc",
                      border: isChosen ? "1px solid #94a3b8" : "1px solid #e2e8f0",
                    };
                    return (
                      <li key={i} style={style}>
                        {opt}
                        {isChosen && <span style={{ marginLeft: "8px", fontSize: "0.8125rem" }}>(chosen)</span>}
                        {isCorrect && !isChosen && <span style={{ marginLeft: "8px", fontSize: "0.8125rem", color: "#16a34a" }}>(correct)</span>}
                        {isChosen && isCorrect && <span style={{ marginLeft: "8px", fontSize: "0.8125rem", color: "#16a34a" }}>(correct)</span>}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <>
                  <div style={{ marginBottom: "8px", fontSize: "0.875rem", color: "#64748b" }}>Student response:</div>
                  <div style={{ padding: "10px 12px", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0", whiteSpace: "pre-wrap", marginBottom: "12px" }}>
                    {ans?.shortText || "—"}
                  </div>
                  {canSaveMarks && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: "400px" }}>
                      <label style={{ fontSize: "0.875rem" }}>
                        Marks (0–{q.marks}):{" "}
                        <input
                          type="number"
                          min={0}
                          max={q.marks}
                          value={local?.awardedMarks ?? ""}
                          onChange={(e) => {
                            const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
                            setMark(q._id, v, local?.teacherFeedback ?? "");
                          }}
                          style={{ width: "64px", padding: "4px 8px", borderRadius: "4px", border: "1px solid #d1d5db" }}
                        />
                      </label>
                      <label style={{ fontSize: "0.875rem" }}>
                        Feedback (optional):{" "}
                        <textarea
                          value={local?.teacherFeedback ?? ""}
                          onChange={(e) => setFeedback(q._id, e.target.value)}
                          placeholder="Optional feedback"
                          rows={2}
                          style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "0.875rem" }}
                        />
                      </label>
                    </div>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>

      <p style={{ marginTop: "24px" }}>
        <button type="button" onClick={() => navigate(-1)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #d1d5db" }}>
          Back
        </button>
      </p>
    </div>
  );
}
