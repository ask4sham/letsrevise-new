/**
 * PR-PRACTICE-LOOP-1: Teacher topic performance — attempts, accuracy, last attempted per topic.
 */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SpecSelector } from "../components/SpecSelector";
import { getStoredSpecKey, setStoredSpecKey } from "../utils/specKey";
import { useTaxonomy } from "../hooks/useTaxonomy";
import { fetchTopicStats } from "../api/practice";
import { getTaxonomyTopicsFlat, type SpecKey } from "../api/taxonomy";
import type { TopicStat } from "../api/practice";

export default function TeacherTopicStatsPage() {
  const [specKey, setSpecKeyState] = useState<SpecKey>(getStoredSpecKey);
  const { data: taxonomy } = useTaxonomy(specKey);
  const [stats, setStats] = useState<TopicStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setSpecKey = (v: SpecKey) => {
    setStoredSpecKey(v);
    setSpecKeyState(v);
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchTopicStats({ specKey })
      .then((res) => setStats(res.topics || []))
      .catch((e) => {
        setError(e?.message || "Failed to load stats");
        setStats([]);
      })
      .finally(() => setLoading(false));
  }, [specKey]);

  const topicKeyToName = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of getTaxonomyTopicsFlat(taxonomy)) {
      const key = t.key;
      const short = key.includes(":") ? key.split(":")[1] : key;
      map[key] = t.topic;
      map[short] = t.topic;
      map[`${specKey}:${short}`] = t.topic;
    }
    return map;
  }, [taxonomy, specKey]);

  const displayName = (topicKey: string) => {
    const short = topicKey.includes(":") ? topicKey.split(":")[1] : topicKey;
    return topicKeyToName[topicKey] || topicKeyToName[short] || topicKey;
  };

  const formatDate = (s: string | null) => {
    if (!s) return "—";
    try {
      const d = new Date(s);
      return d.toLocaleDateString(undefined, { dateStyle: "short" });
    } catch {
      return s;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center gap-4 mb-4">
        <Link to="/dashboard" className="text-indigo-600 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-semibold">Topic performance</h1>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Attempts and accuracy per topic (student practice on your content).
      </p>

      <div className="mb-4">
        <SpecSelector value={specKey} onChange={setSpecKey} />
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && stats.length === 0 && !error && (
        <p className="text-sm text-gray-500">No practice attempts for this spec yet.</p>
      )}

      {!loading && stats.length > 0 && (
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Topic</th>
                <th className="px-3 py-2 text-right font-medium">Attempts</th>
                <th className="px-3 py-2 text-right font-medium">Correct</th>
                <th className="px-3 py-2 text-right font-medium">Partial</th>
                <th className="px-3 py-2 text-right font-medium">Wrong</th>
                <th className="px-3 py-2 text-right font-medium">Accuracy</th>
                <th className="px-3 py-2 text-left font-medium">Last attempted</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => (
                <tr key={row.topicKey} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium">{displayName(row.topicKey)}</td>
                  <td className="px-3 py-2 text-right">{row.attempts}</td>
                  <td className="px-3 py-2 text-right">{row.correct}</td>
                  <td className="px-3 py-2 text-right">{row.partial}</td>
                  <td className="px-3 py-2 text-right">{row.wrong}</td>
                  <td className="px-3 py-2 text-right">
                    {row.accuracy != null ? `${row.accuracy}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{formatDate(row.lastAttempt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
