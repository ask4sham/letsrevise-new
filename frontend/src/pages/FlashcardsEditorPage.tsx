import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import FlashcardsEditor, { Flashcard } from "../components/revision/FlashcardsEditor";

type LessonResponse = {
  success?: boolean;
  lesson?: any;
  data?: any; // some APIs return {data:{...}}
  _id?: string;
  flashcards?: Flashcard[];
};

function getTokenFromStorage(): string | null {
  const keys = ["token", "jwt", "authToken", "accessToken"];
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v && v.length > 10) return v;
  }

  const blobKeys = ["auth", "user", "session"];
  for (const k of blobKeys) {
    const raw = localStorage.getItem(k);
    if (!raw) continue;
    try {
      const obj = JSON.parse(raw);
      const maybe =
        obj?.token ||
        obj?.jwt ||
        obj?.authToken ||
        obj?.accessToken ||
        obj?.data?.token ||
        obj?.user?.token;
      if (typeof maybe === "string" && maybe.length > 10) return maybe;
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Teacher-only page that loads a lesson and allows editing/saving flashcards.
 *
 * URL intended:
 *   /lessons/:id/flashcards
 *
 * It fetches the lesson from the backend and passes initial flashcards into FlashcardsEditor,
 * which saves via POST /api/lessons/:id/revision.
 */
export default function FlashcardsEditorPage() {
  const { id } = useParams<{ id: string }>();

  // IMPORTANT: frontend dev server is usually 3000, backend API is 5000
  const apiBaseUrl = "http://localhost:5000";

  const [loading, setLoading] = useState(true);
  const [lessonTitle, setLessonTitle] = useState<string>("Lesson");
  const [initialCards, setInitialCards] = useState<Flashcard[]>([]);
  const [error, setError] = useState<string>("");

  const lessonId = useMemo(() => (id ? String(id) : ""), [id]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError("");

      if (!lessonId) {
        setError("Missing lesson id in URL.");
        setLoading(false);
        return;
      }

      const token = getTokenFromStorage();
      if (!token) {
        setError("You must be logged in as a teacher to edit flashcards.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${apiBaseUrl}/api/lessons/${lessonId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const contentType = res.headers.get("content-type") || "";
        let data: LessonResponse | any = null;

        if (contentType.includes("application/json")) data = await res.json();
        else data = { msg: await res.text() };

        if (!res.ok) {
          const msg = data?.msg || data?.message || `Failed to load lesson (HTTP ${res.status}).`;
          throw new Error(msg);
        }

        // Accept multiple API shapes
        const lesson = data?.lesson || data?.data || data;

        const title =
          lesson?.title ||
          lesson?.name ||
          lesson?.topic ||
          lesson?.lessonTitle ||
          "Lesson";

        const cards: Flashcard[] = Array.isArray(lesson?.flashcards)
          ? lesson.flashcards
          : Array.isArray(data?.flashcards)
          ? data.flashcards
          : [];

        if (!alive) return;

        setLessonTitle(String(title));
        setInitialCards(cards);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load lesson.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [lessonId]);

  const pageStyle: React.CSSProperties = {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "24px 16px 64px",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  };

  const h1Style: React.CSSProperties = {
    margin: 0,
    fontSize: 28,
    fontWeight: 900,
    color: "#111827",
  };

  const subStyle: React.CSSProperties = {
    marginTop: 6,
    fontSize: 14,
    color: "#6b7280",
  };

  const pillStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #e5e7eb",
    borderRadius: 999,
    padding: "8px 12px",
    background: "#fff",
    color: "#111827",
    fontWeight: 800,
    textDecoration: "none",
  };

  const msgStyle: React.CSSProperties = {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    color: "#374151",
    fontWeight: 700,
  };

  const errStyle: React.CSSProperties = {
    ...msgStyle,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
  };

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={h1Style}>Flashcards Editor</h1>
          <div style={subStyle}>
            Lesson: <b>{lessonTitle}</b>
            <span style={{ margin: "0 8px" }}>·</span>
            ID: <span style={{ fontFamily: "monospace" }}>{lessonId}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link to={`/lessons/${lessonId}`} style={pillStyle}>
            ← Back to lesson
          </Link>
        </div>
      </div>

      {loading ? <div style={msgStyle}>Loading lesson…</div> : null}
      {error ? <div style={errStyle}>{error}</div> : null}

      {!loading && !error ? (
        <FlashcardsEditor
          lessonId={lessonId}
          initialCards={initialCards}
          apiBaseUrl={apiBaseUrl}
          title="Flashcards (Teacher)"
          onSaved={() => {
            // After saving, re-fetch to keep editor in sync
            // (optional; safe if the backend normalizes data)
            // Keeping it simple: leave as-is.
          }}
        />
      ) : null}
    </div>
  );
}
