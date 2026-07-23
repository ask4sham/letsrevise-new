/**
 * Contextual fresh-practice CTA after Revision practice quiz completion.
 * Lesson-scoped: server resolves lesson owner after verifying lesson access.
 * Mount after a perfect Revision finish; renders nothing when availableFreshCount is zero.
 */
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchFreshAvailability, generatePracticeSet } from "../../api/practiceSets";
import { runSingleFlight } from "../../utils/freshPracticeSingleFlight";
import {
  createFreshPracticeIdempotencyKey,
  newClientRequestId,
} from "../../utils/lessonPracticeProgress";
import type { RevisionQuizSessionExclusions } from "../../utils/revisionQuizFreshExclusions";

type Props = {
  lessonId?: string | null;
  specKey: string;
  topicKey: string;
  /** Server-enforced exclusions for the just-finished Revision quiz. */
  sessionExclusions?: RevisionQuizSessionExclusions | null;
};

export function TryFreshPracticeCta({
  lessonId,
  specKey,
  topicKey,
  sessionExclusions,
}: Props) {
  const navigate = useNavigate();
  const [freshCount, setFreshCount] = useState(0);
  const [requestedCount, setRequestedCount] = useState(5);
  const [ready, setReady] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const exclusionKey = JSON.stringify({
    contentKeys: sessionExclusions?.contentKeys || [],
    stemTexts: sessionExclusions?.stemTexts || [],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReady(false);
      const lid = String(lessonId || "").trim();
      if (!lid || !specKey || !topicKey) {
        if (!cancelled) {
          setFreshCount(0);
          setReady(true);
        }
        return;
      }
      try {
        const avail = await fetchFreshAvailability({
          specKey,
          topicKey,
          lessonId: lid,
          limit: 5,
          include: ["quiz_mcq", "quiz_short"],
          sessionExclusions: sessionExclusions || undefined,
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
    // exclusionKey captures sessionExclusions contents
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey, topicKey, lessonId, exclusionKey]);

  const nNew = Math.min(freshCount || 0, requestedCount || 5);

  const handleTryNew = async () => {
    const lid = String(lessonId || "").trim();
    if (!lid || !specKey || !topicKey || preparing || inFlightRef.current) return;
    if (nNew <= 0) return;
    setPreparing(true);
    setError(null);
    inFlightRef.current = true;
    const clientRequestId = newClientRequestId();
    const idempotencyKey = createFreshPracticeIdempotencyKey({
      topicKey,
      lessonId: lid,
      clientRequestId,
    });
    try {
      const res = await runSingleFlight(idempotencyKey, () =>
        generatePracticeSet({
          specKey,
          topicKeys: [topicKey.includes(":") ? topicKey : `${specKey}:${topicKey}`],
          limit: requestedCount,
          include: ["quiz_mcq", "quiz_short"],
          excludeSeen: true,
          lessonId: lid,
          idempotencyKey,
          source: "fresh-practice",
          sessionExclusions: sessionExclusions || undefined,
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
      params.set("lessonId", lid);
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
    <div style={{ marginTop: 4 }} data-testid="try-fresh-practice-wrap">
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
          : "Try another set"}
      </button>
      {error ? (
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#b91c1c" }} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
