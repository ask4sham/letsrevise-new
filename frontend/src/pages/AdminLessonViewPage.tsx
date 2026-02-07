import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

type TeacherObj = {
  _id?: string;
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  name?: string;
};

type LessonPage = any; // pages structure varies across projects; we render safely

type Lesson = {
  _id?: string;
  id?: string;

  title?: string;
  description?: string;

  // some lessons store full content in `content`, others in `pages`
  content?: any;
  pages?: LessonPage[];

  subject?: string;
  level?: string;
  topic?: string;

  // teacher could be a string, populated object, or teacherName
  teacherId?: string | TeacherObj;
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

function safeTeacherName(lesson: Lesson): string {
  if (lesson.teacherName) return lesson.teacherName;

  const t = lesson.teacherId as any;
  if (!t) return "-";

  // populated object
  if (typeof t === "object") {
    if (t.name) return String(t.name);
    const fn = t.firstName ? String(t.firstName) : "";
    const ln = t.lastName ? String(t.lastName) : "";
    const full = `${fn} ${ln}`.trim();
    if (full) return full;
    if (t.email) return String(t.email);
  }

  // string id
  if (typeof t === "string") return t;

  return "-";
}

function displayLessonId(lesson: Lesson, fallback?: string) {
  return String(lesson._id || lesson.id || fallback || "");
}

function isProbablySummaryLesson(lesson: Lesson | null): boolean {
  if (!lesson) return true;
  // if admin dashboard passed a summary row, it usually won't include content/pages
  const hasPages = Array.isArray((lesson as any).pages) && (lesson as any).pages.length > 0;
  const hasContent = (lesson as any).content != null && String((lesson as any).content).trim() !== "";
  return !hasPages && !hasContent;
}

const AdminLessonViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // If AdminDashboard passed state: { lesson: l }, use it for instant title render,
  // but we STILL fetch the full lesson from /api/admin/lessons/:id
  const stateLesson = (location.state as any)?.lesson as Lesson | undefined;

  const [lesson, setLesson] = useState<Lesson | null>(stateLesson ?? null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const token = useMemo(() => localStorage.getItem("token") || "", []);

  useEffect(() => {
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

    const fetchFullLesson = async () => {
      setLoading(true);
      setError("");

      try {
        // ✅ Always prefer the admin full lesson endpoint
        const res = await fetch(`${API_BASE}/api/admin/lessons/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          const msg =
            data?.message ||
            data?.msg ||
            data?.error ||
            `Failed to load lesson (HTTP ${res.status})`;
          throw new Error(msg);
        }

        const lessonObj: Lesson = data?.lesson || data?.data || data;

        if (!lessonObj) throw new Error("Lesson not found");

        setLesson(lessonObj);
      } catch (e: any) {
        setError(e?.message || "Failed to load lesson");
      } finally {
        setLoading(false);
      }
    };

    // If we already have a full lesson (rare), we can skip fetch.
    // But if it's a summary lesson (most common), fetch full.
    if (isProbablySummaryLesson(stateLesson ?? null)) {
      fetchFullLesson();
    } else {
      // state already has content/pages, treat as full
      setLoading(false);
    }
  }, [id, navigate, stateLesson, token]);

  const handleEdit = () => {
    if (!id && !(lesson?._id || lesson?.id)) return;
    const lessonId = String(id || lesson?._id || lesson?.id);
    navigate(`/edit-lesson/${lessonId}`);
  };

  const handleDelete = async () => {
    const lessonId = String(id || lesson?._id || lesson?.id || "");
    if (!lessonId) return;

    const ok = window.confirm("Delete this lesson permanently? This cannot be undone.");
    if (!ok) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/lessons/${lessonId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.msg || data?.error || `Delete failed (HTTP ${res.status})`;
        throw new Error(msg);
      }

      // back to admin dashboard
      navigate("/admin");
    } catch (e: any) {
      alert(e?.message || "Failed to delete lesson");
    }
  };

  const renderPages = (pages: LessonPage[]) => {
    // We render a very safe, readable admin preview without assuming schema shape.
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {pages.map((p: any, idx: number) => {
          const title = p?.title || p?.pageTitle || `Page ${idx + 1}`;
          const blocks = Array.isArray(p?.blocks) ? p.blocks : null;
          const text = p?.text || p?.content || p?.body || null;

          return (
            <div
              key={p?.id || p?._id || idx}
              style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "0.75rem" }}
            >
              <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>{title}</div>

              {blocks && blocks.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {blocks.map((b: any, bi: number) => (
                    <div key={b?.id || b?._id || bi} style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                      {b?.text ?? b?.content ?? b?.markdown ?? JSON.stringify(b)}
                    </div>
                  ))}
                </div>
              ) : text ? (
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{String(text)}</div>
              ) : (
                <div style={{ color: "#6b7280" }}>No content on this page.</div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1000, margin: "2rem auto", padding: "1rem" }}>
        Loading lesson...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 1000, margin: "2rem auto", padding: "1rem" }}>
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
      <div style={{ maxWidth: 1000, margin: "2rem auto", padding: "1rem" }}>
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

  const displayId = displayLessonId(lesson, id);
  const status = lesson.status || (lesson.isPublished ? "published" : "draft");
  const teacher = safeTeacherName(lesson);

  const pages = Array.isArray(lesson.pages) ? lesson.pages : [];
  const hasPages = pages.length > 0;

  return (
    <div style={{ maxWidth: 1000, margin: "2rem auto", padding: "1rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>{lesson.title || "Untitled Lesson"}</h1>
          <div style={{ color: "#666", marginTop: "0.25rem" }}>
            Lesson ID: <code>{displayId}</code>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
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

          <button
            onClick={handleEdit}
            style={{
              padding: "0.6rem 0.9rem",
              backgroundColor: "#1976d2",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              height: "fit-content",
            }}
          >
            Edit
          </button>

          <button
            onClick={handleDelete}
            style={{
              padding: "0.6rem 0.9rem",
              backgroundColor: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              height: "fit-content",
            }}
          >
            Delete
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: "1.25rem",
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: "1rem",
          background: "white",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div>
            <b>Subject:</b> {lesson.subject || "-"}
          </div>
          <div>
            <b>Level:</b> {lesson.level || "-"}
          </div>
          <div>
            <b>Topic:</b> {lesson.topic || "-"}
          </div>
          <div>
            <b>Teacher:</b> {teacher}
          </div>
          <div>
            <b>Status:</b> {status}
          </div>
          <div>
            <b>Price:</b> {typeof lesson.shamCoinPrice === "number" ? `${lesson.shamCoinPrice} SC` : "0 SC"}
          </div>
          <div>
            <b>Views:</b> {lesson.views ?? 0}
          </div>
          <div>
            <b>Rating:</b> {lesson.averageRating ?? 0}
          </div>
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

        {hasPages ? (
          renderPages(pages)
        ) : (
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
            {lesson.content ? String(lesson.content) : "No content found."}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLessonViewPage;
