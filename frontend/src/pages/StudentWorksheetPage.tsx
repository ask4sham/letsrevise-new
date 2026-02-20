/**
 * PR-W4: Public student worksheet page. Route: /w/:shareId
 * Load assignment by shareId → optional name → create attempt → answer questions → save/submit.
 */
import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  getSharedAssignment,
  createAttempt,
  saveAttempt,
  submitAttempt,
  type SharedAssignmentPayload,
  type AttemptAnswer,
} from "../api/worksheetAssignments";

export default function StudentWorksheetPage() {
  const { shareId: shareIdParam } = useParams<{ shareId: string }>();
  const shareId = shareIdParam || "";
  const [step, setStep] = useState<"load" | "name" | "attempt" | "submitted" | "closed" | "error">("load");
  const [payload, setPayload] = useState<SharedAssignmentPayload | null>(null);
  const [studentName, setStudentName] = useState("");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<{ score: number; maxScore: number } | null>(null);
  const [answers, setAnswers] = useState<AttemptAnswer[]>([]);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareId) {
      setError("Missing share link.");
      setStep("error");
      return;
    }
    getSharedAssignment(shareId)
      .then((data) => {
        setPayload(data);
        const inactive = data?.assignment?.isActive === false;
        const duePassed = data?.assignment?.dueAt && new Date(data.assignment.dueAt) < new Date();
        setStep(inactive || duePassed ? "closed" : "name");
      })
      .catch((e: any) => {
        setError(e?.response?.data?.error || e?.message || "Could not load assignment.");
        setStep("error");
      });
  }, [shareId]);

  const startAttempt = useCallback(() => {
    if (!shareId || !payload) return;
    setSaving(true);
    createAttempt(shareId, { studentName: studentName.trim() || undefined })
      .then((id) => {
        setAttemptId(id);
        setAnswers(
          (payload.questions || []).map((q) => ({
            examQuestionId: q._id,
            answerIndex: null as number | null,
            shortText: "",
          }))
        );
        setStep("attempt");
      })
      .catch((e: any) => {
        const msg = e?.response?.data?.error || e?.message || "";
        if (e?.response?.status === 403 && String(msg).toLowerCase().includes("closed")) {
          setStep("closed");
        } else {
          setError(msg || "Could not start attempt.");
          setStep("error");
        }
      })
      .finally(() => setSaving(false));
  }, [shareId, payload, studentName]);

  const handleSave = useCallback(() => {
    if (!attemptId || step !== "attempt") return;
    setSaving(true);
    saveAttempt(attemptId, answers)
      .then(() => setSaving(false))
      .catch((e: any) => {
        if (e?.response?.status === 403 && String(e?.response?.data?.error || "").toLowerCase().includes("closed")) {
          setStep("closed");
        }
        setSaving(false);
      });
  }, [attemptId, answers, step]);

  const handleSubmit = useCallback(() => {
    if (!attemptId || step !== "attempt") return;
    if (!window.confirm("Submit now? You cannot change answers after submitting.")) return;
    setSubmitting(true);
    submitAttempt(attemptId, answers)
      .then(({ attempt: a }) => {
        setAttempt({ score: a.score, maxScore: a.maxScore });
        setStep("submitted");
      })
      .catch((e: any) => {
        const msg = e?.response?.data?.error || e?.message || "";
        if (e?.response?.status === 403 && String(msg).toLowerCase().includes("closed")) {
          setStep("closed");
        } else {
          window.alert(msg || "Submit failed.");
        }
      })
      .finally(() => setSubmitting(false));
  }, [attemptId, answers, step]);

  const setAnswer = useCallback((questionId: string, answerIndex: number | null, shortText: string) => {
    setAnswers((prev) => {
      const next = prev.map((a) =>
        a.examQuestionId === questionId ? { ...a, answerIndex, shortText } : a
      );
      const has = next.some((a) => a.examQuestionId === questionId);
      if (!has) next.push({ examQuestionId: questionId, answerIndex, shortText });
      return next;
    });
  }, []);

  if (step === "error") {
    return (
      <div style={{ padding: "2rem", maxWidth: "560px", margin: "0 auto" }}>
        <p style={{ color: "#b91c1c" }}>{error}</p>
      </div>
    );
  }

  if (step === "load" || !payload) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading assignment…</p>
      </div>
    );
  }

  if (step === "closed") {
    return (
      <div style={{ padding: "2rem", maxWidth: "560px", margin: "0 auto", textAlign: "center" }}>
        <h1 style={{ marginBottom: "8px" }}>{payload.worksheet?.title || "Worksheet"}</h1>
        {payload.assignment?.title && (
          <p style={{ color: "#6b7280", marginBottom: "16px" }}>{payload.assignment.title}</p>
        )}
        <p style={{ color: "#64748b", fontSize: "1.0625rem" }}>This assignment is closed.</p>
      </div>
    );
  }

  if (step === "name") {
    return (
      <div style={{ padding: "2rem", maxWidth: "400px", margin: "0 auto" }}>
        <h1 style={{ marginBottom: "8px" }}>{payload.worksheet?.title || "Worksheet"}</h1>
        {payload.assignment?.title && (
          <p style={{ color: "#6b7280", marginBottom: "16px" }}>{payload.assignment.title}</p>
        )}
        <label style={{ display: "block", marginBottom: "8px" }}>Your name (optional)</label>
        <input
          type="text"
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          placeholder="e.g. Alex"
          style={{ width: "100%", padding: "10px 12px", marginBottom: "16px", borderRadius: "8px", border: "1px solid #d1d5db" }}
        />
        <button
          type="button"
          onClick={startAttempt}
          disabled={saving}
          style={{
            width: "100%",
            padding: "12px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: saving ? "wait" : "pointer",
            fontSize: "1rem",
          }}
        >
          {saving ? "Starting…" : "Start"}
        </button>
      </div>
    );
  }

  if (step === "submitted" && attempt) {
    return (
      <div style={{ padding: "2rem", maxWidth: "560px", margin: "0 auto", textAlign: "center" }}>
        <h1 style={{ marginBottom: "8px" }}>Submitted</h1>
        <p style={{ fontSize: "1.25rem" }}>
          Score: <strong>{attempt.score}</strong> / {attempt.maxScore}
        </p>
      </div>
    );
  }

  if (step === "attempt" && payload.questions) {
    return (
      <div style={{ padding: "1.5rem", maxWidth: "720px", margin: "0 auto" }}>
        <h1 style={{ marginBottom: "4px" }}>{payload.worksheet?.title || "Worksheet"}</h1>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "8px" }}>
          <span style={{ color: "#6b7280", fontSize: "0.875rem" }}>
            {payload.questions.length} question{payload.questions.length !== 1 ? "s" : ""}
          </span>
          <span>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{ marginRight: "8px", padding: "8px 16px", borderRadius: "6px", border: "1px solid #d1d5db", cursor: saving ? "wait" : "pointer" }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              style={{ padding: "8px 16px", borderRadius: "6px", background: "#059669", color: "#fff", border: "none", cursor: submitting ? "wait" : "pointer" }}
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </span>
        </div>
        <ol style={{ listStyle: "decimal", paddingLeft: "1.5rem" }}>
          {payload.questions.map((q, idx) => {
            const ans = answers.find((a) => a.examQuestionId === q._id);
            return (
              <li key={q._id} style={{ marginBottom: "24px", borderBottom: "1px solid #e5e7eb", paddingBottom: "24px" }}>
                <div style={{ marginBottom: "8px", fontWeight: 600 }}>{q.question}</div>
                {q.type === "mcq" && Array.isArray(q.options) ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {q.options.map((opt, i) => (
                      <label key={i} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                        <input
                          type="radio"
                          name={`q-${q._id}`}
                          checked={(ans?.answerIndex ?? null) === i}
                          onChange={() => setAnswer(q._id, i, ans?.shortText || "")}
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={ans?.shortText || ""}
                    onChange={(e) => setAnswer(q._id, ans?.answerIndex ?? null, e.target.value)}
                    placeholder="Your answer"
                    rows={3}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.9375rem" }}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <p>Loading…</p>
    </div>
  );
}
