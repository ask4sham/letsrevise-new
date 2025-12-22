import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

type Lesson = {
  _id?: string;
  id?: string;
  title?: string;
  description?: string;
  content?: string;
  subject?: string;
  level?: string;
  topic?: string;
  teacherName?: string;
  estimatedDuration?: number;
  shamCoinPrice?: number;
  isPublished?: boolean;
  status?: string;
  views?: number;
  averageRating?: number;
  totalRatings?: number;
  createdAt?: string;
  updatedAt?: string;
};

const API_BASE = "http://localhost:5000";

const AdminLessonViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // If AdminDashboard passed state: { lesson: l }, use it immediately
  const stateLesson = (location.state as any)?.lesson as Lesson | undefined;

  const [lesson, setLesson] = useState<Lesson | null>(stateLesson ?? null);
  const [loading, setLoading] = useState<boolean>(!stateLesson);
  const [error, setError] = useState<string>("");

  const token = useMemo(() => localStorage.getItem("token") || "", []);

  useEffect(() => {
    // basic admin guard (extra safety)
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user.userType !== "admin") {
      navigate("/dashboard");
      return;
    }

    if (!id) {
      setError("Lesson id missing");
      setLoading(false);
      return;
    }

    // If we already have lesson from state, no need to refetch
    if (stateLesson) return;

    const fetchLesson = async () => {
      setLoading(true);
      setError("");

      try {
        // ✅ Primary: your Node/Mongo endpoint
        let res = await fetch(`${API_BASE}/api/lessons/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        // fallback if your backend uses a different admin endpoint
        if (!res.ok) {
          res = await fetch(`${API_BASE}/api/admin/lessons/${id}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          });
        }

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          const msg =
            data?.message ||
            data?.msg ||
            data?.error ||
            `Failed to load lesson (HTTP ${res.status})`;
          throw new Error(msg);
        }

        // Many backends return { success, lesson } or just the lesson
        const lessonObj: Lesson = data?.lesson || data?.data || data;

        if (!lessonObj) throw new Error("Lesson not found");

        setLesson(lessonObj);
      } catch (e: any) {
        setError(e?.message || "Failed to load lesson");
      } finally {
        setLoading(false);
      }
    };

    fetchLesson();
  }, [id, navigate, stateLesson, token]);

  if (loading) {
    return (
      <div style={{ maxWidth: 900, margin: "2rem auto", padding: "1rem" }}>
        Loading lesson...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 900, margin: "2rem auto", padding: "1rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>{error}</h2>
        <button
          onClick={() => navigate("/admin")}
          style={{
            padding: "0.5rem 0.75rem",
            backgroundColor: "#1976d2",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          ← Back to Admin Dashboard
        </button>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div style={{ maxWidth: 900, margin: "2rem auto", padding: "1rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>Lesson not found</h2>
        <button
          onClick={() => navigate("/admin")}
          style={{
            padding: "0.5rem 0.75rem",
            backgroundColor: "#1976d2",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          ← Back to Admin Dashboard
        </button>
      </div>
    );
  }

  const displayId = lesson._id || lesson.id || id || "";

  return (
    <div style={{ maxWidth: 900, margin: "2rem auto", padding: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>{lesson.title || "Untitled Lesson"}</h1>
          <div style={{ color: "#666", marginTop: "0.25rem" }}>
            Lesson ID: <code>{displayId}</code>
          </div>
        </div>

        <button
          onClick={() => navigate("/admin")}
          style={{
            padding: "0.6rem 0.9rem",
            backgroundColor: "#6c757d",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            height: "fit-content",
          }}
        >
          ← Back to Admin Dashboard
        </button>
      </div>

      <div style={{ marginTop: "1.25rem", border: "1px solid #ddd", borderRadius: 8, padding: "1rem", background: "white" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div><b>Subject:</b> {lesson.subject || "-"}</div>
          <div><b>Level:</b> {lesson.level || "-"}</div>
          <div><b>Topic:</b> {lesson.topic || "-"}</div>
          <div><b>Teacher:</b> {lesson.teacherName || "-"}</div>
          <div><b>Status:</b> {lesson.status || (lesson.isPublished ? "published" : "draft")}</div>
          <div><b>Price:</b> {typeof lesson.shamCoinPrice === "number" ? `${lesson.shamCoinPrice} SC` : "0 SC"}</div>
          <div><b>Views:</b> {lesson.views ?? 0}</div>
          <div><b>Rating:</b> {lesson.averageRating ?? 0}</div>
        </div>

        {lesson.description && (
          <>
            <hr style={{ margin: "1rem 0" }} />
            <h3 style={{ marginTop: 0 }}>Description</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{lesson.description}</p>
          </>
        )}

        <hr style={{ margin: "1rem 0" }} />
        <h3 style={{ marginTop: 0 }}>Content</h3>
        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
          {lesson.content || "No content found."}
        </div>
      </div>
    </div>
  );
};

export default AdminLessonViewPage;
