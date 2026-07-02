/**
 * PR-PRACTICE-LOOP-1: Builder — teacherId, specKey, topicKeys, Generate set.
 * Student-first: subject + optional topic from taxonomy; advanced IDs behind a disclosure.
 */
import React, { useEffect, useMemo, useState } from "react";
import { SpecSelector } from "../SpecSelector";
import { getTaxonomyTopicsFlat, type SpecKey } from "../../api/taxonomy";
import { useTaxonomy } from "../../hooks/useTaxonomy";

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
  const { data: taxonomy } = useTaxonomy(specKey);
  const [topicInput, setTopicInput] = useState("");
  const [topicError, setTopicError] = useState<string | null>(null);
  const [simpleTopicKey, setSimpleTopicKey] = useState("");

  const topicOptions = useMemo(() => {
    return getTaxonomyTopicsFlat(taxonomy)
      .filter((t) => t?.key)
      .map((t) => ({ key: t.key, label: t.topic || t.key }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [taxonomy]);

  const prefix = `${specKey}:`;

  useEffect(() => {
    setSimpleTopicKey("");
  }, [specKey]);

  const applySimpleTopic = (slug: string) => {
    setSimpleTopicKey(slug);
    if (!slug.trim()) {
      onTopicKeysChange([]);
      return;
    }
    const full = `${prefix}${slug}`;
    onTopicKeysChange([full]);
  };

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
      <h2 className="text-lg font-semibold">Practice</h2>
      <p className="text-sm text-gray-600">
        Choose a subject and topic, then start practice. If your teacher gave you a teacher ID or a specific topic code, use{" "}
        <strong>Advanced options</strong> below.
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <SpecSelector value={specKey} onChange={onSpecKeyChange} />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Topic</label>
        <select
          value={simpleTopicKey}
          onChange={(e) => applySimpleTopic(e.target.value)}
          className="border rounded px-3 py-2 w-full max-w-md bg-white"
        >
          <option value="">Select a topic…</option>
          {topicOptions.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">Topics match your selected subject. You can add more under Advanced options.</p>
      </div>

      <details className="rounded-lg border border-gray-200 bg-white p-3">
        <summary className="cursor-pointer font-medium text-gray-800 select-none list-none [&::-webkit-details-marker]:hidden">
          Advanced options (teacher ID &amp; topic codes)
        </summary>
        <div className="mt-4 space-y-4 pt-2 border-t border-gray-100">
          <p className="text-sm text-gray-600">
            Use this if your teacher shared a teacher ID or you need to paste an exact topic code (for example <code className="text-xs bg-gray-100 px-1 rounded">{specKey}:your-topic</code>).
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">Teacher ID</label>
            <input
              type="text"
              value={teacherId}
              onChange={(e) => onTeacherIdChange(e.target.value.trim())}
              placeholder="Paste the ID your teacher gave you"
              className="border rounded px-3 py-2 w-full max-w-md"
            />
            <p className="text-xs text-gray-500 mt-1">You must be linked to this teacher in the app.</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Add topic by code</label>
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
                    key={`${tk}-${i}`}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 border rounded text-sm font-mono text-xs"
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
        </div>
      </details>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-2 items-start">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!teacherId || topicKeys.length === 0 || generating}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 font-semibold"
        >
          {generating ? "Starting…" : "Start practice"}
        </button>
        {(!teacherId || topicKeys.length === 0) && !generating && (
          <p className="text-xs text-gray-500 max-w-md">
            {!teacherId && topicKeys.length > 0
              ? "Open Advanced options and paste your teacher ID to start."
              : topicKeys.length === 0
                ? "Select a topic above. If your teacher gave you an ID, add it under Advanced options."
                : null}
          </p>
        )}
      </div>
    </div>
  );
}
