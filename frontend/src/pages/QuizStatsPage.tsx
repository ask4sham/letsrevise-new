import React, { useEffect, useState } from "react";

type QuizStat = {
  quiz_id: string;
  title: string;
  attempts: number;
  average_score: number; // 0–1 ratio
};

const QuizStatsPage: React.FC = () => {
  const [stats, setStats] = useState<QuizStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = "http://localhost:5000/api/quizzes/stats/all";
        console.log("[QuizStatsPage] Fetching:", url);

        const res = await fetch(url);
        const text = await res.text();
        console.log("[QuizStatsPage] Raw response:", text);

        let json: any;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error("Unexpected response from server (not valid JSON).");
        }

        if (!res.ok) {
          throw new Error(json.error || "Failed to load quiz stats");
        }

        setStats(json.stats || []);
      } catch (err: any) {
        console.error("Failed to load quiz stats:", err);
        setError(err.message || "Failed to load quiz stats");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "20px" }}>
      <h1 style={{ marginTop: 0, marginBottom: "8px" }}>
        Quiz Performance Analytics
      </h1>
      <p style={{ marginTop: 0, color: "#666" }}>
        Overview of student performance across your quizzes.
      </p>

      {loading && <p>Loading stats…</p>}

      {error && !loading && (
        <div
          style={{
            marginTop: "12px",
            marginBottom: "12px",
            padding: "10px 12px",
            borderRadius: "8px",
            backgroundColor: "#f8d7da",
            color: "#721c24",
            border: "1px solid #f5c6cb",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && stats.length === 0 && (
        <p style={{ marginTop: "16px", color: "#555" }}>
          No quiz attempts recorded yet. Ask your students to try the “Test your
          knowledge” sections.
        </p>
      )}

      {!loading && !error && stats.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.9rem",
              background: "white",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#f5f6ff",
                  textAlign: "left",
                }}
              >
                <th
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  Quiz
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid #e2e8f0",
                    textAlign: "right",
                  }}
                >
                  Attempts
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid #e2e8f0",
                    textAlign: "right",
                  }}
                >
                  Average score
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => {
                const percentage = Math.round((s.average_score || 0) * 100);

                return (
                  <tr key={s.quiz_id}>
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #edf2f7",
                      }}
                    >
                      {s.title}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #edf2f7",
                        textAlign: "right",
                      }}
                    >
                      {s.attempts}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #edf2f7",
                        textAlign: "right",
                      }}
                    >
                      {percentage}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default QuizStatsPage;
