import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

type AssessmentPaper = {
  _id: string;
  title: string;
  subject: string;
  examBoard?: string;
  level?: string;
  tier?: string;
  kind?: string;
  timeSeconds?: number;
  items?: Array<{ itemId: string; order: number }>;
};

type AssessmentAttempt = {
  _id: string;
  paperId: string;
  status: string;
  startedAt: string;
  durationSeconds: number;
  timeUsedSeconds: number;
  existing?: boolean;
};

const formatTime = (secs?: number) => {
  if (!secs || secs <= 0) return "Untimed";
  const m = Math.round(secs / 60);
  return `${m} min`;
};

const AssessmentPaperStartPage: React.FC = () => {
  console.log("✅ AssessmentPaperStartPage mounted");
  const navigate = useNavigate();

  // ✅ MUST be `id` because App.tsx uses :id
  const { id: paperId } = useParams<{ id: string }>();

  const [paper, setPaper] = useState<AssessmentPaper | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const [startingAttempt, setStartingAttempt] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!paperId) return; // id missing => don't call API
        setLoading(true);
        setErrMsg("");

        const res = await api.get(`/assessment-papers/${paperId}`);

        // ✅ backend returns { success: true, paper: {...} }
        const loadedPaper: AssessmentPaper = res.data?.paper ?? res.data;

        if (!cancelled) setPaper(loadedPaper);
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setErrMsg("Could not load this paper.");
          setPaper(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [paperId]);

  const handleStartAttempt = async () => {
    if (!paperId) return;

    try {
      setStartingAttempt(true);

      // First, check for existing in-progress attempt
      try {
        const resumeRes = await api.get(`/assessment-attempts/in-progress/${paperId}`);
        const attempt: AssessmentAttempt = resumeRes.data.attempt;

        console.log("Found existing in-progress attempt:", attempt._id);
        navigate(`/assessments/papers/${paperId}/attempt?attemptId=${attempt._id}`);
        return;
      } catch (resumeError: any) {
        // 404 is expected when no in-progress attempt exists -> ignore
        if (resumeError?.response?.status === 404) {
          // do nothing
        } else {
          console.error("Error checking for existing attempt:", resumeError);
        }
      }

      // No existing attempt found, create a new one
      const createRes = await api.post("/assessment-attempts", { paperId });
      const attempt: AssessmentAttempt = createRes.data.attempt;

      console.log("Created new attempt:", attempt._id);
      navigate(`/assessments/papers/${paperId}/attempt?attemptId=${attempt._id}`);
    } catch (error: any) {
      console.error("Error starting attempt:", error);

      let errorMessage = "Failed to start attempt. Please try again.";
      if (error.response?.status === 409) {
        errorMessage = "You already have an in-progress attempt for this paper. Please refresh and try again.";
      } else if (error.response?.data?.msg) {
        errorMessage = error.response.data.msg;
      }

      setErrMsg(errorMessage);
    } finally {
      setStartingAttempt(false);
    }
  };

  if (!paperId) {
    return (
      <div style={{ padding: "2rem" }}>
        <h3>Missing paper id</h3>
        <Link to="/assessments">Back to Exam Practice</Link>
      </div>
    );
  }

  if (loading) return <div style={{ padding: "2rem" }}>Loading paper…</div>;

  if (!paper) {
    return (
      <div style={{ padding: "2rem" }}>
        <div style={{ marginBottom: "1rem" }}>{errMsg || "Paper not found."}</div>
        <Link to="/assessments">← Back to Exam Practice</Link>
      </div>
    );
  }

  const questionCount = paper.items?.length || 0;

  return (
    <div style={{ padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <Link to="/assessments" style={{ textDecoration: "none" }}>
        ← Back to Exam Practice
      </Link>

      <h1 style={{ marginTop: "1rem" }}>{paper.title}</h1>
      <div style={{ opacity: 0.8, marginBottom: "1rem" }}>
        {paper.subject} • {paper.examBoard || "Exam board"} • {paper.level || "Level"}{" "}
        {paper.tier ? `• ${paper.tier}` : ""} • {formatTime(paper.timeSeconds)}
      </div>

      <div
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          padding: "1rem",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Assessment Details</div>
        <div style={{ opacity: 0.85 }}>
          This assessment contains {questionCount} questions with a time limit of {formatTime(paper.timeSeconds)}.
          Your progress will be automatically saved as you work.
        </div>

        {/* ✅ Short-answer aware note (no logic needed here, just accurate UX) */}
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.75rem",
            borderRadius: 10,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            color: "#0f172a",
            fontSize: "0.9rem",
            lineHeight: 1.4,
          }}
        >
          This paper may include <b>multiple-choice</b> and <b>short-answer</b> questions. Short answers will be saved and
          marked automatically where supported.
        </div>

        <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <div style={{ fontWeight: 600 }}>Questions:</div>
            <div>{questionCount}</div>
          </div>

          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <div style={{ fontWeight: 600 }}>Time limit:</div>
            <div>{formatTime(paper.timeSeconds)}</div>
          </div>

          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <div style={{ fontWeight: 600 }}>Subject:</div>
            <div>{paper.subject}</div>
          </div>

          {paper.examBoard && (
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <div style={{ fontWeight: 600 }}>Exam Board:</div>
              <div>{paper.examBoard}</div>
            </div>
          )}

          {paper.level && (
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <div style={{ fontWeight: 600 }}>Level:</div>
              <div>{paper.level}</div>
            </div>
          )}
        </div>

        <div style={{ marginTop: "1.5rem" }}>
          {errMsg && (
            <div
              style={{
                padding: "0.75rem",
                background: "#fee2e2",
                border: "1px solid #fca5a5",
                borderRadius: "8px",
                marginBottom: "1rem",
                color: "#991b1b",
              }}
            >
              {errMsg}
            </div>
          )}

          <button
            onClick={handleStartAttempt}
            disabled={startingAttempt}
            style={{
              padding: "0.7rem 1rem",
              borderRadius: 10,
              border: "none",
              background: startingAttempt ? "#94a3b8" : "#4f46e5",
              color: "white",
              fontWeight: 700,
              cursor: startingAttempt ? "not-allowed" : "pointer",
              width: "100%",
              fontSize: "1rem",
            }}
          >
            {startingAttempt ? "Starting..." : "Start Attempt"}
          </button>

          <div style={{ marginTop: "0.75rem", fontSize: "0.875rem", opacity: 0.7, textAlign: "center" }}>
            {startingAttempt ? "Checking for existing attempts..." : "Click to begin or resume your assessment"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentPaperStartPage;