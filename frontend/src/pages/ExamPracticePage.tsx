/**
 * Actionable Revision Flow: Exam practice by topic.
 * Route: /practice/exam/:topicKey
 * Uses generatePracticeSet with exam_question, past_paper_question.
 * Records via practice-attempts (LearningEvidenceEvent).
 */
import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { PracticeRunner } from "../components/practice/PracticeRunner";
import { generatePracticeSet, type PracticeSetItem } from "../api/practiceSets";
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

export default function ExamPracticePage() {
  const { topicKey: topicKeyParam } = useParams<{ topicKey: string }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<PracticeSetItem[]>([]);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const topicKey = topicKeyParam || "";

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
  }, [topicKey]);

  useEffect(() => {
    load();
  }, [load]);

  const handleComplete = useCallback(() => {
    getStudentDashboard({ specKey: DEFAULT_SPEC }).catch(() => {});
    navigate("/student/my-progress", { replace: true });
  }, [navigate]);

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
        <p className="mt-4 text-gray-600">Loading exam questions…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Link to="/student/my-progress" className="text-indigo-600 hover:underline">
          ← Back to Progress
        </Link>
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
        <div className="mt-4 p-4 border border-gray-200 rounded-lg">
          <p className="text-gray-700">No exam questions available for this topic yet.</p>
          <p className="mt-2 text-sm text-gray-500">
            Ask your teacher to add exam questions for {topicKeyToTitle(topicKey)}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <Link to="/student/my-progress" className="text-indigo-600 hover:underline">
          ← Back to Progress
        </Link>
        <span className="text-sm text-gray-500">{topicKeyToTitle(topicKey)}</span>
      </div>
      <PracticeRunner
        items={items}
        teacherId={teacherId!}
        onComplete={handleComplete}
      />
    </div>
  );
}
