import React, { useMemo, useState, useEffect } from "react";

function gradeShortAnswer({
  userAnswer,
  markScheme,
  correctAnswer,
  marks,
}: {
  userAnswer: string;
  markScheme?: string[];
  correctAnswer?: string;
  marks: number;
}) {
  const norm = (s = "") =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  const ua = norm(userAnswer);
  const maxMarks = Math.max(1, marks || 1);

  // Levenshtein distance function for fuzzy matching
  const levenshtein = (a: string, b: string) => {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
    }
    return dp[m][n];
  };

  // Helper for approximate word matching
  const approxHasWord = (target: string) => {
    const t = norm(target);
    const words = ua.split(" ").filter(Boolean);
    return words.some((w) => levenshtein(w, t) <= 2) || ua.includes(t);
  };

  // ✅ If markScheme missing, derive mark points from correctAnswer
  let effectiveMarkScheme = Array.isArray(markScheme) ? markScheme : [];
  if (!effectiveMarkScheme.length && (correctAnswer || "").trim()) {
    const ca = (correctAnswer || "").replace(/\r\n/g, "\n").trim();

    // Split into mark points using common separators (GCSE-friendly)
    const parts = ca
      .split(/\n+|;|\.| and | but | whereas /i)
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 10);

    effectiveMarkScheme = parts.length ? parts : [ca];
  }

  if (effectiveMarkScheme.length) {
    const stop = new Set([
      "the","a","an","and","or","to","of","in","on","for","with","is","are","was","were",
      "be","being","been","that","this","these","those","it","its","as","at","by","from"
    ]);

    // small typo-tolerant word match
    const words = ua.split(" ").filter(Boolean);
    const approxHas = (target: string) => {
      const t = norm(target);
      if (!t) return false;
      if (ua.includes(t)) return true; // phrase contains
      return words.some((w) => levenshtein(w, t) <= 2); // typo tolerant
    };

    // Treat EACH mark-scheme line as 1 mark opportunity.
    // If the student hits ANY meaningful keyword from that line, they get that mark.
    const matchedPoints: string[] = [];
    const missingPoints: string[] = [];

    for (const point of effectiveMarkScheme) {
      const p = (point || "").trim();
      if (!p) continue;

      const tokens = norm(p).split(" ").filter((t) => t && !stop.has(t));
      const ok = tokens.some((t) => approxHas(t));

      if (ok) matchedPoints.push(p);
      else missingPoints.push(p);
    }

    const score = Math.min(matchedPoints.length, maxMarks);

    return {
      score,
      maxMarks,
      hits: matchedPoints,      // we keep your existing "hits" UI working
      missing: missingPoints,   // optional if you want to display later
    };
  }

  // 2) Fallback: GCSE-safe rule-based marking using meaning keywords
  const hasNucleusWord = approxHasWord("nucleus"); // Now with fuzzy matching
  const hasProk = ua.includes("prokaryot") || ua.includes("prokary");
  const hasEuk = ua.includes("eukaryot") || ua.includes("eukary");

  const negative = /\b(no|not|dont|do not|doesnt|does not|without|lack|lacks|lacking)\b/.test(ua);

  // Award mark if they express the key idea: prokaryotes lack a nucleus OR only eukaryotes have a nucleus
  const ok =
    (hasProk && hasNucleusWord && negative) ||
    (hasEuk && hasNucleusWord && !negative) ||
    (hasEuk && hasProk && hasNucleusWord); // covers "eukaryotes have nucleus, prokaryotes don't" even if negation parsing is imperfect

  return {
    score: ok ? maxMarks : 0,
    maxMarks,
    hits: ok ? ["keyword match"] : [],
  };
}

export type QuizQuestion =
  | {
      id: string;
      type: "mcq";
      question: string;
      options: string[];
      correctAnswer: string;
      explanation?: string;
      tags?: string[];
      difficulty?: number;
      marks?: number;
    }
  | {
      id: string;
      type: "short";
      question: string;
      correctAnswer: string;
      explanation?: string;
      tags?: string[];
      difficulty?: number;
      marks?: number;
    }
  | {
      id: string;
      type: "exam";
      question: string;
      correctAnswer?: string;
      markScheme?: string[];
      explanation?: string;
      tags?: string[];
      difficulty?: number;
      marks?: number;
    };

export function QuizView({
  questions,
  title = "Quiz",
}: {
  questions: QuizQuestion[];
  title?: string;
}) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastGrade, setLastGrade] = useState<any>(null);
  const [helpExpanded, setHelpExpanded] = useState<boolean>(() => {
    // Load user preference from localStorage
    try {
      const saved = localStorage.getItem("quiz_help_expanded");
      return saved !== "false"; // Default to true (expanded) if not saved
    } catch {
      return true; // Default to expanded
    }
  });

  const q = questions[i];

  // Save help state to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem("quiz_help_expanded", helpExpanded.toString());
    } catch (error) {
      // Silently fail if localStorage is not available
    }
  }, [helpExpanded]);

  const score = useMemo(() => {
    let s = 0;
    for (const qu of questions) {
      if (qu.type === "mcq") {
        const a = answers[qu.id];
        if (a && a.trim() === qu.correctAnswer.trim()) s += 1;
      } else if (qu.type === "short") {
        // simple exact/contains check; you can upgrade later
        const a = (answers[qu.id] ?? "").toLowerCase();
        const c = qu.correctAnswer.toLowerCase();
        if (a && (a === c || a.includes(c) || c.includes(a))) s += 1;
      } else {
        // exam questions are teacher/self-mark unless you add rubric scoring
      }
    }
    return s;
  }, [answers, questions]);

  const handleCheck = () => {
    if (q.type === "short") {
      const userAnswer = answers[q.id] || "";
      
      const result = gradeShortAnswer({
        userAnswer,
        markScheme: undefined, // short questions don't have markScheme
        correctAnswer: q.correctAnswer,
        marks: q.marks ?? 1,
      });

      setLastGrade(result);
      setShowFeedback(true);
      return;
    }
    
    if (q.type === "exam") {
      const userAnswer = answers[q.id] || "";
      
      const result = gradeShortAnswer({
        userAnswer,
        markScheme: q.markScheme, // exam questions have markScheme
        correctAnswer: q.correctAnswer,
        marks: q.marks ?? 1,
      });

      setLastGrade(result);
      setShowFeedback(true);
      return;
    }
    
    // For MCQ questions, just show feedback
    setShowFeedback(true);
  };

  const handleReset = () => {
    setAnswers({});
    setShowFeedback(false);
    setLastGrade(null);
    setI(0);
  };

  const toggleHelp = () => {
    setHelpExpanded(!helpExpanded);
  };

  const goPrev = () => {
    setShowFeedback(false);
    setLastGrade(null);
    setI((x) => Math.max(0, x - 1));
  };

  const goNext = () => {
    setShowFeedback(false);
    setLastGrade(null);
    setI((x) => Math.min(questions.length - 1, x + 1));
  };

  if (!questions?.length) {
    return (
      <div className="rounded-2xl border p-4">
        <div className="text-lg font-semibold">{title}</div>
        <div className="mt-2 text-sm opacity-70">No quiz questions yet.</div>
      </div>
    );
  }

  const isFirst = i === 0;
  const isLast = i === questions.length - 1;

  return (
    <div className="rounded-2xl border p-4">
      {/* ✅ SS2: Bigger title */}
      <h1 style={{ fontSize: 28, fontWeight: 900, margin: "6px 0 12px" }}>
        {title}
      </h1>

      {/* ✅ Improved Quiz Guidance (SS2) - Now Collapsible */}
      <div
        style={{
          marginTop: 6,
          marginBottom: 14,
          padding: "10px 14px",
          borderRadius: 12,
          background: "#f8fafc",
          border: "1px solid #e5e7eb",
          fontSize: 13,
          fontWeight: 600,
          color: "#334155",
          lineHeight: 1.5,
        }}
      >
        {/* Header with toggle */}
        <div 
          style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            cursor: "pointer",
            marginBottom: helpExpanded ? 8 : 0,
          }}
          onClick={toggleHelp}
        >
          <div style={{ fontWeight: 900 }}>
            How quiz marking works
          </div>
          <div style={{ fontSize: 12, color: "#64748b", userSelect: "none" }}>
            {helpExpanded ? "▾" : "▸"}
          </div>
        </div>

        {/* Collapsible content */}
        {helpExpanded && (
          <>
            {/* 🧠 How to answer quiz questions */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>
                <span style={{ marginRight: 6 }}>🧠</span> How to answer quiz questions
              </div>
              <div style={{ fontSize: 12.5, marginBottom: 4 }}>
                Read the question carefully and identify the command word
                <br />
                (e.g. state, describe, explain, compare)
              </div>
              <div style={{ fontSize: 12.5, marginBottom: 4 }}>
                Use precise scientific vocabulary and correct spelling
              </div>
              <div style={{ fontSize: 12.5 }}>
                If a question is worth more than 1 mark, make more than one distinct point
              </div>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "8px 0" }} />

            {/* ✍️ Short-answer questions */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>
                <span style={{ marginRight: 6 }}>✍️</span> Short-answer questions
              </div>
              <div style={{ fontSize: 12.5, marginBottom: 4 }}>
                Write in clear, complete sentences
              </div>
              <div style={{ fontSize: 12.5, marginBottom: 4 }}>
                Avoid vague phrases like "it helps" or "it does stuff"
              </div>
              <div style={{ fontSize: 12.5 }}>
                <span style={{ color: "#059669", fontWeight: 800 }}>✅</span> "Controls the cell's activities"
                <br />
                <span style={{ color: "#dc2626", fontWeight: 800 }}>❌</span> "Controls the cell"
              </div>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "8px 0" }} />

            {/* ✅ How marking works */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>
                <span style={{ marginRight: 6 }}>✅</span> How marking works
              </div>
              <div style={{ fontSize: 12.5, marginBottom: 4 }}>
                Marks are awarded for scientifically correct points, not exact wording
              </div>
              <div style={{ fontSize: 12.5, marginBottom: 4 }}>
                Partial marks are given for partially correct answers
              </div>
              <div style={{ fontSize: 12.5 }}>
                Feedback shows:
                <br />
                <span style={{ color: "#059669", fontWeight: 800 }}>✔</span> What was credited
                <br />
                <span style={{ color: "#dc2626", fontWeight: 800 }}>✖</span> What was missing
              </div>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "8px 0" }} />

            {/* Exam tip */}
            <div style={{ fontSize: 12.5, fontStyle: "italic", paddingTop: 4 }}>
              <strong>Exam tip:</strong>
              If a question is worth 2 marks or more, aim to make 2 clear, separate points.
            </div>
          </>
        )}
      </div>
      
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm opacity-70">
            Question {i + 1} / {questions.length} • Score (auto-gradable): {score}
          </div>
        </div>

        {/* ✅ SS1: Improved navigation buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            disabled={isFirst}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid #cbd5e1",
              background: "#f1f5f9",
              color: "#334155",
              fontWeight: 600,
              cursor: isFirst ? "not-allowed" : "pointer",
              opacity: isFirst ? 0.5 : 1,
              transition: "all 0.2s ease",
            }}
            onClick={goPrev}
            onMouseEnter={(e) => {
              if (!isFirst) {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.borderColor = "#94a3b8";
              }
            }}
            onMouseLeave={(e) => {
              if (!isFirst) {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = "#cbd5e1";
              }
            }}
            onMouseDown={(e) => {
              if (!isFirst) {
                e.currentTarget.style.transform = "scale(0.98)";
              }
            }}
            onMouseUp={(e) => {
              if (!isFirst) {
                e.currentTarget.style.transform = "translateY(-1px)";
              }
            }}
          >
            ← Prev
          </button>

          <button
            type="button"
            disabled={isLast}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: "none",
              background: isLast ? "#93c5fd" : "#2563eb",
              color: "#ffffff",
              fontWeight: 700,
              cursor: isLast ? "not-allowed" : "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              transition: "all 0.2s ease",
            }}
            onClick={goNext}
            onMouseEnter={(e) => {
              if (!isLast) {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.backgroundColor = "#1d4ed8";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isLast) {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.backgroundColor = "#2563eb";
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
              }
            }}
            onMouseDown={(e) => {
              if (!isLast) {
                e.currentTarget.style.transform = "scale(0.98)";
              }
            }}
            onMouseUp={(e) => {
              if (!isLast) {
                e.currentTarget.style.transform = "translateY(-1px)";
              }
            }}
          >
            Next →
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border p-4">
        <div className="text-xs uppercase tracking-wide opacity-60">
          {q.type === "mcq" ? "Multiple choice" : q.type === "short" ? "Short answer" : "Exam-style"}
        </div>
        <div className="mt-2 text-base font-medium">{q.question}</div>

        {q.type === "mcq" ? (
          <div className="mt-4 grid gap-2">
            {q.options.map((opt) => {
              const chosen = answers[q.id] === opt;
              return (
                <button
                  key={opt}
                  className={`rounded-xl border p-3 text-left text-sm ${
                    chosen ? "ring-2 ring-offset-2" : ""
                  }`}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        ) : (
          // ✅ SS2: More prominent answer input box
          <textarea
            value={answers[q.id] ?? ""}
            onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
            placeholder={q.type === "exam" ? "Write your answer..." : "Type your answer…"}
            style={{
              width: "100%",
              minHeight: 120,
              borderRadius: 14,
              border: "2px solid #2563eb",
              padding: 14,
              fontSize: 16,
              fontWeight: 700,
              outline: "none",
              background: "#ffffff",
              boxShadow: "0 6px 18px rgba(37, 99, 235, 0.12)",
              marginTop: "16px",
              fontFamily: "'Inter', 'Segoe UI', sans-serif",
              resize: "vertical",
            }}
          />
        )}

        {/* ✅ SS2: Cleaner difficulty/marks line (hidden for non-exam questions per SS1 suggestion) */}
        {q.type === "exam" ? (
          <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginTop: 8 }}>
            Difficulty: {q.difficulty ?? 1}/3 • Marks: {q.marks ?? 1}
          </div>
        ) : null}
        
        {/* Tags display */}
        {(q.tags ?? []).length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {(q.tags ?? []).map((t) => (
              <span key={t} className="rounded-full border px-2 py-1 text-xs">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Primary action buttons */}
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button
          type="button"
          onClick={handleCheck}
          style={{
            padding: "10px 18px",
            fontSize: 16,
            fontWeight: 800,
            background: "#2563eb",
            color: "#ffffff",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.backgroundColor = "#1d4ed8";
            e.currentTarget.style.boxShadow = "0 6px 20px rgba(37, 99, 235, 0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.backgroundColor = "#2563eb";
            e.currentTarget.style.boxShadow = "0 6px 18px rgba(37, 99, 235, 0.12)";
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = "scale(0.98)";
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
        >
          Check answer
        </button>

        <button
          type="button"
          onClick={handleReset}
          style={{
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 700,
            background: "#f1f5f9",
            color: "#0f172a",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.backgroundColor = "#e2e8f0";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.backgroundColor = "#f1f5f9";
            e.currentTarget.style.boxShadow = "none";
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = "scale(0.98)";
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
        >
          Reset
        </button>
      </div>

      {/* Marking feedback display */}
      {showFeedback && lastGrade && (q.type === "short" || q.type === "exam") ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "#f8fafc",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>
            Score: {lastGrade.score}/{lastGrade.maxMarks}
          </div>

          {Array.isArray(lastGrade.hits) && lastGrade.hits.length ? (
            <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>
              <span style={{ color: "#059669", marginRight: 4 }}>✔</span>
              Matched: {lastGrade.hits.join(", ")}
            </div>
          ) : (
            <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>
              No mark-scheme points matched yet.
            </div>
          )}
        </div>
      ) : null}

      {showFeedback ? (
        <div className="mt-4 rounded-2xl border p-4">
          <div className="text-sm font-semibold">Feedback</div>

          {q.type === "mcq" ? (
            <div className="mt-2 text-sm">
              <div>
                Your answer: <span className="font-medium">{answers[q.id] ?? "—"}</span>
              </div>
              <div>
                Correct: <span className="font-medium">{q.correctAnswer}</span>
              </div>
            </div>
          ) : q.type === "short" ? (
            <div className="mt-2 text-sm">
              <div className="opacity-70">Suggested answer:</div>
              <div className="mt-1 font-medium">{q.correctAnswer}</div>
            </div>
          ) : (
            <div className="mt-2 text-sm">
              <div className="opacity-70">Mark scheme points:</div>
              <ul className="mt-2 list-disc pl-5">
                {(q.markScheme ?? []).map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {q.explanation ? <div className="mt-3 text-sm opacity-80">{q.explanation}</div> : null}
        </div>
      ) : null}
    </div>
  );
}