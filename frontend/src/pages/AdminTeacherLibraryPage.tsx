/**
 * Admin Teacher Library — catalogue approval workflow (teacher-library-admin-v1).
 * Route: /admin/teacher-library
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  approveLessonForCatalogue,
  fetchTeacherLibraryLessons,
  fetchTeacherLibrarySummary,
  rejectLessonForCatalogue,
  retireLessonFromCatalogue,
  type TeacherLibraryAdminLesson,
  type TeacherLibraryCounts,
  type TeacherLibraryTab,
} from "../api/teacherLibraryAdmin";

const TAB_LABELS: Record<TeacherLibraryTab, string> = {
  pending: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  retired: "Retired",
};

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

const AdminTeacherLibraryPage: React.FC = () => {
  const [tab, setTab] = useState<TeacherLibraryTab>("pending");
  const [pendingSort, setPendingSort] = useState<"oldest" | "newest">("newest");
  const [counts, setCounts] = useState<TeacherLibraryCounts | null>(null);
  const [lessons, setLessons] = useState<TeacherLibraryAdminLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [rejectTarget, setRejectTarget] = useState<TeacherLibraryAdminLesson | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summary, rows] = await Promise.all([
        fetchTeacherLibrarySummary(),
        fetchTeacherLibraryLessons(tab, { sort: pendingSort }),
      ]);
      setCounts(summary);
      setLessons(rows);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err as Error)?.message ||
        "Failed to load Teacher Library";
      setError(msg);
      setLessons([]);
    } finally {
      setLoading(false);
    }
  }, [tab, pendingSort]);

  useEffect(() => {
    load();
  }, [load]);

  const tabCount = useMemo(() => {
    if (!counts) return 0;
    if (tab === "pending") return counts.pending ?? counts.pending_review ?? 0;
    return counts[tab] ?? 0;
  }, [counts, tab]);

  const runAction = async (lessonId: string, action: () => Promise<void>) => {
    setActionId(lessonId);
    setError("");
    try {
      await action();
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err as Error)?.message ||
        "Action failed";
      setError(msg);
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    const notes = rejectNotes.trim();
    if (!notes) {
      setError("Rejection notes are required.");
      return;
    }
    await runAction(rejectTarget.id, () => rejectLessonForCatalogue(rejectTarget.id, notes));
    setRejectTarget(null);
    setRejectNotes("");
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 48px" }}>
      <div style={{ marginBottom: 20 }}>
        <Link to="/admin" style={{ color: "#64748b", textDecoration: "none", fontSize: 14 }}>
          ← Admin Dashboard
        </Link>
      </div>

      <h1 style={{ margin: "0 0 8px", fontSize: "1.75rem", color: "#111827" }}>Teacher Library</h1>
      <p style={{ margin: "0 0 24px", color: "#64748b", lineHeight: 1.5 }}>
        Manage LetsRevise Approved lessons before they appear in the teacher catalogue.
      </p>

      {error ? (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 8,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {(Object.keys(TAB_LABELS) as TeacherLibraryTab[]).map((key) => {
          const n =
            key === "pending"
              ? counts?.pending ?? counts?.pending_review ?? 0
              : counts?.[key] ?? 0;
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: active ? "2px solid #4f46e5" : "1px solid #e5e7eb",
                background: active ? "#eef2ff" : "#fff",
                color: active ? "#4338ca" : "#374151",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {TAB_LABELS[key]} ({n})
            </button>
          );
        })}
      </div>

      {tab === "pending" ? (
        <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 14, color: "#64748b" }}>Sort:</span>
          <button
            type="button"
            onClick={() => setPendingSort("newest")}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: pendingSort === "newest" ? "2px solid #4f46e5" : "1px solid #d1d5db",
              background: pendingSort === "newest" ? "#eef2ff" : "#fff",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Newest waiting
          </button>
          <button
            type="button"
            onClick={() => setPendingSort("oldest")}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: pendingSort === "oldest" ? "2px solid #4f46e5" : "1px solid #d1d5db",
              background: pendingSort === "oldest" ? "#eef2ff" : "#fff",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Oldest waiting
          </button>
        </div>
      ) : null}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading…</div>
      ) : lessons.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "#f9fafb",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            color: "#64748b",
          }}
        >
          No lessons in {TAB_LABELS[tab].toLowerCase()}.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 14, color: "#64748b" }}>
            Showing {lessons.length} of {tabCount}
          </div>
          {lessons.map((lesson) => {
            const busy = actionId === lesson.id;
            return (
              <div
                key={lesson.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 16,
                  padding: 16,
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: "0 0 6px", fontSize: "1.05rem", color: "#111827" }}>
                    {lesson.title}
                  </h3>
                  <p style={{ margin: "0 0 4px", fontSize: 14, color: "#374151" }}>
                    {lesson.subject} · {lesson.level} · {lesson.board || "Board not set"}
                    {lesson.topic ? ` · ${lesson.topic}` : ""}
                  </p>
                  <p style={{ margin: "0 0 4px", fontSize: 13, color: "#64748b" }}>
                    By {lesson.teacherName || "Teacher"} ·{" "}
                    {lesson.isPublished ? "Published" : "Draft / unpublished"}
                    {lesson.catalogueVersion != null ? ` · v${lesson.catalogueVersion}` : ""}
                  </p>
                  {tab === "pending" && lesson.submittedAt ? (
                    <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                      Submitted {formatDate(lesson.submittedAt)}
                    </p>
                  ) : null}
                  {tab === "approved" && lesson.approvedAt ? (
                    <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                      Approved {formatDate(lesson.approvedAt)}
                    </p>
                  ) : null}
                  {tab === "rejected" && lesson.rejectionNotes ? (
                    <p style={{ margin: "6px 0 0", fontSize: 13, color: "#92400e" }}>
                      {lesson.rejectionNotes}
                    </p>
                  ) : null}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, flexShrink: 0 }}>
                  <Link
                    to={`/lesson/${lesson.id}?mode=approval`}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      background: "#fff",
                      color: "#374151",
                      textDecoration: "none",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    Preview
                  </Link>
                  {tab === "pending" ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          runAction(lesson.id, () => approveLessonForCatalogue(lesson.id))
                        }
                        style={{
                          padding: "8px 14px",
                          borderRadius: 8,
                          border: "none",
                          background: busy ? "#86efac" : "#059669",
                          color: "#fff",
                          fontWeight: 600,
                          fontSize: 14,
                          cursor: busy ? "wait" : "pointer",
                        }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setRejectTarget(lesson);
                          setRejectNotes("");
                          setError("");
                        }}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 8,
                          border: "1px solid #fca5a5",
                          background: "#fff",
                          color: "#b91c1c",
                          fontWeight: 600,
                          fontSize: 14,
                          cursor: busy ? "wait" : "pointer",
                        }}
                      >
                        Reject
                      </button>
                    </>
                  ) : null}
                  {tab === "approved" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Retire "${lesson.title}" from the LetsRevise Approved catalogue?`
                          )
                        ) {
                          runAction(lesson.id, () => retireLessonFromCatalogue(lesson.id));
                        }
                      }}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: "1px solid #fcd34d",
                        background: "#fffbeb",
                        color: "#92400e",
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: busy ? "wait" : "pointer",
                      }}
                    >
                      Retire
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rejectTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
          onClick={() => setRejectTarget(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 8px", fontSize: "1.2rem" }}>Reject catalogue submission</h2>
            <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: 14 }}>
              {rejectTarget.title}
            </p>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
              Notes for the teacher
            </label>
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={4}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 14,
                boxSizing: "border-box",
              }}
              placeholder="Explain what needs to change before approval…"
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionId === rejectTarget.id}
                onClick={handleReject}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: "#dc2626",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminTeacherLibraryPage;
