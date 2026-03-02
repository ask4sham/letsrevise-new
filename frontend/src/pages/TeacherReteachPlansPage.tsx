import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { ReteachPlanCard } from "../components/teacher/ReteachPlanCard";

type LessonRow = { _id: string; title: string; topic?: string; isPublished: boolean };

const TeacherReteachPlansPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const lessonIdFromQuery = searchParams.get("lessonId") || undefined;
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(lessonIdFromQuery || null);

  useEffect(() => {
    if (lessonIdFromQuery) setSelectedLessonId(lessonIdFromQuery);
  }, [lessonIdFromQuery]);

  useEffect(() => {
    api
      .get("/lessons/teacher")
      .then((res) => {
        const data = res?.data;
        const raw = Array.isArray(data) ? data : Array.isArray(data?.lessons) ? data.lessons : [];
        setLessons(
          raw.map((l: any) => ({
            _id: String(l._id || l.id),
            title: l.title ?? "Untitled",
            topic: l.topic,
            isPublished: Boolean(l.isPublished),
          }))
        );
      })
      .catch(() => setLessons([]))
      .finally(() => setLoading(false));
  }, []);

  const publishedLessons = lessons.filter((l) => l.isPublished);
  const selectedLesson = lessons.find((l) => l._id === selectedLessonId);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Link to="/teacher-dashboard" style={{ color: "#2563eb", textDecoration: "none", fontSize: 14 }}>
          ← Back to Teacher Dashboard
        </Link>
      </div>
      <h1 style={{ margin: "0 0 8px", fontSize: "1.5rem", color: "#111827" }}>Reteach plans</h1>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "#64748b" }}>
        Generate or view a reteach plan for a lesson. Choose a lesson below.
      </p>

      {loading ? (
        <p style={{ color: "#6b7280" }}>Loading lessons…</p>
      ) : publishedLessons.length === 0 ? (
        <div style={{ padding: 24, background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
          <p style={{ margin: 0, color: "#64748b" }}>No published lessons yet. Publish a lesson to use reteach plans.</p>
          <Link to="/teacher-dashboard" style={{ display: "inline-block", marginTop: 12, color: "#2563eb", fontWeight: 600 }}>
            Back to Dashboard
          </Link>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginRight: 8 }}>Lesson:</label>
            <select
              value={selectedLessonId ?? ""}
              onChange={(e) => setSelectedLessonId(e.target.value || null)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "2px solid #e2e8f0",
                fontSize: 14,
                minWidth: 280,
              }}
            >
              <option value="">— Select lesson —</option>
              {publishedLessons.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.title} {l.topic ? `(${l.topic})` : ""}
                </option>
              ))}
            </select>
          </div>
          {selectedLessonId && selectedLesson && (
            <ReteachPlanCard lessonId={selectedLessonId} days={7} />
          )}
        </>
      )}
    </div>
  );
};

export default TeacherReteachPlansPage;
