import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type ExamBoardRow = { name: string };

type LessonRowRaw = {
  id: any;
  title: any;
  subject: any;
  level: any;
  stage: any;
  years: any;
  is_published: any;
  created_at: any;
  exam_board?: ExamBoardRow[] | ExamBoardRow | null;
};

type LessonRow = {
  id: string;
  title: string;
  subject: string | null;
  level: string | null;
  stage: string | null;
  years: string | number | null;
  is_published: boolean | null;
  created_at: string | null;
  exam_board: ExamBoardRow[] | ExamBoardRow | null;
  exam_board_name: string | null;
};

const BOARD_OPTIONS = ["All", "AQA", "OCR", "Edexcel", "WJEC"] as const;
type BoardFilter = (typeof BOARD_OPTIONS)[number];

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  border: "1px solid rgba(0,0,0,0.10)",
  background: "rgba(99,102,241,0.10)",
  color: "#3730a3",
  marginRight: 8,
};

function getBoardName(
  exam_board: ExamBoardRow[] | ExamBoardRow | null | undefined
): string | null {
  if (Array.isArray(exam_board)) return exam_board[0]?.name ?? null;
  if (exam_board && typeof exam_board === "object" && "name" in exam_board) {
    return (exam_board as ExamBoardRow).name ?? null;
  }
  return null;
}

const BrowseLessonsPage: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [board, setBoard] = useState<BoardFilter>("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const { data, error } = await supabase
          .from("lessons")
          .select(
            `
              id,
              title,
              subject,
              level,
              stage,
              years,
              is_published,
              created_at,
              exam_board:exam_boards(name)
            `
          )
          .eq("is_published", true)
          .order("created_at", { ascending: false })
          .limit(200);

        if (cancelled) return;

        if (error) {
          console.error("Supabase error:", error);
          setError(error.message || "Failed to load lessons.");
          setLessons([]);
          return;
        }

        const raw = (data ?? []) as unknown as LessonRowRaw[];

        const normalized: LessonRow[] = raw.map((l) => {
          const exam_board = (l.exam_board ?? null) as
            | ExamBoardRow[]
            | ExamBoardRow
            | null;

          const exam_board_name = getBoardName(exam_board);

          return {
            id: String(l.id),
            title: String(l.title ?? ""),
            subject: l.subject ?? null,
            level: l.level ?? null,
            stage: l.stage ?? null,
            years: l.years ?? null,
            is_published: l.is_published ?? null,
            created_at: l.created_at ?? null,
            exam_board,
            exam_board_name,
          };
        });

        setLessons(normalized);
      } catch (e: any) {
        if (cancelled) return;
        console.error(e);
        setError(e?.message || "Failed to load lessons.");
        setLessons([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return lessons.filter((l) => {
      const boardName = (l.exam_board_name || "").toUpperCase();
      const matchesBoard = board === "All" ? true : boardName === board.toUpperCase();

      const matchesSearch =
        q.length === 0
          ? true
          : [
              l.title || "",
              l.subject || "",
              l.level || "",
              l.stage || "",
              String(l.years ?? ""),
              l.exam_board_name || "",
            ]
              .join(" ")
              .toLowerCase()
              .includes(q);

      return matchesBoard && matchesSearch;
    });
  }, [lessons, board, search]);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Browse Lessons</h1>
        <p style={{ marginTop: 6, color: "rgba(0,0,0,0.65)" }}>
          Published lessons from teachers — filtered by exam board.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 220px",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, subject, stage, year, board…"
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.15)",
            outline: "none",
            fontSize: 14,
          }}
        />

        <select
          value={board}
          onChange={(e) => setBoard(e.target.value as BoardFilter)}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "#fff",
            fontSize: 14,
          }}
        >
          {BOARD_OPTIONS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div style={{ padding: 14, borderRadius: 10, background: "#f7f7ff" }}>
          Loading published lessons…
        </div>
      )}

      {!loading && error && (
        <div
          style={{
            padding: 14,
            borderRadius: 10,
            border: "1px solid rgba(239,68,68,0.35)",
            background: "rgba(239,68,68,0.06)",
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && (
        <div style={{ margin: "12px 0 18px", color: "rgba(0,0,0,0.65)" }}>
          Showing <b>{filtered.length}</b> lesson(s)
          {board !== "All" ? (
            <>
              {" "}
              for board <b>{board}</b>
            </>
          ) : null}
          .
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14,
        }}
      >
        {!loading &&
          !error &&
          filtered.map((l) => {
            const boardName = l.exam_board_name ?? "Not set";

            return (
              <div key={l.id} style={cardStyle}>
                <div style={{ marginBottom: 10 }}>
                  <span style={badgeStyle}>
                    {(l.level || "").toUpperCase() || "LEVEL"}
                  </span>
                  <span style={badgeStyle}>{boardName}</span>
                </div>

                <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>{l.title}</h3>

                <div style={{ color: "rgba(0,0,0,0.70)", fontSize: 13, lineHeight: 1.5 }}>
                  <div>
                    <b>Subject:</b> {l.subject || "—"}
                  </div>
                  <div>
                    <b>Stage:</b> {l.stage || "—"}{" "}
                    <span style={{ marginLeft: 8 }}>
                      <b>Year:</b> {String(l.years ?? "—")}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                  <button
                    onClick={() => navigate(`/lesson/${l.id}`)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.15)",
                      background: "#fff",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    View
                  </button>

                  <button
                    onClick={() => navigate(`/subscription`)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.15)",
                      background: "rgba(99,102,241,0.10)",
                      cursor: "pointer",
                      fontWeight: 700,
                      color: "#3730a3",
                    }}
                  >
                    Purchase
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {!loading && !error && filtered.length === 0 && (
        <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: "#f7f7ff" }}>
          No lessons match your filters.
        </div>
      )}
    </div>
  );
};

export default BrowseLessonsPage;
