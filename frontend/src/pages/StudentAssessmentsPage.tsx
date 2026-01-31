import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

type AssessmentPaper = {
  _id: string;
  title: string;
  subject: string;
  kind: string;
  examBoard?: string;
  level?: string;
  tier?: string;
  timeSeconds?: number;
  isPublished?: boolean;
};

const formatTime = (secs?: number) => {
  if (!secs || secs <= 0) return "Untimed";
  const m = Math.round(secs / 60);
  return `${m} min`;
};

const StudentAssessmentsPage: React.FC = () => {
  console.log("✅ StudentAssessmentsPage mounted");

  const [papers, setPapers] = useState<AssessmentPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      try {
        setErrMsg("");
        const res = await api.get("/assessment-papers");
        const all = (res.data?.papers || []) as AssessmentPaper[];

        // Student view: only show published papers (defensive)
        const published = all.filter(p => p.isPublished === true);

        setPapers(published);
      } catch (e: any) {
        console.error("Failed to load assessment papers", e);
        setErrMsg("Could not load assessments. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return <div style={{ padding: "2rem" }}>Loading assessments…</div>;
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Exam Practice</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Choose an assessment paper and press Start.
      </p>

      {errMsg && (
        <div
          style={{
            padding: "0.75rem 1rem",
            border: "1px solid #f3c7c7",
            background: "#fff6f6",
            borderRadius: 8,
            marginBottom: "1rem",
          }}
        >
          {errMsg}
        </div>
      )}

      {papers.length === 0 ? (
        <div style={{ opacity: 0.8 }}>
          No published assessment papers yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {papers.map(p => (
            <div
              key={p._id}
              style={{
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 12,
                padding: "1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                  {p.title}
                </div>
                <div style={{ opacity: 0.8, marginTop: 4 }}>
                  {p.subject} • {p.examBoard || "Exam board"} • {p.level || "Level"}{" "}
                  {p.tier ? `• ${p.tier}` : ""} • {formatTime(p.timeSeconds)}
                </div>
                <div style={{ opacity: 0.7, marginTop: 4, fontSize: "0.9rem" }}>
                  Type: {p.kind}
                </div>
              </div>

              <Link
                to={`/assessments/papers/${p._id}/start`}
                style={{
                  padding: "0.6rem 0.9rem",
                  borderRadius: 10,
                  background: "#111827",
                  color: "white",
                  textDecoration: "none",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                Start →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentAssessmentsPage;