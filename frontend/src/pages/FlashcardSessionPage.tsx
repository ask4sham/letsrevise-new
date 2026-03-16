/**
 * Actionable Revision Flow: Flashcard session by topic.
 * Route: /practice/flashcards/:topicKey
 * Fetches flashcards from GET /api/student/content/topic-flashcards.
 * Records LearningEvidenceEvent via POST /api/progress/flashcard-review.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import FlashcardsView from "../components/revision/FlashcardsView";
import { getTopicFlashcards } from "../api/studentContent";
import { postFlashcardReview } from "../api/studyCoach";
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

export default function FlashcardSessionPage() {
  const { topicKey: topicKeyParam } = useParams<{ topicKey: string }>();
  const navigate = useNavigate();
  const [cards, setCards] = useState<Array<{ id: string; front: string; back: string; tags?: string[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [specKey, setSpecKey] = useState(DEFAULT_SPEC);

  const topicKey = topicKeyParam || "";
  const namespacedKey = normalizeTopicKey(topicKey, specKey);

  const load = useCallback(async () => {
    if (!topicKey) return;
    setLoading(true);
    setError(null);
    try {
      const dash = await getStudentDashboard({ specKey: DEFAULT_SPEC });
      const sk = dash?.studyPlan?.specKey || DEFAULT_SPEC;
      setSpecKey(sk);
      const nk = normalizeTopicKey(topicKey, sk);
      const res = await getTopicFlashcards({
        topicKey: nk || topicKey,
        specKey: sk,
      });
      setCards(res.cards || []);
      if (!res.cards?.length && res.message) {
        setError(res.message);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err?.response?.data?.error || err?.message || "Failed to load flashcards");
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [topicKey]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDifficultyChange = useCallback(
    (cardId: string, difficulty: number) => {
      postFlashcardReview(specKey, namespacedKey || topicKey, cardId, difficulty).catch(() => {});
    },
    [specKey, namespacedKey, topicKey]
  );

  const handleComplete = useCallback(() => {
    getStudentDashboard({ specKey }).then(() => {}).catch(() => {});
    navigate("/student/my-progress", { replace: true });
  }, [specKey, navigate]);

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
        <p className="mt-4 text-gray-600">Loading flashcards…</p>
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

  if (cards.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Link to="/student/my-progress" className="text-indigo-600 hover:underline">
          ← Back to Progress
        </Link>
        <div className="mt-4 p-4 border border-gray-200 rounded-lg">
          <p className="text-gray-700">No flashcards available for this topic yet.</p>
          <p className="mt-2 text-sm text-gray-500">
            Ask your teacher to add flashcards for {topicKeyToTitle(topicKey)}.
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
      <FlashcardsView
        cards={cards}
        lessonId={`flashcard-session-${topicKey}`}
        onDifficultyChange={handleDifficultyChange}
        hideTitle={false}
      />
      <div className="mt-4">
        <button
          type="button"
          onClick={handleComplete}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Done — Back to Progress
        </button>
      </div>
    </div>
  );
}
