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
  generatePracticeSet,
  getPracticeSet,
  type PracticeSetItem,
} from "../api/practiceSets";
import { getStudentDashboard } from "../api/studentDashboard";
import { runSingleFlight } from "../utils/freshPracticeSingleFlight";
import {
  createFreshPracticeIdempotencyKey,
  newClientRequestId,
} from "../utils/lessonPracticeProgress";
import { getApiClientErrorMessage, getHttpStatus } from "../utils/apiErrorMessage";

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
    <div
      className="min-h-[70vh] bg-slate-50"
      data-testid="focused-practice-shell"
    >
      <div className="mx-auto w-full max-w-[960px] px-4 py-6 sm:px-6 sm:py-10">
        <Link
          to={backLessonId ? `/lesson/${backLessonId}` : "/student/my-progress"}
          className="inline-flex items-center text-sm font-semibold text-indigo-700 hover:text-indigo-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded"
        >
          {backLessonId ? "← Back to lesson" : "← Back to Progress"}
        </Link>
        <div className="mt-5">{children}</div>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
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
          return;
        }
        setTeacherId(tid);
        setLoadedPracticeSetId(String(res.practiceSetId || practiceSetIdParam));
        if (res.lessonId) setLessonIdFromSet(String(res.lessonId));
        setItems(res.items || []);
        setActiveIndex(startIndexParam);
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

  const handleComplete = useCallback(() => {
    getStudentDashboard({ specKey: DEFAULT_SPEC }).catch(() => {});
    // Existing behaviour: final question returns to the lesson (no in-page another-set gate).
    navigate(backLessonId ? `/lesson/${backLessonId}` : "/student/my-progress", { replace: true });
  }, [navigate, backLessonId]);

  const handleIndexChange = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  if (!topicKey) {
    return (
      <FocusedPracticeShell backLessonId="">
        <p className="mt-4 text-rose-700">Invalid topic. Topic key is required.</p>
      </FocusedPracticeShell>
    );
  }

  if (loading) {
    return (
      <FocusedPracticeShell backLessonId={backLessonId}>
        <p className="mt-2 text-slate-600">
          {freshMode ? "Preparing questions…" : "Loading quiz…"}
        </p>
      </FocusedPracticeShell>
    );
  }

  if (error) {
    return (
      <FocusedPracticeShell backLessonId={backLessonId}>
        <div className="mt-2 p-5 border border-amber-200 bg-amber-50 rounded-2xl">
          <p className="text-amber-900">{error}</p>
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-indigo-700 hover:underline"
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
        <div className="mt-2 p-5 border border-slate-200 bg-white rounded-2xl shadow-sm">
          <p className="text-slate-700">
            {freshMode
              ? "No new questions available. Review your practice on the lesson."
              : "No quiz questions available for this topic yet."}
          </p>
          {backLessonId ? (
            <Link
              to={`/lesson/${backLessonId}`}
              className="inline-block mt-3 text-indigo-700 hover:underline text-sm font-semibold"
            >
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
      <header
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm mb-5"
        data-testid="focused-practice-header"
      >
        <p className="text-xs font-bold tracking-[0.08em] text-indigo-700 uppercase mb-2">
          Focused practice
        </p>
        <h1
          className="text-2xl sm:text-[1.75rem] font-bold text-slate-900 leading-tight"
          data-testid="focused-practice-title"
        >
          {topicTitle}
        </h1>
        <p
          className="mt-2 text-sm text-slate-600"
          data-testid="focused-practice-copy"
        >
          {isResumeSession
            ? "Continue where you left off."
            : "Practise this topic with a fresh set of questions."}
        </p>

        <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
          <p
            className="text-sm font-semibold text-slate-800"
            data-testid="focused-practice-progress-label"
          >
            Question {questionNumber} of {total}
          </p>
          <p className="text-sm text-slate-500" data-testid="focused-practice-remaining">
            {remaining} question{remaining === 1 ? "" : "s"} remaining
          </p>
        </div>
        <div
          className="mt-2 h-2.5 w-full rounded-full bg-slate-100 overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={questionNumber}
          aria-label={`Question ${questionNumber} of ${total}`}
          data-testid="focused-practice-progress-bar"
        >
          <div
            className="h-full rounded-full bg-indigo-600 transition-[width] duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      <PracticeRunner
        items={items}
        teacherId={teacherId!}
        practiceSetId={activePracticeSetId}
        initialIndex={practiceSetIdParam ? startIndexParam : 0}
        onIndexChange={handleIndexChange}
        onComplete={handleComplete}
      />
    </FocusedPracticeShell>
  );
}
