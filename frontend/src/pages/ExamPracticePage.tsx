/**
 * Actionable Revision Flow: Exam practice by topic.
 * Route: /practice/exam/:topicKey
 * Optional ?mode=challenge for Higher Tier challenge questions V1.
 * Uses generatePracticeSet with exam_question, past_paper_question.
 * Records via practice-attempts (LearningEvidenceEvent).
 */
import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { PracticeRunner } from "../components/practice/PracticeRunner";
import { generatePracticeSet, type PracticeMode, type PracticeSetItem } from "../api/practiceSets";
import { getStudentDashboard } from "../api/studentDashboard";

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

function parsePracticeMode(raw: string | null): PracticeMode {
  return raw === "challenge" ? "challenge" : "standard";
}

export default function ExamPracticePage() {
  const { topicKey: topicKeyParam } = useParams<{ topicKey: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = parsePracticeMode(searchParams.get("mode"));
  const [items, setItems] = useState<PracticeSetItem[]>([]);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const topicKey = topicKeyParam || "";

  const setMode = useCallback(
    (next: PracticeMode) => {
      const nextParams = new URLSearchParams(searchParams);
      if (next === "challenge") nextParams.set("mode", "challenge");
      else nextParams.delete("mode");
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const load = useCallback(async () => {
    if (!topicKey) return;
    setLoading(true);
    setError(null);
    try {
      const dash = await getStudentDashboard({ specKey: DEFAULT_SPEC });
      const sk = dash?.studyPlan?.specKey || DEFAULT_SPEC;
      const linked = dash?.linkedTeachers ?? [];
      const firstTeacher = linked[0];
      if (!firstTeacher?.teacherId) {
        setError("Link to a teacher to access exam practice. Ask your teacher to add you.");
        setItems([]);
        return;
      }
      const nk = normalizeTopicKey(topicKey, sk);
      const res = await generatePracticeSet({
        teacherId: firstTeacher.teacherId,
        specKey: sk,
        topicKeys: [nk || topicKey],
        limit: 10,
        include: ["exam_question", "past_paper_question"],
        mode,
      });
      setTeacherId(firstTeacher.teacherId);
      setItems(res.items || []);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err?.response?.data?.error || err?.message || "Failed to load exam questions");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [topicKey, mode]);

  useEffect(() => {
    load();
  }, [load]);

  const handleComplete = useCallback(() => {
    getStudentDashboard({ specKey: DEFAULT_SPEC }).catch(() => {});
    navigate("/student/my-progress", { replace: true });
  }, [navigate]);

  const modeToggle = (
    <div className="mt-4 flex flex-wrap gap-2 items-center">
      <button
        type="button"
        onClick={() => setMode("standard")}
        className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
          mode === "standard"
            ? "border-slate-800 bg-slate-800 text-white"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        Exam practice
      </button>
      <button
        type="button"
        onClick={() => setMode("challenge")}
        className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
          mode === "challenge"
            ? "border-amber-700 bg-amber-700 text-white"
            : "border-amber-300 bg-white text-amber-900 hover:bg-amber-50"
        }`}
      >
        Challenge questions
      </button>
      {mode === "challenge" && (
        <span className="text-sm text-amber-900">Harder multi-step GCSE questions.</span>
      )}
    </div>
  );

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
        <Link to="/student/my-progress" className="text-indigo-600 hover:underline">
          ← Back to Progress
        </Link>
        {modeToggle}
        <p className="mt-4 text-gray-600">
          {mode === "challenge" ? "Loading challenge questions…" : "Loading exam questions…"}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Link to="/student/my-progress" className="text-indigo-600 hover:underline">
          ← Back to Progress
        </Link>
        {modeToggle}
        <div className="mt-4 p-4 border border-amber-200 bg-amber-50 rounded-lg">
          <p className="text-amber-800">{error}</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Link to="/student/my-progress" className="text-indigo-600 hover:underline">
          ← Back to Progress
        </Link>
        {modeToggle}
        <div className="mt-4 p-4 border border-gray-200 rounded-lg">
          <p className="text-gray-700">
            {mode === "challenge"
              ? "No challenge questions available for this topic yet."
              : "No exam questions available for this topic yet."}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Ask your teacher to add exam questions for {topicKeyToTitle(topicKey)}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-2">
        <Link to="/student/my-progress" className="text-indigo-600 hover:underline">
          ← Back to Progress
        </Link>
        <span className="text-sm text-gray-500">{topicKeyToTitle(topicKey)}</span>
      </div>
      {modeToggle}
      {mode === "challenge" && (
        <div className="mt-3 mb-2 inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
          Challenge mode
        </div>
      )}
      <div className="mt-3">
        <PracticeRunner
          items={items}
          teacherId={teacherId!}
          onComplete={handleComplete}
        />
      </div>
    </div>
  );
}
