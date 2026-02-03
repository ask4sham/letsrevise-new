// frontend/src/pages/AssessmentPaperAttemptPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../services/api";
import SubscriptionRequired from "../components/SubscriptionRequired";

type AssessmentPaper = {
  _id: string;
  title: string;
  subject: string;
  examBoard?: string;
  level?: string;
  tier?: string;
  kind?: string;
  timeSeconds?: number;
  items?: Array<{
    _id?: string;
    itemId: string | { _id: string };
    order: number;
    prompt?: string;
    question?: string;
    type?: string;
    options?: string[];
    marks?: number;
  }>;
};

type AssessmentItem = {
  _id: string;
  title: string;
  question: string;
  type: string;
  options?: string[];
  marks?: number;
  explanation?: string;
  correctIndex?: number;
  prompt?: string;
};

type AssessmentAttempt = {
  _id: string;
  paperId: string;
  status: string;
  startedAt: string;
  submittedAt?: string;
  durationSeconds: number;
  timeUsedSeconds: number;
  answers: Array<{
    questionId: string;
    selectedIndex: number | null;
    textAnswer?: string | null;
    answeredAt: string;
  }>;
  score: {
    totalQuestions: number;
    answered: number;
    correct: number;
    percentage: number;
  };
  autoSubmitted: boolean;
};

const DEFAULT_TIME_SECONDS = 600;

// Helper to detect MCQ types
const isMcqType = (t?: string) =>
  ["mcq", "multiple_choice", "multiple-choice", "multiple-choice-single", "multiple-choice-single-answer"].includes(
    String(t || "").toLowerCase()
  );

const AssessmentPaperAttemptPage: React.FC = () => {
  const { id: paperId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const attemptId = searchParams.get("attemptId");

  const [paper, setPaper] = useState<AssessmentPaper | null>(null);
  const [attempt, setAttempt] = useState<AssessmentAttempt | null>(null);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number | null>>({}); // questionId -> selectedIndex
  const [shortAnswers, setShortAnswers] = useState<Record<string, string>>({}); // questionId -> text answer
  const [timeUsedSeconds, setTimeUsedSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [answerSaving, setAnswerSaving] = useState(false);
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);

  // Helper function to normalize item data from backend
  const normalizeItem = (itemData: any): AssessmentItem => {
    // IMPORTANT: prefer the actual AssessmentItem id (itemId), NOT the wrapper _id
    const actualItemId =
      (typeof itemData?.itemId === "object" && itemData?.itemId?._id) ||
      (typeof itemData?.itemId === "string" && itemData.itemId) ||
      itemData?._id ||
      "";

    const questionText = itemData?.question || itemData?.prompt || "";

    return {
      _id: actualItemId,
      title: itemData?.title || `Question`,
      question: questionText,
      type: itemData?.type || "short",
      options: itemData?.options || [],
      marks: itemData?.marks || 1,
      explanation: itemData?.explanation,
      correctIndex: itemData?.correctIndex,
      prompt: itemData?.prompt || questionText,
    };
  };

  // Function to load item details from backend
  const loadItemDetails = async (itemId: string): Promise<AssessmentItem> => {
    try {
      const response = await api.get(`/assessment-items/${itemId}`);
      const backendItem = response.data.item;
      return normalizeItem(backendItem);
    } catch (error) {
      console.error(`Failed to load item ${itemId}:`, error);
      return {
        _id: itemId,
        title: "Question",
        question: "Error loading question. Please try again.",
        type: "short",
        marks: 1,
        prompt: "Error loading question",
      };
    }
  };

  // Handle short answer text changes (local + best-effort save)
  const handleShortAnswerChange = (questionId: string, text: string) => {
    setShortAnswers((prev) => ({ ...prev, [questionId]: text }));
  };

  // Timer calculation
  const timeLeftSeconds = attempt ? Math.max(0, attempt.durationSeconds - timeUsedSeconds) : 0;
  const minutes = Math.floor(timeLeftSeconds / 60);
  const seconds = timeLeftSeconds % 60;
  const isTimeLow = timeLeftSeconds < 300;
  const isTimeCritical = timeLeftSeconds < 60;

  // 1) Load attempt and paper data
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!paperId || !attemptId) {
          setLoadingError("Missing paper ID or attempt ID");
          setLoading(false);
          return;
        }

        setLoading(true);
        setLoadingError(null);

        // Load the attempt first
        const attemptRes = await api.get(`/assessment-attempts/${attemptId}`);
        const loadedAttempt: AssessmentAttempt = attemptRes.data.attempt;

        if (cancelled) return;

        setAttempt(loadedAttempt);
        setTimeUsedSeconds(loadedAttempt.timeUsedSeconds || 0);

        // Check if attempt is already submitted/expired
        if (loadedAttempt.status !== "in_progress") {
          navigate(`/assessments/papers/${paperId}/results?attemptId=${attemptId}`);
          return;
        }

        // Load paper details
        const paperRes = await api.get(`/assessment-papers/${paperId}`);
        const loadedPaper: AssessmentPaper = paperRes.data.paper;

        if (cancelled) return;

        setPaper(loadedPaper);

        // Convert attempt answers to local state (keys normalized to string for MCQ selectedIndex / short textAnswer)
        const answersMap: Record<string, number | null> = {};
        const shortAnswersMap: Record<string, string> = {};

        loadedAttempt.answers.forEach((answer) => {
          const qId = String(answer.questionId);
          answersMap[qId] = answer.selectedIndex ?? null;
          if (typeof answer.textAnswer === "string") {
            shortAnswersMap[qId] = answer.textAnswer;
          }
        });

        setAnswers(answersMap);
        setShortAnswers(shortAnswersMap);

        // Load and normalize items
        if (loadedPaper.items && loadedPaper.items.length > 0) {
          // Check if items already have data or just references
          const firstItem = loadedPaper.items[0];
          const hasItemData =
            firstItem &&
            (firstItem.prompt !== undefined ||
              firstItem.question !== undefined ||
              (typeof firstItem !== "string" && "prompt" in firstItem));

          if (hasItemData) {
            // Items already have data, just normalize them
            const normalizedItems = loadedPaper.items.map((item: any) => normalizeItem(item));
            setItems(normalizedItems);
          } else {
            // Items are just references, need to load details individually
            const itemPromises = loadedPaper.items.map(async (itemRef: any) => {
              const itemId = itemRef._id || itemRef.itemId?._id || itemRef.itemId;
              if (!itemId) return null;
              return await loadItemDetails(itemId);
            });

            const loadedItems = await Promise.all(itemPromises);
            setItems(loadedItems.filter(Boolean) as AssessmentItem[]);
          }
        }

        setLoading(false);
      } catch (error: any) {
        if (cancelled) return;

        if (error?.response?.status === 403 && (error?.response?.data?.message || error?.response?.data?.msg) === "Subscription required") {
          setSubscriptionBlocked(true);
        } else {
          console.error("Error loading attempt:", error);
          setLoadingError(error.response?.data?.msg || "Failed to load assessment. Please try again.");
        }
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [paperId, attemptId, navigate]);

  // 2) Timer countdown
  useEffect(() => {
    if (!attempt || attempt.status !== "in_progress") return;
    if (!isTimerRunning) return;
    if (timeLeftSeconds <= 0) return;

    const interval = setInterval(() => {
      setTimeUsedSeconds((prev) => {
        const newTimeUsed = prev + 1;

        // Auto-save time progress every 30 seconds
        if (newTimeUsed % 30 === 0 && attemptId) {
          saveTimeProgress(newTimeUsed);
        }

        return newTimeUsed;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [attempt, isTimerRunning, timeLeftSeconds, attemptId]);

  // 3) When time hits zero, auto-submit
  useEffect(() => {
    if (!attempt || attempt.status !== "in_progress") return;
    if (timeLeftSeconds > 0) return;
    if (autoSubmitted) return;

    setAutoSubmitted(true);
    handleSubmit(true);
  }, [attempt, timeLeftSeconds, autoSubmitted]);

  const saveTimeProgress = async (timeUsed: number) => {
    if (!attemptId || !attempt || attempt.status !== "in_progress") return;

    const currentItem = items[currentItemIndex];
    // Don't try to save if there's no current item
    if (!currentItem) return;

    try {
      // Update timeUsedSeconds in backend (send correct payload per question type)
      if (currentItem.type === "short") {
        await api.put(`/assessment-attempts/${attemptId}/answer`, {
          questionId: currentItem._id,
          textAnswer: shortAnswers[currentItem._id] ?? "",
          timeUsedSeconds: timeUsed,
        });
      } else if (isMcqType(currentItem.type)) {
        await api.put(`/assessment-attempts/${attemptId}/answer`, {
          questionId: currentItem._id,
          selectedIndex: answers[currentItem._id] ?? null,
          timeUsedSeconds: timeUsed,
        });
      } else {
        // For other question types, just save time without answer
        await api.put(`/assessment-attempts/${attemptId}/answer`, {
          questionId: currentItem._id,
          timeUsedSeconds: timeUsed,
        });
      }
    } catch (error: any) {
      if (error?.response?.status === 403 && (error?.response?.data?.message || error?.response?.data?.msg) === "Subscription required") {
        setSubscriptionBlocked(true);
      } else {
        console.error("Error saving time progress:", error);
      }
    }
  };

  const handleAnswer = async (questionId: string, selectedIndex: number) => {
    if (!attemptId || !attempt || attempt.status !== "in_progress") return;

    // Update local state immediately for UI responsiveness
    setAnswers((prev) => ({ ...prev, [questionId]: selectedIndex }));

    try {
      setAnswerSaving(true);

      // Save to backend
      await api.put(`/assessment-attempts/${attemptId}/answer`, {
        questionId,
        selectedIndex,
        timeUsedSeconds,
      });

      // Update attempt answers locally
      setAttempt((prev) => {
        if (!prev) return prev;

        const existingAnswerIndex = prev.answers.findIndex((a) => a.questionId === questionId);
        const updatedAnswers = [...prev.answers];

        if (existingAnswerIndex >= 0) {
          updatedAnswers[existingAnswerIndex] = {
            ...updatedAnswers[existingAnswerIndex],
            selectedIndex,
            textAnswer: null,
            answeredAt: new Date().toISOString(),
          };
        } else {
          updatedAnswers.push({
            questionId,
            selectedIndex,
            textAnswer: null,
            answeredAt: new Date().toISOString(),
          });
        }

        return {
          ...prev,
          answers: updatedAnswers,
        };
      });
    } catch (error) {
      console.error("Error saving answer:", error);
      // Revert local state on error
      setAnswers((prev) => ({ ...prev, [questionId]: answers[questionId] }));
    } finally {
      setAnswerSaving(false);
    }
  };

  const saveShortAnswer = async (questionId: string, text: string) => {
    if (!attemptId || !attempt || attempt.status !== "in_progress") return;

    try {
      setAnswerSaving(true);

      await api.put(`/assessment-attempts/${attemptId}/answer`, {
        questionId,
        textAnswer: text,
        timeUsedSeconds,
      });

      // Update attempt answers locally
      setAttempt((prev) => {
        if (!prev) return prev;

        const existingAnswerIndex = prev.answers.findIndex((a) => a.questionId === questionId);
        const updatedAnswers = [...prev.answers];

        if (existingAnswerIndex >= 0) {
          updatedAnswers[existingAnswerIndex] = {
            ...updatedAnswers[existingAnswerIndex],
            selectedIndex: null,
            textAnswer: text,
            answeredAt: new Date().toISOString(),
          };
        } else {
          updatedAnswers.push({
            questionId,
            selectedIndex: null,
            textAnswer: text,
            answeredAt: new Date().toISOString(),
          });
        }

        return {
          ...prev,
          answers: updatedAnswers,
        };
      });
    } catch (error: any) {
      if (error?.response?.status === 403 && (error?.response?.data?.message || error?.response?.data?.msg) === "Subscription required") {
        setSubscriptionBlocked(true);
      } else {
        console.error("Error saving short answer:", error);
        // leave local text as-is (user shouldn't lose typing)
      }
    } finally {
      setAnswerSaving(false);
    }
  };

  const handleNext = async () => {
    // Best-effort save current short answer before moving on
    const current = items[currentItemIndex];
    if (current?.type === "short") {
      await saveShortAnswer(current._id, shortAnswers[current._id] ?? "");
    }
    setCurrentItemIndex((prev) => Math.min(prev + 1, items.length - 1));
  };

  const handlePrevious = async () => {
    // Best-effort save current short answer before moving on
    const current = items[currentItemIndex];
    if (current?.type === "short") {
      await saveShortAnswer(current._id, shortAnswers[current._id] ?? "");
    }
    setCurrentItemIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async (auto = false) => {
    if (!attemptId || !paperId || submitting) return;

    try {
      setSubmitting(true);
      setAutoSubmitted(auto);

      // FLUSH ALL UNSAVED SHORT ANSWERS BEFORE SUBMITTING
      // Save ALL short answers, not just the current one
      const shortAnswerPromises = Object.entries(shortAnswers).map(([questionId, text]) => {
        if (text.trim() !== "") {
          return saveShortAnswer(questionId, text);
        }
        return Promise.resolve();
      });
      
      await Promise.all(shortAnswerPromises);

      // Submit to backend using the new endpoint
      await api.post(`/assessment-attempts/${attemptId}/submit`, {
        autoSubmitted: auto,
        timeUsedSeconds,
      });

      // Navigate to results
      navigate(`/assessments/papers/${paperId}/results?attemptId=${attemptId}`);
    } catch (error: any) {
      if (error?.response?.status === 403 && (error?.response?.data?.message || error?.response?.data?.msg) === "Subscription required") {
        setSubscriptionBlocked(true);
        setSubmitting(false);
        return;
      }
      console.error("Error submitting attempt:", error);

      let errorMessage = "Failed to submit attempt. Please try again.";
      if (error.response?.status === 410) {
        errorMessage = "Submission method outdated. Please refresh and try again.";
      } else if (error.response?.data?.msg) {
        errorMessage = error.response.data.msg;
      }

      setLoadingError(errorMessage);
      setSubmitting(false);
    }
  };

  const toggleTimer = () => setIsTimerRunning((prev) => !prev);

  const currentItem = items[currentItemIndex];
  const totalItems = items.length;
  const progress = totalItems ? ((currentItemIndex + 1) / totalItems) * 100 : 0;

  if (loading) {
    return (
      <div
        style={{
          padding: "2rem",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
        }}
      >
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📝</div>
        <h2>Loading assessment...</h2>
        <p>Preparing your exam paper</p>
      </div>
    );
  }

  if (subscriptionBlocked) {
    return (
      <div style={{ padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
        <SubscriptionRequired />
      </div>
    );
  }

  if (!attemptId) {
    return (
      <div style={{ padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
        <h2>Missing Attempt</h2>
        <p>No attempt ID provided. Please start the assessment from the beginning.</p>
        <Link to={`/assessments/papers/${paperId}/start`}>← Back to Start Page</Link>
      </div>
    );
  }

  if (loadingError) {
    return (
      <div style={{ padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
        <h2>Error Loading Assessment</h2>
        <p style={{ color: "#dc2626", marginBottom: "1rem" }}>{loadingError}</p>
        <div style={{ display: "flex", gap: "1rem" }}>
          <Link to={`/assessments/papers/${paperId}/start`}>← Back to Start Page</Link>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              background: "white",
              cursor: "pointer",
            }}
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  if (!paper) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>Paper not found</h2>
        <Link to="/assessments">Back to assessments</Link>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>Attempt not found</h2>
        <Link to={`/assessments/papers/${paperId}/start`}>Back to Start Page</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem", maxWidth: "900px", margin: "0 auto", minHeight: "100vh" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ flex: 1 }}>
          <Link
            to={`/assessments/papers/${paperId}/start`}
            style={{
              textDecoration: "none",
              color: "#2563eb",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>←</span> Back to Overview
          </Link>

          <h1 style={{ marginTop: "0.5rem", marginBottom: "0.25rem" }}>{paper.title}</h1>
          <div style={{ opacity: 0.7, fontSize: "0.95rem" }}>
            {paper.subject} • {paper.examBoard} • {paper.level} • Question {currentItemIndex + 1} of {totalItems}
            {answerSaving && " • Saving..."}
          </div>
        </div>

        {/* Timer */}
        <div
          style={{
            textAlign: "center",
            backgroundColor: isTimeCritical ? "#fef2f2" : isTimeLow ? "#fffbeb" : "#f8fafc",
            padding: "0.75rem 1.25rem",
            borderRadius: "10px",
            border: `1px solid ${isTimeCritical ? "#fecaca" : isTimeLow ? "#fde68a" : "#e2e8f0"}`,
            minWidth: "150px",
          }}
        >
          <div
            style={{
              fontSize: "0.85rem",
              opacity: 0.8,
              marginBottom: "0.25rem",
              color: isTimeCritical ? "#dc2626" : isTimeLow ? "#d97706" : "inherit",
            }}
          >
            Time remaining
          </div>

          <div
            style={{
              fontSize: "1.6rem",
              fontWeight: 800,
              color: isTimeCritical ? "#dc2626" : isTimeLow ? "#d97706" : "#0f172a",
              fontFamily: "'Courier New', monospace",
              letterSpacing: "1px",
            }}
          >
            {minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", justifyContent: "center" }}>
            <button
              onClick={toggleTimer}
              style={{
                padding: "0.25rem 0.5rem",
                fontSize: "0.75rem",
                backgroundColor: isTimerRunning ? "#e5e7eb" : "#2563eb",
                color: isTimerRunning ? "#111827" : "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {isTimerRunning ? "⏸️ Pause" : "▶️ Resume"}
            </button>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <span style={{ fontWeight: 700, color: "#0f172a" }}>Progress</span>
          <span style={{ fontWeight: 700, color: "#0f172a" }}>
            {currentItemIndex + 1} / {totalItems}
          </span>
        </div>
        <div style={{ height: "10px", backgroundColor: "#e5e7eb", borderRadius: "999px", overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: "100%", backgroundColor: "#2563eb" }} />
        </div>
      </div>

      {/* Question Card */}
      {currentItem ? (
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "14px",
            padding: "2rem",
            boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
            <div style={{ textAlign: "left" }}>
              <h2 style={{ margin: 0, fontSize: "1.35rem", color: "#0f172a" }}>{currentItem.title}</h2>
            </div>

            <div
              style={{
                padding: "0.35rem 0.75rem",
                backgroundColor: "#f8fafc",
                borderRadius: "8px",
                fontSize: "0.85rem",
                fontWeight: 800,
                color: "#0f172a",
                border: "1px solid #e2e8f0",
                whiteSpace: "nowrap",
              }}
            >
              {(currentItem.marks ?? 1)} mark{(currentItem.marks ?? 1) !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Question text - improved readability */}
          <div
            style={{
              marginBottom: "2.5rem",
              fontSize: "1.35rem",
              lineHeight: "1.75",
              color: "#0f172a",
              textAlign: "left",
              fontWeight: 700,
            }}
          >
            {currentItem.question}
          </div>

          {/* Answer options — MCQ: radio group with labels A, B, C, D, E; selectedIndex stored in answers */}
          {isMcqType(currentItem.type) ? (
            <div style={{ marginTop: "1.25rem" }} role="radiogroup" aria-label="Choose one answer">
              {currentItem.options && currentItem.options.length > 0 ? (
                currentItem.options.map((option, i) => {
                  const selected = answers[currentItem._id] === i;
                  const label = String.fromCharCode(65 + Math.min(i, 25)); // A, B, C, D, E, ...

                  return (
                    <label
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                        padding: "1.25rem 1.25rem",
                        marginBottom: "0.9rem",
                        borderRadius: "12px",
                        border: `2px solid ${selected ? "#1d4ed8" : "#cbd5e1"}`,
                        backgroundColor: selected ? "#eff6ff" : "white",
                        cursor: "pointer",
                        boxShadow: selected ? "0 8px 20px rgba(29,78,216,0.18)" : "0 2px 10px rgba(0,0,0,0.06)",
                        outline: "none",
                      }}
                    >
                      <input
                        type="radio"
                        name={`q-${currentItem._id}`}
                        checked={selected}
                        onChange={() => handleAnswer(currentItem._id, i)}
                        value={i}
                        style={{ width: "22px", height: "22px", flexShrink: 0 }}
                        aria-label={`Option ${label}`}
                      />
                      <span
                        style={{
                          fontWeight: 700,
                          color: "#374151",
                          minWidth: "1.5rem",
                          fontSize: "1.1rem",
                        }}
                      >
                        {label}.
                      </span>
                      <span
                        style={{
                          textAlign: "left",
                          fontSize: "1.25rem",
                          lineHeight: 1.6,
                          fontWeight: 600,
                          color: "#0f172a",
                          flex: 1,
                        }}
                      >
                        {option}
                      </span>
                    </label>
                  );
                })
              ) : (
                <div
                  style={{
                    padding: "1.5rem",
                    backgroundColor: "#f8fafc",
                    borderRadius: "10px",
                    textAlign: "center",
                    color: "#64748b",
                  }}
                >
                  This multiple-choice question has no options defined.
                </div>
              )}
            </div>
          ) : currentItem.type === "short" ? (
            <div style={{ marginTop: "1.25rem" }}>
              <textarea
                placeholder="Type your answer here..."
                value={shortAnswers[currentItem._id] ?? ""}
                onChange={(e) => handleShortAnswerChange(currentItem._id, e.target.value)}
                onBlur={() => saveShortAnswer(currentItem._id, shortAnswers[currentItem._id] ?? "")}
                style={{
                  width: "100%",
                  minHeight: "140px",
                  padding: "1rem",
                  fontSize: "1.1rem",
                  borderRadius: "10px",
                  border: "2px solid #cbd5e1",
                  outline: "none",
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
              <div
                style={{
                  marginTop: "0.5rem",
                  fontSize: "0.85rem",
                  color: "#64748b",
                  fontStyle: "italic",
                }}
              >
                Your short answer is saved automatically.
              </div>
            </div>
          ) : (
            <div style={{ marginTop: "1.25rem" }}>
              <div
                style={{
                  padding: "1.5rem",
                  backgroundColor: "#f8fafc",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: "0.5rem", color: "#0f172a" }}>
                  Question Type: {currentItem.type}
                </div>
                <p style={{ color: "#64748b" }}>
                  This question type requires a different answer format. Please contact your teacher for instructions.
                </p>
              </div>
            </div>
          )}

          {/* Nav buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.25rem" }}>
            <button
              onClick={handlePrevious}
              disabled={currentItemIndex === 0}
              style={{
                padding: "0.75rem 1.25rem",
                backgroundColor: currentItemIndex === 0 ? "#e5e7eb" : "#2563eb",
                color: currentItemIndex === 0 ? "#9ca3af" : "white",
                border: "none",
                borderRadius: "10px",
                cursor: currentItemIndex === 0 ? "not-allowed" : "pointer",
                fontWeight: 800,
              }}
            >
              ← Previous
            </button>

            {currentItemIndex < totalItems - 1 ? (
              <button
                onClick={handleNext}
                style={{
                  padding: "0.75rem 1.25rem",
                  backgroundColor: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                Next →
              </button>
            ) : (
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                style={{
                  padding: "0.75rem 1.25rem",
                  backgroundColor: submitting ? "#94a3b8" : "#16a34a",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  cursor: submitting ? "not-allowed" : "pointer",
                  fontWeight: 800,
                }}
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h3>No questions available</h3>
          <Link to={`/assessments/papers/${paperId}/start`}>Return to Overview</Link>
        </div>
      )}
    </div>
  );
};

export default AssessmentPaperAttemptPage;