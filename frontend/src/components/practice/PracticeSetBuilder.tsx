/**
 * PR-PRACTICE-LOOP-1: Builder — teacherId, specKey, topicKeys, Generate set.
 */
import React, { useState } from "react";
import { SpecSelector } from "../SpecSelector";
import type { SpecKey } from "../../api/taxonomy";

export type PracticeSetBuilderProps = {
  specKey: SpecKey;
  onSpecKeyChange: (v: SpecKey) => void;
  teacherId: string;
  onTeacherIdChange: (v: string) => void;
  topicKeys: string[];
  onTopicKeysChange: (v: string[]) => void;
  onGenerate: () => void;
  generating: boolean;
  error: string | null;
};

export function PracticeSetBuilder({
  specKey,
  onSpecKeyChange,
  teacherId,
  onTeacherIdChange,
  topicKeys,
  onTopicKeysChange,
  onGenerate,
  generating,
  error,
}: PracticeSetBuilderProps) {
  const [topicInput, setTopicInput] = useState("");
  const [topicError, setTopicError] = useState<string | null>(null);

  const prefix = `${specKey}:`;
  const addTopic = () => {
    const trimmed = topicInput.trim();
    setTopicError(null);
    if (!trimmed) return;
    if (!trimmed.startsWith(prefix)) {
      setTopicError(`Topic must start with ${prefix}`);
      return;
    }
    const slug = trimmed.slice(prefix.length);
    if (!slug) {
      setTopicError("Topic key must have a slug after the colon");
      return;
    }
    if (topicKeys.includes(trimmed)) {
      setTopicError("Already added");
      return;
    }
    onTopicKeysChange([...topicKeys, trimmed]);
    setTopicInput("");
  };

  const removeTopic = (idx: number) => {
    onTopicKeysChange(topicKeys.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
      <h2 className="text-lg font-semibold">Practice set</h2>
      <p className="text-sm text-gray-600">
        Choose your teacher, subject, and at least one topic. Then generate a set of questions.
      </p>

      <div>
        <label className="block text-sm font-medium mb-1">Teacher ID</label>
        <input
          type="text"
          value={teacherId}
          onChange={(e) => onTeacherIdChange(e.target.value.trim())}
          placeholder="e.g. paste teacher ID from your teacher"
          className="border rounded px-3 py-2 w-full max-w-md"
        />
        <p className="text-xs text-gray-500 mt-1">
          Ask your teacher for their ID if you don’t have it. You must be linked to this teacher.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <SpecSelector value={specKey} onChange={onSpecKeyChange} />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Topics (namespaced)</label>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="text"
            value={topicInput}
            onChange={(e) => {
              setTopicInput(e.target.value);
              setTopicError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTopic())}
            placeholder={`e.g. ${specKey}:cell-structure`}
            className="border rounded px-3 py-2 flex-1 min-w-[200px]"
          />
          <button
            type="button"
            onClick={addTopic}
            className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Add topic
          </button>
        </div>
        {topicError && <p className="text-sm text-red-600 mt-1">{topicError}</p>}
        {topicKeys.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {topicKeys.map((tk, i) => (
              <li
                key={tk}
                className="inline-flex items-center gap-1 px-2 py-1 bg-white border rounded text-sm"
              >
                {tk}
                <button
                  type="button"
                  onClick={() => removeTopic(i)}
                  className="text-red-600 hover:underline"
                  aria-label="Remove"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={onGenerate}
        disabled={!teacherId || topicKeys.length === 0 || generating}
        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
      >
        {generating ? "Generating…" : "Generate set"}
      </button>
    </div>
  );
}
