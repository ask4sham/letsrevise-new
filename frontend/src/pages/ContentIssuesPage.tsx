/**
 * Content Issues — admin/teacher page to view and manage lesson issue reports.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listReports, updateReportStatus, deleteReport, type LessonIssueReport } from "../api/lessonIssues";

export default function ContentIssuesPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<LessonIssueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchReports = useCallback(() => {
    setLoading(true);
    listReports(statusFilter ? { status: statusFilter } : undefined)
      .then((res) => setReports(res.reports || []))
      .catch((e: any) => setError(e?.response?.data?.msg || e?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleMarkResolved = async (id: string) => {
    try {
      await updateReportStatus(id, "resolved");
      fetchReports();
    } catch (e: any) {
      alert(e?.response?.data?.msg || "Failed to update");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this report?")) return;
    try {
      await deleteReport(id);
      fetchReports();
    } catch (e: any) {
      alert(e?.response?.data?.msg || "Failed to delete");
    }
  };

  const lessonUrl = (r: LessonIssueReport) =>
    r.pageId ? `/lesson/${r.lessonId}?page=${encodeURIComponent(r.pageId)}` : `/lesson/${r.lessonId}`;

  const pageDisplay = (r: LessonIssueReport) => {
    if (r.pageTitle) return r.pageOrder != null ? `Page ${r.pageOrder}: ${r.pageTitle}` : r.pageTitle;
    if (r.pageOrder != null) return `Page ${r.pageOrder}`;
    return r.pageId || "—";
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return d;
    }
  };

  if (error) {
    return (
      <div style={{ padding: "2rem", maxWidth: "720px", margin: "0 auto" }}>
        <p style={{ color: "#b91c1c", marginBottom: "16px" }}>{error}</p>
        <button type="button" onClick={() => navigate(-1)} style={{ padding: "8px 16px" }}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <h1 style={{ margin: 0 }}>Content Issues</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ fontSize: 14, fontWeight: 500 }}>Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontSize: 14,
            }}
          >
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="reviewed">Reviewed</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#64748b" }}>Loading…</p>
      ) : reports.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: "1rem" }}>No reports found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                <th style={{ padding: "12px 8px", fontWeight: 600 }}>Lesson</th>
                <th style={{ padding: "12px 8px", fontWeight: 600 }}>Page</th>
                <th style={{ padding: "12px 8px", fontWeight: 600 }}>Type</th>
                <th style={{ padding: "12px 8px", fontWeight: 600 }}>Reported by</th>
                <th style={{ padding: "12px 8px", fontWeight: 600 }}>Status</th>
                <th style={{ padding: "12px 8px", fontWeight: 600 }}>Created</th>
                <th style={{ padding: "12px 8px", fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <React.Fragment key={r.id}>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "12px 8px" }}>
                    <Link
                      to={`/lesson/${r.lessonId}`}
                      style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }}
                    >
                      {r.lessonTitle || r.lessonId}
                    </Link>
                  </td>
                  <td style={{ padding: "12px 8px", color: "#64748b" }}>
                    {r.pageId || "—"}
                  </td>
                  <td style={{ padding: "12px 8px" }}>{r.reportTypeLabel}</td>
                  <td style={{ padding: "12px 8px" }}>
                    {r.reportedByName}
                    {r.userRole && (
                      <span style={{ marginLeft: 6, fontSize: 12, color: "#94a3b8" }}>
                        ({r.userRole})
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        background:
                          r.status === "open"
                            ? "#fef3c7"
                            : r.status === "resolved"
                            ? "#d1fae5"
                            : "#e0e7ff",
                        color:
                          r.status === "open"
                            ? "#92400e"
                            : r.status === "resolved"
                            ? "#065f46"
                            : "#3730a3",
                      }}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px 8px", color: "#64748b", whiteSpace: "nowrap" }}>
                    {formatDate(r.createdAt)}
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          border: "1px solid #64748b",
                          background: "#f8fafc",
                          color: "#475569",
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      >
                        {expandedId === r.id ? "Hide" : "View"}
                      </button>
                      <Link
                        to={lessonUrl(r)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          border: "1px solid #2563eb",
                          background: "#eff6ff",
                          color: "#2563eb",
                          textDecoration: "none",
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      >
                        Open lesson{r.pageId ? " (page)" : ""}
                      </Link>
                      {r.status !== "resolved" && (
                        <button
                          type="button"
                          onClick={() => handleMarkResolved(r.id)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "1px solid #059669",
                            background: "#ecfdf5",
                            color: "#059669",
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                        >
                          Mark resolved
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          border: "1px solid #dc2626",
                          background: "#fef2f2",
                          color: "#dc2626",
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedId === r.id && (
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <td colSpan={7} style={{ padding: "12px 16px", fontSize: 13 }}>
                      <div style={{ marginBottom: 8 }}>
                        <strong>Description:</strong> {r.description}
                      </div>
                      {r.suggestedFix && (
                        <div>
                          <strong>Suggested fix:</strong> {r.suggestedFix}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: 24 }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #d1d5db", cursor: "pointer" }}
        >
          Back
        </button>
      </p>
    </div>
  );
}
