/**
 * PR-STU-PROGRESS-1: Student "My Progress" — reflection (quizzes attempted, avg score, needs practice)
 */
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getStudentProgress,
  type SubjectProgress,
  type TopicProgress,
  type StudentProgressResponse,
} from "../api/studentProgress";

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};
const thTdStyle: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
};

function SubjectBadge({ averageScore }: { averageScore: number | null }) {
  if (averageScore == null) return <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>;
  if (averageScore < 0.4) {
    return (
      <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, background: "#fee2e2", color: "#991b1b", fontWeight: 600 }}>
        Needs practice
      </span>
    );
  }
  return (
    <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, background: "#d1fae5", color: "#065f46", fontWeight: 600 }}>
      On track
    </span>
  );
}

function TopicStatusBadge({ topic }: { topic: TopicProgress }) {
  if (!topic.attempted) {
    return (
      <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, background: "#f3f4f6", color: "#6b7280", fontWeight: 500 }}>
        Not started
      </span>
    );
  }
  if (topic.needsPractice) {
    return (
      <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, background: "#fee2e2", color: "#991b1b", fontWeight: 600 }}>
        Needs practice
      </span>
    );
  }
  return (
    <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, background: "#d1fae5", color: "#065f46", fontWeight: 600 }}>
      On track
    </span>
  );
}

export default function StudentMyProgressPage() {
  const [data, setData] = useState<StudentProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStudentProgress();
      setData(res);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hasAnyAttempts = (data?.subjects?.[0]?.quizzesAttempted ?? 0) > 0;

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Link to="/student-dashboard" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
          ← Back to Dashboard
        </Link>
      </div>

      <h1 style={{ margin: "0 0 8px 0", fontSize: "1.65rem" }}>My Progress</h1>
      <p style={{ margin: "0 0 24px 0", color: "#6b7280", fontSize: "0.95rem" }}>
        See how you&apos;re doing and where to practise next.
      </p>

      {loading && <p style={{ color: "#6b7280" }}>Loading…</p>}
      {error && (
        <div style={{ padding: 12, marginBottom: 16, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 8 }}>
          {error}
        </div>
      )}

      {!loading && !error && !hasAnyAttempts && (
        <div
          style={{
            padding: 32,
            background: "#f9fafb",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#6b7280", margin: "0 0 20px 0", fontSize: 15 }}>
            You haven&apos;t attempted any quizzes yet.
            <br />
            Once you start, your progress will appear here.
          </p>
          <Link
            to="/browse-lessons"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              background: "#2563eb",
              color: "white",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Browse lessons
          </Link>
        </div>
      )}

      {!loading && !error && hasAnyAttempts && (
        <>
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: "1.25rem" }}>Overall</h2>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={thTdStyle}>Subject</th>
                    <th style={thTdStyle}>Quizzes attempted</th>
                    <th style={thTdStyle}>Average score</th>
                    <th style={thTdStyle}>Last activity</th>
                    <th style={thTdStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.subjects ?? []).map((s: SubjectProgress, i: number) => (
                    <tr key={i}>
                      <td style={thTdStyle}>{s.subject}</td>
                      <td style={thTdStyle}>{s.quizzesAttempted}</td>
                      <td style={thTdStyle}>
                        {s.averageScore != null ? `${(s.averageScore * 100).toFixed(0)}%` : "—"}
                      </td>
                      <td style={thTdStyle}>
                        {s.lastActivityAt
                          ? new Date(s.lastActivityAt).toLocaleDateString(undefined, { dateStyle: "medium", timeStyle: "short" })
                          : "—"}
                      </td>
                      <td style={thTdStyle}>
                        <SubjectBadge averageScore={s.averageScore} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 style={{ margin: "0 0 16px 0", fontSize: "1.25rem" }}>By topic</h2>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={thTdStyle}>Topic</th>
                    <th style={thTdStyle}>Attempted</th>
                    <th style={thTdStyle}>Avg score</th>
                    <th style={thTdStyle}>Status</th>
                    <th style={thTdStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.topics ?? []).map((t: TopicProgress) => (
                    <tr key={t.topicKey}>
                      <td style={thTdStyle}>{t.topicName}</td>
                      <td style={thTdStyle}>{t.attempted ? "Yes" : "No"}</td>
                      <td style={thTdStyle}>
                        {t.averageScore != null ? `${(t.averageScore * 100).toFixed(0)}%` : "—"}
                      </td>
                      <td style={thTdStyle}>
                        <TopicStatusBadge topic={t} />
                      </td>
                      <td style={thTdStyle}>
                        {(t.needsPractice || !t.attempted) && (
                          <Link
                            to={`/browse-lessons?topicKey=${encodeURIComponent(t.topicKey)}`}
                            style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none", fontSize: 14 }}
                          >
                            Practise this topic
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
