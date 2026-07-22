/**
 * Actionable Revision Flow: Quiz session by topic.
 * Route: /practice/quiz/:topicKey
 * Fresh V1: ?practiceSetId= resumes; ?fresh=1&idempotencyKey= creates once (Strict Mode safe).
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

const DEFAULT_SPEC = "aqa-gcse-biology";

function normalizeTopicKey(topicKey: string, specKey: string): string {
  const k = (topicKey || "").trim();
  if (!k) return "";
  if (k.includes(":")) return k;
  return `${specKey}:${k}`;
}

function topicKeyToTitle(topicKey: string): string {
  const last = (topicKey || "").split(":").pop();
  return last ? last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : topicKey || "";
}

export default function QuizSessionPage() {
  const { topicKey: topicKeyParam } = useParams<{ topicKey: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<PracticeSetItem[]>([]);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [freshMeta, setFreshMeta] = useState<{
    requestedCount: number;
    availableFreshCount: number;
    selectedCount: number;
    allQuestionsFresh: boolean;
  } | null>(null);
  const loadGenRef = useRef(0);

  const topicKey = topicKeyParam || "";
  const practiceSetIdParam = searchParams.get("practiceSetId") || "";
  const freshMode = searchParams.get("fresh") === "1";
  const lessonIdParam = searchParams.get("lessonId") || "";
  const limitParam = Math.min(30, Math.max(1, parseInt(searchParams.get("limit") || "5", 10) || 5));
  const idempotencyKeyParam = searchParams.get("idempotencyKey") || "";

  const load = useCallback(async () => {
    if (!topicKey) return;
    const gen = ++loadGenRef.current;
    setLoading(true);
    setError(null);
    try {
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

      if (practiceSetIdParam) {
        const res = await getPracticeSet(practiceSetIdParam);
        if (gen !== loadGenRef.current) return;
        setItems(res.items || []);
        const selected = res.selectedCount ?? (res.items || []).length;
        setFreshMeta({
          requestedCount: res.requestedCount ?? selected,
          availableFreshCount: res.availableFreshCount ?? selected,
          selectedCount: selected,
          allQuestionsFresh: res.allQuestionsFresh !== false,
        });
        return;
      }

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
      setFreshMeta({
        requestedCount: res.requestedCount ?? (freshMode ? limitParam : 10),
        availableFreshCount: res.availableFreshCount ?? selected,
        selectedCount: selected,
        allQuestionsFresh: !!res.allQuestionsFresh,
      });

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
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err?.response?.data?.error || err?.message || "Failed to load quiz");
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
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicKey, practiceSetIdParam, freshMode, lessonIdParam, limitParam, idempotencyKeyParam]);

  const handleAnotherSet = useCallback(async () => {
    if (!teacherId || !topicKey || loading) return;
    setLoading(true);
    setError(null);
    const clientRequestId = newClientRequestId();
    const idempotencyKey = createFreshPracticeIdempotencyKey({
      topicKey,
      lessonId: lessonIdParam,
      clientRequestId,
    });
    try {
      const dash = await getStudentDashboard({ specKey: DEFAULT_SPEC });
      const sk = dash?.studyPlan?.specKey || DEFAULT_SPEC;
      const nk = normalizeTopicKey(topicKey, sk);
      const res = await runSingleFlight(idempotencyKey, () =>
        generatePracticeSet({
          teacherId,
          specKey: sk,
          topicKeys: [nk || topicKey],
          limit: limitParam,
          include: ["quiz_mcq", "quiz_short"],
          excludeSeen: true,
          lessonId: lessonIdParam || undefined,
          idempotencyKey,
          source: "fresh-practice",
        })
      );
      const selected = res.selectedCount ?? (res.items || []).length;
      if (!res.practiceSetId || selected <= 0) {
        setItems([]);
        setFreshMeta({
          requestedCount: res.requestedCount ?? limitParam,
          availableFreshCount: 0,
          selectedCount: 0,
          allQuestionsFresh: true,
        });
        return;
      }
      setItems(res.items || []);
      setFreshMeta({
        requestedCount: res.requestedCount ?? limitParam,
        availableFreshCount: res.availableFreshCount ?? selected,
        selectedCount: selected,
        allQuestionsFresh: true,
      });
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("practiceSetId", String(res.practiceSetId));
          next.set("fresh", "1");
          next.set("limit", String(selected));
          next.set("idempotencyKey", idempotencyKey);
          if (lessonIdParam) next.set("lessonId", lessonIdParam);
          return next;
        },
        { replace: true }
      );
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err?.response?.data?.error || err?.message || "Failed to load another set");
    } finally {
      setLoading(false);
    }
  }, [teacherId, topicKey, limitParam, lessonIdParam, loading, setSearchParams]);

  const handleComplete = useCallback(() => {
    getStudentDashboard({ specKey: DEFAULT_SPEC }).catch(() => {});
    navigate(lessonIdParam ? `/lesson/${lessonIdParam}` : "/student/my-progress", { replace: true });
  }, [navigate, lessonIdParam]);

  if (!topicKey) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Link to="/student/my-progress" className="text-indigo-600 hover:underline">
          ← Back to Progress
        </Link>
        <p className="mt-4 text-red-600">Invalid topic. Topic key is required.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Link
          to={lessonIdParam ? `/lesson/${lessonIdParam}` : "/student/my-progress"}
          className="text-indigo-600 hover:underline"
        >
          {lessonIdParam ? "← Back to lesson" : "← Back to Progress"}
        </Link>
        <p className="mt-4 text-gray-600">
          {freshMode ? "Preparing questions…" : "Loading quiz…"}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Link
          to={lessonIdParam ? `/lesson/${lessonIdParam}` : "/student/my-progress"}
          className="text-indigo-600 hover:underline"
        >
          {lessonIdParam ? "← Back to lesson" : "← Back to Progress"}
        </Link>
        <div className="mt-4 p-4 border border-amber-200 bg-amber-50 rounded-lg">
          <p className="text-amber-800">{error}</p>
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
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Link
          to={lessonIdParam ? `/lesson/${lessonIdParam}` : "/student/my-progress"}
          className="text-indigo-600 hover:underline"
        >
          {lessonIdParam ? "← Back to lesson" : "← Back to Progress"}
        </Link>
        <div className="mt-4 p-4 border border-gray-200 rounded-lg">
          <p className="text-gray-700">
            {freshMode
              ? "No new questions available. Review your practice on the lesson."
              : "No quiz questions available for this topic yet."}
          </p>
          {lessonIdParam ? (
            <Link
              to={`/lesson/${lessonIdParam}`}
              className="inline-block mt-3 text-indigo-600 hover:underline text-sm font-semibold"
            >
              Review your practice
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  const showFreshLabel =
    freshMode &&
    freshMeta?.allQuestionsFresh &&
    (freshMeta.selectedCount ?? items.length) > 0;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <Link
          to={lessonIdParam ? `/lesson/${lessonIdParam}` : "/student/my-progress"}
          className="text-indigo-600 hover:underline"
        >
          {lessonIdParam ? "← Back to lesson" : "← Back to Progress"}
        </Link>
        <span className="text-sm text-gray-500">{topicKeyToTitle(topicKey)}</span>
      </div>
      {showFreshLabel ? (
        <p className="mb-3 text-sm font-semibold text-emerald-800">
          {items.length} new question{items.length === 1 ? "" : "s"} available
          {freshMeta && freshMeta.requestedCount > items.length
            ? ` (${freshMeta.requestedCount} requested)`
            : ""}
        </p>
      ) : null}
      <PracticeRunner items={items} teacherId={teacherId!} onComplete={handleComplete} />
      {freshMode ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={handleAnotherSet}
            disabled={loading}
            className="text-sm font-semibold text-indigo-700 hover:underline disabled:opacity-50"
          >
            Try another set
          </button>
        </div>
      ) : null}
    </div>
  );
}
