/**
 * Content Issues — admin/teacher page to view and manage lesson issue reports.
 * Includes Content Quality Dashboard with summary cards and rankings.
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  listReports,
  updateReportStatus,
  deleteReport,
  getReportStats,
  REPORT_PRIORITY,
  type LessonIssueReport,
  type ReportStats,
} from "../api/lessonIssues";

function PriorityBadge({ reportType }: { reportType: string }) {
  const priority = REPORT_PRIORITY[reportType] ?? "medium";
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    high: { bg: "#fef2f2", color: "#b91c1c", label: "High" },
    medium: { bg: "#fef3c7", color: "#92400e", label: "Medium" },
    low: { bg: "#f0fdf4", color: "#15803d", label: "Low" },
  };
  const s = styles[priority] ?? styles.medium;
  return (
    <span
      style={{
        padding: "2px 6px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        background: s.bg,
        color: s.color,
        marginLeft: 6,
      }}
      title={`Priority: ${s.label}`}
    >
      {s.label}
    </span>
  );
}

export default function ContentIssuesPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<LessonIssueReport[]>([]);
  const [openReports, setOpenReports] = useState<LessonIssueReport[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchReports = useCallback(() => {
    setLoading(true);
    const params = statusFilter ? { status: statusFilter, limit: 200 } : { limit: 200 };
    listReports(params)
      .then((res) => setReports(res.reports || []))
      .catch((e: any) => setError(e?.response?.data?.msg || e?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    setStatsLoading(true);
    getReportStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    listReports({ status: "open", limit: 200 })
      .then((res) => setOpenReports(res.reports || []))
      .catch(() => setOpenReports([]));
  }, []);

  const handleMarkResolved = async (id: string) => {
    try {
      await updateReportStatus(id, "resolved");
      fetchReports();
      setOpenReports((prev) => prev.filter((r) => r.id !== id));
      getReportStats().then(setStats).catch(() => {});
    } catch (e: any) {
      alert(e?.response?.data?.msg || "Failed to update");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this report?")) return;
    try {
      await deleteReport(id);
      fetchReports();
      setOpenReports((prev) => prev.filter((r) => r.id !== id));
      getReportStats().then(setStats).catch(() => {});
    } catch (e: any) {
      alert(e?.response?.data?.msg || "Failed to delete");
    }
  };

  const lessonViewUrl = (r: LessonIssueReport) =>
    r.pageId ? `/lesson/${r.lessonId}?page=${encodeURIComponent(r.pageId)}` : `/lesson/${r.lessonId}`;

  const editLessonUrl = (r: LessonIssueReport) =>
    r.pageId
      ? `/edit-lesson/${r.lessonId}?page=${encodeURIComponent(r.pageId)}`
      : `/edit-lesson/${r.lessonId}`;

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

  const mostReportedLessons = useMemo(() => {
    const byLesson = new Map<
      string,
      { lessonId: string; title: string; topicKey: string | null; count: number; lastReported: string }
    >();
    for (const r of openReports) {
      const lid = String(r.lessonId);
      const existing = byLesson.get(lid);
      const lastReported = !existing || r.createdAt > existing.lastReported ? r.createdAt : existing.lastReported;
      byLesson.set(lid, {
        lessonId: lid,
        title: r.lessonTitle || lid,
        topicKey: r.lessonTopicKey ?? null,
        count: (existing?.count ?? 0) + 1,
        lastReported,
      });
    }
    return Array.from(byLesson.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [openReports]);

  const mostReportedTopics = useMemo(() => {
    const byTopic = new Map<
      string,
      { topicKey: string; display: string; count: number; lessonIds: Set<string> }
    >();
    for (const r of openReports) {
      const key = r.lessonTopicKey || r.lessonTopic || "—";
      if (!key || key === "—") continue;
      const existing = byTopic.get(key);
      const lessonIds = existing ? new Set(existing.lessonIds) : new Set<string>();
      lessonIds.add(String(r.lessonId));
      byTopic.set(key, {
        topicKey: key,
        display: r.lessonSubTopic || r.lessonTopic || key,
        count: (existing?.count ?? 0) + 1,
        lessonIds,
      });
    }
    return Array.from(byTopic.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(({ topicKey, display, count, lessonIds }) => ({
        topicKey,
        display,
        count,
        lessons: lessonIds.size,
      }));
  }, [openReports]);

  const reportTypeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of openReports) {
      const label = r.reportTypeLabel || r.reportType || "Other";
      counts[label] = (counts[label] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [openReports]);

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
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
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

      {/* Content Quality Dashboard — summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        {statsLoading ? (
          <p style={{ color: "#64748b", gridColumn: "1 / -1" }}>Loading summary…</p>
        ) : (
          <>
            <div style={{ padding: 16, borderRadius: 10, background: "#fef3c7", border: "1px solid #f59e0b" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#92400e" }}>{stats?.openCount ?? 0}</div>
              <div style={{ fontSize: 13, color: "#78350f" }}>Open issues</div>
            </div>
            <div style={{ padding: 16, borderRadius: 10, background: "#e0e7ff", border: "1px solid #6366f1" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#3730a3" }}>{stats?.lessonsAffected ?? 0}</div>
              <div style={{ fontSize: 13, color: "#4338ca" }}>Lessons affected</div>
            </div>
            <div style={{ padding: 16, borderRadius: 10, background: "#dbeafe", border: "1px solid #3b82f6" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#1e40af" }}>{stats?.topicsAffected ?? 0}</div>
              <div style={{ fontSize: 13, color: "#1d4ed8" }}>Topics affected</div>
            </div>
            <div style={{ padding: 16, borderRadius: 10, background: "#d1fae5", border: "1px solid #10b981" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#065f46" }}>{stats?.resolvedThisWeek ?? 0}</div>
              <div style={{ fontSize: 13, color: "#047857" }}>Resolved this week</div>
            </div>
          </>
        )}
      </div>

      {/* Most reported lessons */}
      {mostReportedLessons.length > 0 && (
        <div style={{ marginBottom: 24, padding: 16, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Most reported lessons</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "8px 8px", fontWeight: 600 }}>Lesson</th>
                  <th style={{ padding: "8px 8px", fontWeight: 600 }}>Topic</th>
                  <th style={{ padding: "8px 8px", fontWeight: 600 }}>Issues</th>
                  <th style={{ padding: "8px 8px", fontWeight: 600 }}>Last reported</th>
                  <th style={{ padding: "8px 8px", fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mostReportedLessons.map((row) => (
                  <tr key={row.lessonId} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "8px 8px", fontWeight: 500 }}>{row.title}</td>
                    <td style={{ padding: "8px 8px", color: "#64748b" }}>{row.topicKey || "—"}</td>
                    <td style={{ padding: "8px 8px" }}>{row.count}</td>
                    <td style={{ padding: "8px 8px", color: "#64748b", whiteSpace: "nowrap" }}>
                      {formatDate(row.lastReported)}
                    </td>
                    <td style={{ padding: "8px 8px" }}>
                      <Link
                        to={`/edit-lesson/${row.lessonId}`}
                        style={{ color: "#2563eb", fontWeight: 600, fontSize: 12, textDecoration: "none" }}
                      >
                        Edit lesson
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Most reported topics */}
      {mostReportedTopics.length > 0 && (
        <div style={{ marginBottom: 24, padding: 16, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Most reported topics</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "8px 8px", fontWeight: 600 }}>Topic</th>
                  <th style={{ padding: "8px 8px", fontWeight: 600 }}>Issues</th>
                  <th style={{ padding: "8px 8px", fontWeight: 600 }}>Lessons affected</th>
                </tr>
              </thead>
              <tbody>
                {mostReportedTopics.map((row) => (
                  <tr key={row.topicKey} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "8px 8px", fontWeight: 500 }}>{row.display}</td>
                    <td style={{ padding: "8px 8px" }}>{row.count}</td>
                    <td style={{ padding: "8px 8px", color: "#64748b" }}>{row.lessons}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report type breakdown */}
      {reportTypeBreakdown.length > 0 && (
        <div style={{ marginBottom: 24, padding: 16, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Report type breakdown (open)</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", fontSize: 13 }}>
            {reportTypeBreakdown.map(([label, count]) => (
              <span key={label} style={{ padding: "4px 10px", borderRadius: 6, background: "#e2e8f0", color: "#475569" }}>
                {label}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Reports table */}
      <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>All reports</h3>
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
                      {pageDisplay(r)}
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center" }}>
                        {r.reportTypeLabel}
                        <PriorityBadge reportType={r.reportType} />
                      </span>
                    </td>
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
                          to={lessonViewUrl(r)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "1px solid #94a3b8",
                            background: "#f8fafc",
                            color: "#475569",
                            textDecoration: "none",
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                        >
                          View lesson{r.pageId ? " (page)" : ""}
                        </Link>
                        <Link
                          to={editLessonUrl(r)}
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
                          Edit lesson
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
                        <div className="issue-description-box">
                          <strong>⚠ Reported issue:</strong>
                          <div className="issue-description-text" style={{ marginTop: 8 }}>
                            {r.description}
                          </div>
                        </div>
                        {r.suggestedFix && (
                          <div>
                            <strong>Suggested fix:</strong> {r.suggestedFix}
                          </div>
                        )}
                        {(r.resolvedByName || r.resolvedAt) && (
                          <div style={{ marginTop: 8, color: "#64748b" }}>
                            {r.resolvedByName && (
                              <div><strong>Resolved by:</strong> {r.resolvedByName}</div>
                            )}
                            {r.resolvedAt && (
                              <div><strong>Resolved at:</strong> {formatDate(r.resolvedAt)}</div>
                            )}
                          </div>
                        )}
                        <div style={{ marginTop: 6 }}>
                          <PriorityBadge reportType={r.reportType} />
                        </div>
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
