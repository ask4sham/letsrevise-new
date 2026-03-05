/**
 * PR-010: AI Coverage Dashboard — teacher/admin only.
 * Shows coverage status per topicKey, weak-evidence hotspots, top failing questions.
 * Route: /coverage
 */
import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { SpecSelector } from "../components/SpecSelector";
import { getStoredSpecKey, setStoredSpecKey } from "../utils/specKey";
import {
  getCoverage,
  getCoverageSnapshots,
  type CoverageRow,
  type CoverageSnapshotsResponse,
} from "../api/coverage";
import { getSprintOrderMarkdown } from "../api/sprintOrder";
import type { SpecKey } from "../api/taxonomy";

const WINDOW_OPTIONS = [7, 14, 30] as const;
const STATUS_OPTIONS = ["NO_SPEC", "EMPTY", "THIN", "OK", "STRONG"] as const;

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    NO_SPEC: { bg: "#fef2f2", color: "#b91c1c" },
    EMPTY: { bg: "#fff7ed", color: "#c2410c" },
    THIN: { bg: "#fef9c3", color: "#a16207" },
    OK: { bg: "#dbeafe", color: "#1d4ed8" },
    STRONG: { bg: "#d1fae5", color: "#047857" },
  };
  const s = styles[status] ?? { bg: "#f3f4f6", color: "#6b7280" };
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        backgroundColor: s.bg,
        color: s.color,
      }}
    >
      {status}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 70 ? "#059669" : pct >= 40 ? "#2563eb" : "#dc2626";
  return (
    <div
      style={{
        width: 60,
        height: 8,
        backgroundColor: "#e5e7eb",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          backgroundColor: color,
          borderRadius: 4,
        }}
      />
    </div>
  );
}

const CoverageDashboardPage: React.FC = () => {
  const { user } = useCurrentUser({ watchLocation: true });
  const dashboardHref = user?.userType === "admin" ? "/admin" : "/teacher-dashboard";
  const [specKey, setSpecKey] = useState<SpecKey>(getStoredSpecKey);
  const [windowDays, setWindowDays] = useState<number>(14);
  const [useSnapshot, setUseSnapshot] = useState(true);
  const [rows, setRows] = useState<CoverageRow[]>([]);
  const [snapshotMeta, setSnapshotMeta] = useState<{ computedAt?: string; hint?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState(false);
  const [sprintOrderLoading, setSprintOrderLoading] = useState(false);
  const [sprintOrderToast, setSprintOrderToast] = useState<string | null>(null);

  const onSpecChange = (v: SpecKey) => {
    setSpecKey(v);
    setStoredSpecKey(v);
    setRows([]);
    setSnapshotMeta(null);
    setError(null);
  };

  const loadSnapshot = async () => {
    setLoading(true);
    setError(null);
    try {
      const data: CoverageSnapshotsResponse = await getCoverageSnapshots({ specKey });
      setRows(data.rows ?? []);
      setSnapshotMeta({
        computedAt: data.computedAt,
        hint: data.hint,
      });
    } catch (e: any) {
      setError(e?.message ?? "Failed to load snapshots");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLive = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCoverage({ specKey, windowDays });
      setRows(data.rows ?? []);
      setSnapshotMeta(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load coverage");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (useSnapshot) loadSnapshot();
    else loadLive();
  }, [specKey, useSnapshot, windowDays]);

  const filteredRows = useMemo(() => {
    let out = rows;
    if (statusFilter.length > 0) {
      out = out.filter((r) => statusFilter.includes(r.status));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((r) => r.topicKey.toLowerCase().includes(q));
    }
    return out;
  }, [rows, statusFilter, search]);

  const summary = useMemo(() => {
    const thinEmpty = rows.filter((r) => r.status === "THIN" || r.status === "EMPTY").length;
    const strong = rows.filter((r) => r.status === "STRONG").length;
    const totalEnq = rows.reduce((s, r) => s + r.enquiriesTotal, 0);
    const totalWeak = rows.reduce((s, r) => s + r.enquiriesWeakEvidence, 0);
    const weakRateOverall = totalEnq > 0 ? (totalWeak / totalEnq) * 100 : 0;
    return { topics: rows.length, thinEmpty, strong, weakRateOverall };
  }, [rows]);

  const runScriptHint = `node backend/scripts/buildCoverageReport.js --apply --specKey ${specKey}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(runScriptHint);
    setCopyHint(true);
    setTimeout(() => setCopyHint(false), 1500);
  };

  const handleGenerateSprintOrder = async () => {
    if (!specKey) return;
    setSprintOrderLoading(true);
    setSprintOrderToast(null);
    try {
      const { source } = await getSprintOrderMarkdown({
        specKey,
        windowDays,
        useSnapshots: useSnapshot,
        top: 200,
        minEnquiries: 3,
      });
      setSprintOrderToast(`Downloaded sprint order (${source})`);
      setTimeout(() => setSprintOrderToast(null), 4000);
    } catch (e: any) {
      let msg = "Failed to generate sprint order";
      const d = e?.response?.data;
      if (typeof d === "object" && d?.error) msg = d.error;
      else if (typeof d === "string") {
        try {
          const parsed = JSON.parse(d);
          if (parsed?.error) msg = parsed.error;
        } catch {
          msg = d || msg;
        }
      } else if (e?.message) msg = e.message;
      setSprintOrderToast(msg);
      setTimeout(() => setSprintOrderToast(null), 4000);
    } finally {
      setSprintOrderLoading(false);
    }
  };

  return (
    <div style={{ padding: "1rem", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <Link to={dashboardHref} style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
          ← Dashboard
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 16,
          marginBottom: 24,
          padding: 16,
          background: "white",
          borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>AI Coverage Dashboard</h1>
        <SpecSelector value={specKey} onChange={onSpecChange} />
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>Window:</span>
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
          >
            {WINDOW_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setUseSnapshot(true);
            loadSnapshot();
          }}
          disabled={loading}
          style={{
            padding: "8px 16px",
            background: useSnapshot ? "#374151" : "white",
            color: useSnapshot ? "white" : "#374151",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          Use latest snapshot
        </button>
        <button
          type="button"
          onClick={() => {
            setUseSnapshot(false);
            loadLive();
          }}
          disabled={loading}
          style={{
            padding: "8px 16px",
            background: !useSnapshot ? "#059669" : "white",
            color: !useSnapshot ? "white" : "#059669",
            border: "1px solid #059669",
            borderRadius: 8,
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          Refresh (live)
        </button>
        <button
          type="button"
          onClick={handleGenerateSprintOrder}
          disabled={!specKey || sprintOrderLoading}
          style={{
            padding: "8px 16px",
            background: "#6366f1",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            cursor: !specKey || sprintOrderLoading ? "not-allowed" : "pointer",
          }}
        >
          {sprintOrderLoading ? "Generating…" : "Generate sprint order"}
        </button>
      </div>

      {sprintOrderToast && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: 16,
            background: sprintOrderToast.startsWith("Downloaded") ? "#d1fae5" : "#fef2f2",
            color: sprintOrderToast.startsWith("Downloaded") ? "#065f46" : "#991b1b",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {sprintOrderToast}
        </div>
      )}

      {snapshotMeta?.hint && (
        <div
          style={{
            padding: 16,
            background: "#fef3c7",
            border: "1px solid #f59e0b",
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontWeight: 600 }}>No snapshots saved yet</p>
          <p style={{ margin: "0 0 8px 0", fontSize: 14, color: "#92400e" }}>
            Run this command to generate and save coverage snapshots:
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "monospace",
              fontSize: 13,
              padding: "8px 12px",
              background: "white",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
            }}
          >
            <code style={{ flex: 1, overflow: "auto" }}>{runScriptHint}</code>
            <button
              type="button"
              onClick={copyToClipboard}
              style={{
                padding: "4px 12px",
                background: "#374151",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              {copyHint ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {loading && <p style={{ color: "#6b7280", marginBottom: 16 }}>Loading…</p>}
      {error && <p style={{ color: "#b91c1c", marginBottom: 16 }}>{error}</p>}

      {/* Summary cards */}
      {rows.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ padding: 16, background: "white", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>Topics total</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.topics}</div>
          </div>
          <div style={{ padding: 16, background: "white", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>THIN + EMPTY</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#dc2626" }}>{summary.thinEmpty}</div>
          </div>
          <div style={{ padding: 16, background: "white", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>STRONG</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#059669" }}>{summary.strong}</div>
          </div>
          <div style={{ padding: 16, background: "white", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>Weak-evidence rate</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: summary.weakRateOverall > 20 ? "#dc2626" : "#059669" }}>
              {summary.weakRateOverall.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {rows.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
            alignItems: "center",
          }}
        >
          <input
            type="text"
            placeholder="Search topicKey…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              width: 200,
              fontSize: 14,
            }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {STATUS_OPTIONS.map((s) => (
              <label key={s} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={statusFilter.includes(s)}
                  onChange={(e) =>
                    setStatusFilter((prev) =>
                      e.target.checked ? [...prev, s] : prev.filter((x) => x !== s)
                    )
                  }
                />
                <span style={{ fontSize: 13 }}>{s}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      {filteredRows.length > 0 && (
        <div
          style={{
            background: "white",
            borderRadius: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            overflow: "auto",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600 }}>topicKey</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600 }}>status</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>score</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>specStmt</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>specDocs</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>lessonDocs</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>enquiries</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>weak</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>weakRate</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <React.Fragment key={r.topicKey}>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "10px 16px", fontFamily: "monospace", fontSize: 12 }}>
                      {r.topicKey}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <StatusBadge status={r.status} />
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                        <ScoreBar score={r.score} />
                        <span>{r.score}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>{r.specStatementsTotal}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>{r.knowledgeDocsSpec}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>{r.knowledgeDocsLesson}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>{r.enquiriesTotal}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>{r.enquiriesWeakEvidence}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>{(r.weakRate * 100).toFixed(1)}%</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>
                      <Link
                        to={`/teacher/content-coverage`}
                        style={{ fontSize: 13, color: "#2563eb", marginRight: 8 }}
                      >
                        Content
                      </Link>
                      {(r.topWeakQuestions?.length ?? 0) > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedTopic((prev) => (prev === r.topicKey ? null : r.topicKey))
                          }
                          style={{
                            background: "none",
                            border: "none",
                            color: "#2563eb",
                            cursor: "pointer",
                            fontSize: 13,
                            textDecoration: "underline",
                          }}
                        >
                          View weak questions
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedTopic === r.topicKey && r.topWeakQuestions && r.topWeakQuestions.length > 0 && (
                    <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                      <td colSpan={10} style={{ padding: "12px 16px" }}>
                        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>
                          Top weak evidence questions
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                          {r.topWeakQuestions.map((q, i) => (
                            <li key={i} style={{ marginBottom: 4, fontSize: 13 }}>
                              &quot;{(q.question || "").slice(0, 120)}
                              {(q.question?.length ?? 0) > 120 ? "…" : ""}&quot; (×{q.count})
                            </li>
                          ))}
                        </ul>
                        {(r.status === "THIN" || r.status === "EMPTY" || r.status === "NO_SPEC") && (
                          <p
                            style={{
                              marginTop: 8,
                              fontSize: 12,
                              color: "#6b7280",
                              fontStyle: "italic",
                            }}
                          >
                            If this topic is THIN/EMPTY, build SpecStatements + Lesson content first.
                          </p>
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

      {!loading && rows.length === 0 && !snapshotMeta?.hint && (
        <p style={{ color: "#6b7280" }}>No coverage data for this spec. Try &quot;Refresh (live)&quot; or run the build script.</p>
      )}
      {!loading && filteredRows.length === 0 && rows.length > 0 && (
        <p style={{ color: "#6b7280" }}>No rows match the current filters.</p>
      )}
    </div>
  );
};

export default CoverageDashboardPage;
