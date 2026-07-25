/**
 * Actionable Revision Flow: Quiz session by topic.
 * Route: /practice/quiz/:topicKey
 * Fresh V1: ?practiceSetId= resumes; ?fresh=1&idempotencyKey= creates once (Strict Mode safe).
 *
 * When practiceSetId is present: load GET /practice-sets/:id only (no dashboard / teacher-link gate).
 * When absent: ordinary dashboard practice still requires a linked teacher.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { PracticeRunner } from "../components/practice/PracticeRunner";
import {
  fetchFreshAvailability,
  generatePracticeSet,
  getPracticeSet,
  type PracticePriorOutcome,
  type PracticeSetItem,
} from "../api/practiceSets";
import { getStudentDashboard } from "../api/studentDashboard";
import { runSingleFlight } from "../utils/freshPracticeSingleFlight";
import {
  createFreshPracticeIdempotencyKey,
  newClientRequestId,
} from "../utils/lessonPracticeProgress";
import { getApiClientErrorMessage, getHttpStatus } from "../utils/apiErrorMessage";
import {
  allItemsAttempted,
  firstUnansweredIndex,
} from "../utils/practicePriorOutcomes";
import "../components/practice/focusedPractice.css";

const DEFAULT_SPEC = "aqa-gcse-biology";

function normalizeTopicKey(topicKey: string, specKey: string): string {
  const k = (topicKey || "").trim();
  if (!k) return "";
  if (k.includes(":")) return k;
  return `${specKey}:${k}`;
}

/** Human-readable topic leaf for student-facing headers. */
export function topicKeyToTitle(topicKey: string): string {
  const last = (topicKey || "").split(":");
  const leaf = last[last.length - 1];
  if (!leaf) return topicKey || "";
  return leaf
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAnd\b/g, "&");
}

function practiceSetLoadErrorMessage(e: unknown): string {
  const status = getHttpStatus(e);
  if (status === 403) {
    return "You do not have access to this practice set.";
  }
  if (status === 404 || status === 400) {
    return "This practice set is no longer available.";
  }
  return getApiClientErrorMessage(e, "Failed to load practice set");
}

function FocusedPracticeShell({
  backLessonId,
  children,
}: {
  backLessonId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fp-shell" data-testid="focused-practice-shell">
      <div className="fp-shell__inner">
        <Link
          to={backLessonId ? `/lesson/${backLessonId}` : "/student/my-progress"}
          className="fp-back"
        >
          {backLessonId ? "← Back to lesson" : "← Back to Progress"}
        </Link>
        {children}
      </div>
    </div>
  );
}

export default function QuizSessionPage() {
  const { topicKey: topicKeyParam } = useParams<{ topicKey: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<PracticeSetItem[]>([]);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  /** Frozen set currently loaded — sent on attempt submit for item-level auth. */
  const [loadedPracticeSetId, setLoadedPracticeSetId] = useState<string | null>(null);
  /** Prefer server-returned lessonId over URL when available. */
  const [lessonIdFromSet, setLessonIdFromSet] = useState<string | null>(null);
  const [priorOutcomes, setPriorOutcomes] = useState<PracticePriorOutcome[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [tryAnotherAvailable, setTryAnotherAvailable] = useState(false);
  const [tryAnotherBusy, setTryAnotherBusy] = useState(false);
  const loadGenRef = useRef(0);

  const topicKey = topicKeyParam || "";
  const practiceSetIdParam = searchParams.get("practiceSetId") || "";
  const freshMode = searchParams.get("fresh") === "1";
  const lessonIdParam = searchParams.get("lessonId") || "";
  const backLessonId = lessonIdFromSet || lessonIdParam || "";
  const limitParam = Math.min(30, Math.max(1, parseInt(searchParams.get("limit") || "5", 10) || 5));
  const idempotencyKeyParam = searchParams.get("idempotencyKey") || "";
  const startIndexParam = Math.max(0, parseInt(searchParams.get("startIndex") || "0", 10) || 0);
  const activePracticeSetId = loadedPracticeSetId || practiceSetIdParam || null;
  const topicTitle = topicKeyToTitle(topicKey);

  const load = useCallback(async () => {
    if (!topicKey) return;
    const gen = ++loadGenRef.current;
    setLoading(true);
    setError(null);
    setSessionComplete(false);
    setTryAnotherAvailable(false);
    try {
      // Resume existing frozen set: owner-only GET, no dashboard / StudentTeacherLink gate.
      if (practiceSetIdParam) {
        const res = await getPracticeSet(practiceSetIdParam);
        if (gen !== loadGenRef.current) return;
        const tid = res.teacherId ? String(res.teacherId) : "";
        if (!tid) {
          setError("This practice set could not be opened.");
          setItems([]);
          setTeacherId(null);
          setLoadedPracticeSetId(null);
          setPriorOutcomes([]);
          return;
        }
        setTeacherId(tid);
        setLoadedPracticeSetId(String(res.practiceSetId || practiceSetIdParam));
        if (res.lessonId) setLessonIdFromSet(String(res.lessonId));
        const loadedItems = res.items || [];
        const priors = Array.isArray(res.priorOutcomes) ? res.priorOutcomes : [];
        setItems(loadedItems);
        setPriorOutcomes(priors);
        const complete =
          res.allItemsAttempted === true || allItemsAttempted(loadedItems, priors);
        let startIdx = startIndexParam;
        if (complete) {
          startIdx = 0;
        } else if (priors.length > 0 || typeof res.resumeStartIndex === "number") {
          startIdx =
            typeof res.resumeStartIndex === "number" && Number.isFinite(res.resumeStartIndex)
              ? Math.max(0, Math.floor(res.resumeStartIndex))
              : firstUnansweredIndex(loadedItems, priors);
        }
        setSessionComplete(complete);
        setActiveIndex(
          complete ? 0 : Math.min(startIdx, Math.max(0, loadedItems.length - 1))
        );
        return;
      }

      const dash = await getStudentDashboard({ specKey: DEFAULT_SPEC });
      if (gen !== loadGenRef.current) return;
      const sk = dash?.studyPlan?.specKey || DEFAULT_SPEC;
      const linked = dash?.linkedTeachers ?? [];
      const firstTeacher = linked[0];
      if (!firstTeacher?.teacherId) {
        setError("Link to a teacher to access quiz practice. Ask your teacher to add you.");
        setItems([]);
        return;
      }
      setTeacherId(firstTeacher.teacherId);
      const nk = normalizeTopicKey(topicKey, sk);

      if (freshMode && !idempotencyKeyParam) {
        const generatedKey = createFreshPracticeIdempotencyKey({
          topicKey: nk || topicKey,
          lessonId: lessonIdParam,
          clientRequestId: newClientRequestId(),
        });
        const next = new URLSearchParams(searchParams);
        next.set("fresh", "1");
        next.set("idempotencyKey", generatedKey);
        next.set("limit", String(limitParam));
        if (lessonIdParam) next.set("lessonId", lessonIdParam);
        setSearchParams(next, { replace: true });
        return;
      }

      const flightKey =
        freshMode && idempotencyKeyParam
          ? idempotencyKeyParam
          : `legacy-generate:${nk || topicKey}:${firstTeacher.teacherId}`;

      const res = await runSingleFlight(flightKey, () =>
        generatePracticeSet({
          teacherId: firstTeacher.teacherId,
          specKey: sk,
          topicKeys: [nk || topicKey],
          limit: freshMode ? limitParam : 10,
          include: ["quiz_mcq", "quiz_short"],
          excludeSeen: freshMode,
          lessonId: freshMode && lessonIdParam ? lessonIdParam : undefined,
          idempotencyKey: freshMode ? idempotencyKeyParam : undefined,
          source: freshMode ? "fresh-practice" : undefined,
        })
      );
      if (gen !== loadGenRef.current) return;

      const selected = res.selectedCount ?? (res.items || []).length;
      setItems(res.items || []);
      setPriorOutcomes([]);
      setActiveIndex(0);
      if (res.practiceSetId) setLoadedPracticeSetId(String(res.practiceSetId));

      if (res.practiceSetId) {
        const next = new URLSearchParams(searchParams);
        next.set("practiceSetId", String(res.practiceSetId));
        if (freshMode) next.set("fresh", "1");
        if (lessonIdParam) next.set("lessonId", lessonIdParam);
        if (idempotencyKeyParam) next.set("idempotencyKey", idempotencyKeyParam);
        next.set("limit", String(selected || (freshMode ? limitParam : 10)));
        setSearchParams(next, { replace: true });
      }
    } catch (e: unknown) {
      if (gen !== loadGenRef.current) return;
      if (practiceSetIdParam) {
        setError(practiceSetLoadErrorMessage(e));
      } else {
        setError(getApiClientErrorMessage(e, "Failed to load quiz"));
      }
      setItems([]);
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, [
    topicKey,
    practiceSetIdParam,
    freshMode,
    lessonIdParam,
    limitParam,
    idempotencyKeyParam,
    startIndexParam,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicKey, practiceSetIdParam, freshMode, lessonIdParam, limitParam, idempotencyKeyParam]);

  const handleReturnToLesson = useCallback(() => {
    getStudentDashboard({ specKey: DEFAULT_SPEC }).catch(() => {});
    navigate(backLessonId ? `/lesson/${backLessonId}` : "/student/my-progress", { replace: true });
  }, [navigate, backLessonId]);

  const handleResultsReady = useCallback(async () => {
    setSessionComplete(true);
    setTryAnotherAvailable(false);
    if (!backLessonId || !topicKey) return;
    try {
      const specKey = topicKey.includes(":") ? topicKey.split(":")[0] : DEFAULT_SPEC;
      const avail = await fetchFreshAvailability({
        specKey,
        topicKey,
        lessonId: backLessonId,
        limit: limitParam,
        include: ["quiz_mcq", "quiz_short"],
      });
      setTryAnotherAvailable((avail.availableFreshCount ?? 0) > 0);
    } catch {
      setTryAnotherAvailable(false);
    }
  }, [backLessonId, topicKey, limitParam]);

  const handleTryAnotherSet = useCallback(async () => {
    if (!topicKey || !backLessonId || tryAnotherBusy) return;
    setTryAnotherBusy(true);
    try {
      const specKey = topicKey.includes(":") ? topicKey.split(":")[0] : DEFAULT_SPEC;
      const idempotencyKey = createFreshPracticeIdempotencyKey({
        topicKey,
        lessonId: backLessonId,
        clientRequestId: newClientRequestId(),
      });
      const res = await generatePracticeSet({
        specKey,
        topicKeys: [topicKey],
        limit: limitParam,
        include: ["quiz_mcq", "quiz_short"],
        excludeSeen: true,
        lessonId: backLessonId,
        idempotencyKey,
        source: "fresh-practice",
      });
      const selected = res.selectedCount ?? (res.items || []).length;
      if (!res.practiceSetId || selected <= 0) {
        setTryAnotherAvailable(false);
        return;
      }
      const params = new URLSearchParams();
      params.set("practiceSetId", String(res.practiceSetId));
      params.set("fresh", "1");
      params.set("limit", String(selected));
      params.set("idempotencyKey", idempotencyKey);
      params.set("lessonId", backLessonId);
      navigate(`/practice/quiz/${encodeURIComponent(topicKey)}?${params.toString()}`, {
        replace: true,
      });
    } catch {
      setTryAnotherAvailable(false);
    } finally {
      setTryAnotherBusy(false);
    }
  }, [topicKey, backLessonId, limitParam, navigate, tryAnotherBusy]);

  const handleIndexChange = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  if (!topicKey) {
    return (
      <FocusedPracticeShell backLessonId="">
        <p className="fp-error">Invalid topic. Topic key is required.</p>
      </FocusedPracticeShell>
    );
  }

  if (loading) {
    return (
      <FocusedPracticeShell backLessonId={backLessonId}>
        <p className="fp-copy" style={{ marginTop: 16 }}>
          {freshMode ? "Preparing questions…" : "Loading quiz…"}
        </p>
      </FocusedPracticeShell>
    );
  }

  if (error) {
    return (
      <FocusedPracticeShell backLessonId={backLessonId}>
        <div className="fp-alert">
          <p>{error}</p>
          <button
            type="button"
            className="fp-btn fp-btn--secondary"
            style={{ marginTop: 12 }}
            onClick={() => {
              setError(null);
              load();
            }}
          >
            Try again
          </button>
        </div>
      </FocusedPracticeShell>
    );
  }

  if (items.length === 0) {
    return (
      <FocusedPracticeShell backLessonId={backLessonId}>
        <div className="fp-empty">
          <p>
            {freshMode
              ? "No new questions available. Review your practice on the lesson."
              : "No quiz questions available for this topic yet."}
          </p>
          {backLessonId ? (
            <Link to={`/lesson/${backLessonId}`} className="fp-back" style={{ marginTop: 12 }}>
              Review your practice
            </Link>
          ) : null}
        </div>
      </FocusedPracticeShell>
    );
  }

  const total = items.length;
  const questionNumber = Math.min(activeIndex + 1, total);
  // Includes the current unanswered item (Q2 of 5 → 4 remaining).
  const remaining = Math.max(0, total - activeIndex);
  const progressPct = total > 0 ? Math.round((questionNumber / total) * 100) : 0;
  // Resume CTA omits idempotencyKey; newly generated fresh sets include one.
  const isResumeSession = Boolean(practiceSetIdParam) && !idempotencyKeyParam;

  return (
    <FocusedPracticeShell backLessonId={backLessonId}>
      {!sessionComplete ? (
        <header className="fp-header" data-testid="focused-practice-header">
          <p className="fp-eyebrow">Focused practice</p>
          <h1 className="fp-title" data-testid="focused-practice-title">
            {topicTitle}
          </h1>
          <p className="fp-copy" data-testid="focused-practice-copy">
            {isResumeSession
              ? "Continue where you left off."
              : "Practise this topic with a fresh set of questions."}
          </p>

          <div className="fp-progress-row">
            <p className="fp-progress-label" data-testid="focused-practice-progress-label">
              Question {questionNumber} of {total}
            </p>
            <p className="fp-remaining" data-testid="focused-practice-remaining">
              {remaining} question{remaining === 1 ? "" : "s"} remaining
            </p>
          </div>
          <div
            className="fp-progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={questionNumber}
            aria-label={`Question ${questionNumber} of ${total}`}
            data-testid="focused-practice-progress-bar"
          >
            <div className="fp-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </header>
      ) : null}

      <PracticeRunner
        items={items}
        teacherId={teacherId!}
        practiceSetId={activePracticeSetId}
        initialIndex={
          practiceSetIdParam
            ? priorOutcomes.length > 0
              ? firstUnansweredIndex(items, priorOutcomes) >= items.length
                ? 0
                : firstUnansweredIndex(items, priorOutcomes)
              : startIndexParam
            : 0
        }
        priorOutcomes={priorOutcomes}
        onIndexChange={handleIndexChange}
        onResultsReady={handleResultsReady}
        onReturnToLesson={handleReturnToLesson}
        tryAnotherSetAvailable={tryAnotherAvailable}
        onTryAnotherSet={handleTryAnotherSet}
        tryAnotherSetBusy={tryAnotherBusy}
      />
    </FocusedPracticeShell>
  );
}
