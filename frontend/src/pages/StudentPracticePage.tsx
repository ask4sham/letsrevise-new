/**
 * PR-PRACTICE-LOOP-1 Frontend Slice 1: Student practice — builder + runner, end-to-end.
 */
import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { PracticeSetBuilder } from "../components/practice/PracticeSetBuilder";
import { PracticeRunner } from "../components/practice/PracticeRunner";
import { generatePracticeSet } from "../api/practiceSets";
import type { PracticeSetItem } from "../api/practiceSets";
import type { SpecKey } from "../api/taxonomy";
import { getStoredSpecKey, setStoredSpecKey } from "../utils/specKey";

const LINK_ERROR_MSG =
  "You're not linked to this teacher yet. Ask your teacher to add you.";
const EMPTY_ITEMS_MSG = "No questions found for selected topics/filters.";

export default function StudentPracticePage() {
  const [specKey, setSpecKeyState] = useState<SpecKey>(getStoredSpecKey());
  const [teacherId, setTeacherId] = useState("");
  const [topicKeys, setTopicKeys] = useState<string[]>([]);
  const [practiceSetId, setPracticeSetId] = useState<string | null>(null);
  const [items, setItems] = useState<PracticeSetItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const setSpecKey = useCallback((v: SpecKey) => {
    setStoredSpecKey(v);
    setSpecKeyState(v);
    setTopicKeys((prev) => prev.filter((tk) => tk.startsWith(`${v}:`)));
  }, []);

  const handleGenerate = useCallback(async () => {
    setError(null);
    setLinkError(null);
    setGenerating(true);
    try {
      const res = await generatePracticeSet({
        teacherId,
        specKey,
        topicKeys,
        limit: 10,
      });
      setPracticeSetId(res.practiceSetId);
      setItems(res.items || []);
      if (!res.items || res.items.length === 0) {
        setError(EMPTY_ITEMS_MSG);
      }
    } catch (e: unknown) {
      const err = e as { status?: number; data?: { error?: string }; message?: string };
      const msg = err?.data?.error ?? err?.message ?? "Failed to generate set";
      setError(msg);
      if (err?.status === 403 && (msg.toLowerCase().includes("link") || msg.toLowerCase().includes("teacher"))) {
        setLinkError(LINK_ERROR_MSG);
      }
      setItems([]);
    } finally {
      setGenerating(false);
    }
  }, [teacherId, specKey, topicKeys]);

  const handleComplete = useCallback(() => {
    // Runner finished all items; keep items visible so completion state shows
  }, []);

  const handleLinkError = useCallback((message: string) => {
    setLinkError(LINK_ERROR_MSG);
  }, []);

  const startOver = useCallback(() => {
    setPracticeSetId(null);
    setItems([]);
    setError(null);
    setLinkError(null);
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center gap-4 mb-4">
        <Link to="/student-dashboard" className="text-indigo-600 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-semibold">Practice</h1>
      </div>
      <p className="text-sm text-gray-600 mb-4 max-w-xl">
        Choose a subject and topic, then open <span className="font-medium">Advanced options</span> if you need to enter your teacher&apos;s ID or a specific topic code.
      </p>

      <PracticeSetBuilder
        specKey={specKey}
        onSpecKeyChange={setSpecKey}
        teacherId={teacherId}
        onTeacherIdChange={setTeacherId}
        topicKeys={topicKeys}
        onTopicKeysChange={setTopicKeys}
        onGenerate={handleGenerate}
        generating={generating}
        error={error}
      />

      {linkError && (
        <div className="mt-4 p-4 border border-amber-200 bg-amber-50 rounded-lg">
          <p className="text-amber-800">{linkError}</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Questions</h2>
            <button
              type="button"
              onClick={startOver}
              className="text-sm text-indigo-600 hover:underline"
            >
              Start another set
            </button>
          </div>
          <PracticeRunner
            items={items}
            teacherId={teacherId}
            onComplete={handleComplete}
            onLinkError={handleLinkError}
          />
        </div>
      )}

      {error && items.length === 0 && !linkError && (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
