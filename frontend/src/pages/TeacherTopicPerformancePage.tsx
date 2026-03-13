/**
 * PR-PRACTICE-LOOP-1 Frontend Slice 2: Teacher topic performance — table (lowest accuracy first).
 */
import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { SpecSelector } from "../components/SpecSelector";
import { getTopicPerformance, type TopicPerformanceRow } from "../api/teacherAnalytics";
import type { SpecKey } from "../api/taxonomy";
import { getStoredSpecKey, setStoredSpecKey } from "../utils/specKey";

export default function TeacherTopicPerformancePage() {
  const [specKey, setSpecKeyState] = useState<SpecKey>(getStoredSpecKey());
  const [rows, setRows] = useState<TopicPerformanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setSpecKey = useCallback((v: SpecKey) => {
    setStoredSpecKey(v);
    setSpecKeyState(v);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTopicPerformance(specKey);
      setRows(data);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message ?? "Failed to load topic performance");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [specKey]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center gap-4 mb-4">
        <Link to="/teacher-dashboard" className="text-indigo-600 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-semibold">Topic performance</h1>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Topics with lowest accuracy first. Use this to see where students need more practice.
      </p>
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <SpecSelector value={specKey} onChange={setSpecKey} />
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border-b font-medium">Topic</th>
              <th className="p-2 border-b font-medium">Attempts</th>
              <th className="p-2 border-b font-medium">Accuracy %</th>
              <th className="p-2 border-b font-medium">Last attempt</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="p-4 text-gray-500">
                  No data for this spec yet. Students need to submit practice attempts.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.topicKey} className="border-b last:border-b-0">
                <td className="p-2">{r.topicKey}</td>
                <td className="p-2">{r.attempts}</td>
                <td className="p-2">
                  {r.attempts > 0 ? Math.round(r.accuracy * 100) : "—"}
                </td>
                <td className="p-2">
                  {r.lastAttemptAt
                    ? new Date(r.lastAttemptAt).toLocaleString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
