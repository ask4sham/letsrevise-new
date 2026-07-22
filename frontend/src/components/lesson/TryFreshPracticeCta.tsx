/**
 * Contextual fresh-practice action inside dedicated lesson PracticeSection.
 * Mount only when dedicated practice is completed; renders nothing when
 * availableFreshCount is zero.
 */
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchFreshAvailability, generatePracticeSet } from "../../api/practiceSets";
import { getStudentDashboard } from "../../api/studentDashboard";
import { runSingleFlight } from "../../utils/freshPracticeSingleFlight";
import {
  createFreshPracticeIdempotencyKey,
  newClientRequestId,
} from "../../utils/lessonPracticeProgress";

type Props = {
  lessonId?: string | null;
  specKey: string;
  topicKey: string;
};

export function TryFreshPracticeCta({ lessonId, specKey, topicKey }: Props) {
  const navigate = useNavigate();
  const [freshCount, setFreshCount] = useState(0);
  const [requestedCount, setRequestedCount] = useState(5);
  const [ready, setReady] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReady(false);
      try {
        const dash = await getStudentDashboard({ specKey });
        const teacherId = dash?.linkedTeachers?.[0]?.teacherId;
        if (!teacherId) {
          if (!cancelled) {
            setFreshCount(0);
            setReady(true);
          }
          return;
        }
        const avail = await fetchFreshAvailability({
          teacherId,
          specKey,
          topicKey,
          lessonId: lessonId || undefined,
          limit: 5,
          include: ["quiz_mcq", "quiz_short"],
        });
        if (cancelled) return;
        setFreshCount(avail.availableFreshCount ?? 0);
        setRequestedCount(avail.requestedCount ?? 5);
      } catch {
        if (!cancelled) setFreshCount(0);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [specKey, topicKey, lessonId]);

  const nNew = Math.min(freshCount || 0, requestedCount || 5);

  const handleTryNew = async () => {
    if (!specKey || !topicKey || preparing || inFlightRef.current) return;
    if (nNew <= 0) return;
    setPreparing(true);
    setError(null);
    inFlightRef.current = true;
    const clientRequestId = newClientRequestId();
    const idempotencyKey = createFreshPracticeIdempotencyKey({
      topicKey,
      lessonId,
      clientRequestId,
    });
    try {
      const dash = await getStudentDashboard({ specKey });
      const teacherId = dash?.linkedTeachers?.[0]?.teacherId;
      if (!teacherId) {
        setError("Link to a teacher to start fresh practice.");
        return;
      }
      const res = await runSingleFlight(idempotencyKey, () =>
        generatePracticeSet({
          teacherId,
          specKey,
          topicKeys: [topicKey.includes(":") ? topicKey : `${specKey}:${topicKey}`],
          limit: requestedCount,
          include: ["quiz_mcq", "quiz_short"],
          excludeSeen: true,
          lessonId: lessonId || undefined,
          idempotencyKey,
          source: "fresh-practice",
        })
      );
      const selected = res.selectedCount ?? (res.items || []).length;
      if (!res.practiceSetId || selected <= 0) {
        setFreshCount(0);
        setError(null);
        return;
      }
      const params = new URLSearchParams();
      params.set("practiceSetId", String(res.practiceSetId));
      params.set("fresh", "1");
      params.set("limit", String(selected));
      params.set("idempotencyKey", idempotencyKey);
      if (lessonId) params.set("lessonId", lessonId);
      navigate(`/practice/quiz/${encodeURIComponent(topicKey)}?${params.toString()}`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err?.response?.data?.error || err?.message || "Could not prepare questions");
    } finally {
      inFlightRef.current = false;
      setPreparing(false);
    }
  };

  if (!ready || nNew <= 0) {
    if (error) {
      return (
        <p style={{ margin: "12px 0 0", fontSize: 13, color: "#b91c1c" }} role="alert">
          {error}
        </p>
      );
    }
    return null;
  }

  return (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        onClick={handleTryNew}
        disabled={preparing}
        data-testid="try-fresh-practice"
        style={{
          padding: "8px 16px",
          fontSize: 14,
          fontWeight: 600,
          background: preparing ? "#93c5fd" : "#2563eb",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: preparing ? "not-allowed" : "pointer",
        }}
      >
        {preparing
          ? "Preparing questions…"
          : `Try ${nNew} new question${nNew === 1 ? "" : "s"}`}
      </button>
      {error ? (
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#b91c1c" }} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
